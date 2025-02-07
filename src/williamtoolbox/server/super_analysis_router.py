import signal
from fastapi import APIRouter, HTTPException
import os
import aiofiles
from loguru import logger
import traceback
from typing import Dict, Any
from pathlib import Path
import subprocess
import psutil
from ..storage.json_file import load_super_analysis_from_json, save_super_analysis_to_json
from .request_types import AddSuperAnalysisRequest


router = APIRouter()

@router.get("/super-analysis")
async def list_super_analysis():
    """List all Super Analysis services."""
    analyses = await load_super_analysis_from_json()
    return [{"name": name, **info} for name, info in analyses.items()]

@router.post("/super-analysis/add")
async def add_super_analysis(request: AddSuperAnalysisRequest):
    """Add a new Super Analysis service."""
    analyses = await load_super_analysis_from_json()
    
    if request.name in analyses:
        raise HTTPException(
            status_code=400, 
            detail=f"Super Analysis {request.name} already exists"
        )
        
    for analysis in analyses.values():
        if analysis["port"] == request.port:
            raise HTTPException(
                status_code=400,
                detail=f"Port {request.port} is already in use"
            )
            
    new_analysis = {
        "status": "stopped",
        **request.model_dump()
    }
    
    analyses[request.name] = new_analysis
    await save_super_analysis_to_json(analyses)
    return {"message": f"Super Analysis {request.name} added successfully"}

@router.delete("/super-analysis/{analysis_name}")
async def delete_super_analysis(analysis_name: str):
    """Delete a Super Analysis service."""
    analyses = await load_super_analysis_from_json()
    
    if analysis_name not in analyses:
        raise HTTPException(
            status_code=404, 
            detail=f"Super Analysis {analysis_name} not found"
        )
        
    analysis_info = analyses[analysis_name]
    if analysis_info['status'] == 'running':
        raise HTTPException(
            status_code=400, 
            detail="Cannot delete a running analysis. Please stop it first."
        )
    
    del analyses[analysis_name]
    await save_super_analysis_to_json(analyses)
    
    # Try to delete log files if they exist
    try:
        log_files = [f"logs/{analysis_name}.out", f"logs/{analysis_name}.err"]
        for log_file in log_files:
            if os.path.exists(log_file):
                os.remove(log_file)
    except Exception as e:
        logger.warning(f"Failed to delete log files for analysis {analysis_name}: {str(e)}")
    
    return {"message": f"Super Analysis {analysis_name} deleted successfully"}

@router.put("/super-analysis/{analysis_name}")
async def update_super_analysis(analysis_name: str, request: AddSuperAnalysisRequest):
    """Update an existing Super Analysis service."""
    analyses = await load_super_analysis_from_json()
    
    if analysis_name not in analyses:
        raise HTTPException(
            status_code=404, 
            detail=f"Super Analysis {analysis_name} not found"
        )
        
    analysis_info = analyses[analysis_name]
    if analysis_info['status'] == 'running':
        raise HTTPException(
            status_code=400, 
            detail="Cannot update a running analysis. Please stop it first."
        )
    
    # Update the analysis configuration
    analysis_info.update(request.model_dump())    
    analyses[analysis_name] = analysis_info    
    logger.info(f"Super Analysis {analysis_name} updated: {analysis_info}")
    await save_super_analysis_to_json(analyses)
    
    return {"message": f"Super Analysis {analysis_name} updated successfully"}

@router.post("/super-analysis/{analysis_name}/{action}")
async def manage_super_analysis(analysis_name: str, action: str):
    """Start or stop a specified Super Analysis service."""
    analyses = await load_super_analysis_from_json()
    
    if analysis_name not in analyses:
        raise HTTPException(
            status_code=404, 
            detail=f"Super Analysis {analysis_name} not found"
        )
        
    if action not in ["start", "stop"]:
        raise HTTPException(
            status_code=400, 
            detail="Invalid action. Use 'start' or 'stop'"
        )
        
    analysis_info = analyses[analysis_name]
    
    if action == "start":
        # Check if port is already in use
        port = analysis_info["port"]
        for other_analysis in analyses.values():
            if other_analysis["name"] != analysis_name and other_analysis["port"] == port:
                raise HTTPException(
                    status_code=400,
                    detail=f"Port {port} is already in use"
                )
                
        command = "super-analysis.serve"
        command += f" --served-model-name {analysis_info['served_model_name']}"
        command += f" --port {port}"
        command += f" --schema-rag-base-url {analysis_info['schema_rag_base_url']}"
        command += f" --context-rag-base-url {analysis_info['context_rag_base_url']}"
        command += f" --byzer-sql-url {analysis_info['byzer_sql_url']}"
        command += f" --host {analysis_info['host']}"
        
        try:
            os.makedirs("logs", exist_ok=True)
            stdout_log = open(os.path.join("logs", f"{analysis_info['name']}.out"), "w")
            stderr_log = open(os.path.join("logs", f"{analysis_info['name']}.err"), "w")
            
            process = subprocess.Popen(
                command, 
                shell=True,
                stdout=stdout_log,
                stderr=stderr_log
            )
            analysis_info["status"] = "running"
            analysis_info["process_id"] = process.pid
            
        except Exception as e:
            logger.error(f"Failed to start Super Analysis: {str(e)}")
            traceback.print_exc()
            raise HTTPException(
                status_code=500,
                detail=f"Failed to start Super Analysis: {str(e)}"
            )
    else:  # action == "stop"
        if "process_id" in analysis_info:
            try:
                parent = psutil.Process(analysis_info["process_id"])
                # Get all child processes
                children = parent.children(recursive=True)
                # Send SIGTERM to parent and all children
                for child in children:
                    try:
                        child.terminate()
                    except (psutil.NoSuchProcess, psutil.AccessDenied):
                        pass
                parent.terminate()
                # Wait for processes to terminate
                _, alive = psutil.wait_procs(children + [parent], timeout=3)
                # If any processes are still alive, kill them
                for proc in alive:
                    try:
                        proc.kill()
                    except (psutil.NoSuchProcess, psutil.AccessDenied):
                        pass
                analysis_info["status"] = "stopped"
                del analysis_info["process_id"]
            except (ProcessLookupError, psutil.NoSuchProcess):
                analysis_info["status"] = "stopped"
                if "process_id" in analysis_info:
                    del analysis_info["process_id"]
            except Exception as e:
                logger.error(f"Failed to stop Super Analysis: {str(e)}")
                traceback.print_exc()
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to stop Super Analysis: {str(e)}"
                )
        else:
            analysis_info["status"] = "stopped"
            
    analyses[analysis_name] = analysis_info
    await save_super_analysis_to_json(analyses)
    return {"message": f"Super Analysis {analysis_name} {action}ed successfully"}

@router.get("/super-analysis/{analysis_name}/status")
async def get_super_analysis_status(analysis_name: str):
    """Get the status of a specified Super Analysis service."""
    analyses = await load_super_analysis_from_json()
    
    if analysis_name not in analyses:
        raise HTTPException(
            status_code=404,
            detail=f"Super Analysis {analysis_name} not found"
        )
        
    analysis_info = analyses[analysis_name]
    
    is_alive = False
    if "process_id" in analysis_info:
        try:
            process = psutil.Process(analysis_info["process_id"])
            is_alive = process.is_running()
        except psutil.NoSuchProcess:
            is_alive = False
            
    status = "running" if is_alive else "stopped"
    analysis_info["status"] = status
    analyses[analysis_name] = analysis_info
    await save_super_analysis_to_json(analyses)
    
    return {
        "analysis": analysis_name,
        "status": status,
        "process_id": analysis_info.get("process_id"),
        "is_alive": is_alive,
        "success": True
    }

@router.get("/super-analysis/{analysis_name}/logs/{log_type}/{offset}")
async def get_super_analysis_logs(analysis_name: str, log_type: str, offset: int = 0) -> Dict[str, Any]:
    """Get the logs for a specific Super Analysis with offset support."""
    if log_type not in ["out", "err"]:
        raise HTTPException(status_code=400, detail="Invalid log type")
    
    log_file = f"logs/{analysis_name}.{log_type}"
    
    try:
        if not os.path.exists(log_file):
            return {"content": "", "exists": False, "offset": 0}
            
        file_size = os.path.getsize(log_file)
        
        if offset < 0:
            read_size = min(abs(offset), file_size)
            async with aiofiles.open(log_file, mode='r') as f:
                if read_size < file_size:
                    await f.seek(file_size - read_size)
                content = await f.read(read_size)
                current_offset = file_size
            return {
                "content": content, 
                "exists": True, 
                "offset": current_offset
            }
        else:
            if offset > file_size:
                return {"content": "", "exists": True, "offset": file_size}
                
            async with aiofiles.open(log_file, mode='r') as f:
                await f.seek(offset)
                content = await f.read()
                current_offset = await f.tell()
            return {
                "content": content, 
                "exists": True, 
                "offset": current_offset
            }
            
    except Exception as e:
        logger.error(f"Error reading log file: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Failed to read log file: {str(e)}")