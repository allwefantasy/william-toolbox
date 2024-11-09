from fastapi import APIRouter, HTTPException
import os
import aiofiles
from loguru import logger
import traceback
from typing import Dict, Any
from pathlib import Path
import subprocess
import signal
import psutil
import requests
import tarfile
import asyncio
from ..storage.json_file import load_byzer_sql_from_json, save_byzer_sql_to_json
from .request_types import AddByzerSQLRequest

router = APIRouter()

@router.get("/byzer-sql")
async def list_byzer_sql():
    """List all Byzer SQL services."""
    services = await load_byzer_sql_from_json()
    return [{"name": name, **info} for name, info in services.items()]

@router.post("/byzer-sql/add")
async def add_byzer_sql(request: AddByzerSQLRequest):
    """Add a new Byzer SQL service."""
    services = await load_byzer_sql_from_json()
    
    if request.name in services:
        raise HTTPException(
            status_code=400, 
            detail=f"Byzer SQL {request.name} already exists"
        )
        
    # Check if directory exists and validate its structure
    if not os.path.exists(request.install_dir):
        os.makedirs(request.install_dir)
    
    new_service = {
        "status": "stopped",
        **request.model_dump()
    }
    
    services[request.name] = new_service
    await save_byzer_sql_to_json(services)
    return {"message": f"Byzer SQL {request.name} added successfully"}

@router.post("/byzer-sql/download")
async def download_byzer_sql(request: Dict[str, str]):
    """Download and extract Byzer SQL package."""
    download_url = request["download_url"]
    install_dir = request["install_dir"]
    
    try:
        # Download the file
        response = requests.get(download_url, stream=True)
        response.raise_for_status()
        
        tar_path = os.path.join(install_dir, "byzer.tar.gz")
        with open(tar_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        
        # Extract the file
        with tarfile.open(tar_path, "r:gz") as tar:
            tar.extractall(install_dir)
            
        # Remove the tar file
        os.remove(tar_path)
        
        # Make the start script executable
        start_script = os.path.join(install_dir, "bin", "byzer.sh")
        if os.path.exists(start_script):
            os.chmod(start_script, 0o755)
        
        return {"message": "Download and extraction completed successfully"}
        
    except Exception as e:
        logger.error(f"Error during download/extraction: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/byzer-sql/{service_name}")
async def delete_byzer_sql(service_name: str):
    """Delete a Byzer SQL service."""
    services = await load_byzer_sql_from_json()
    
    if service_name not in services:
        raise HTTPException(
            status_code=404, 
            detail=f"Byzer SQL {service_name} not found"
        )
        
    service_info = services[service_name]
    if service_info['status'] == 'running':
        raise HTTPException(
            status_code=400, 
            detail="Cannot delete a running service. Please stop it first."
        )
    
    del services[service_name]
    await save_byzer_sql_to_json(services)
    
    # Try to delete log files if they exist
    try:
        log_files = [f"logs/{service_name}.out", f"logs/{service_name}.err"]
        for log_file in log_files:
            if os.path.exists(log_file):
                os.remove(log_file)
    except Exception as e:
        logger.warning(f"Failed to delete log files for service {service_name}: {str(e)}")
    
    return {"message": f"Byzer SQL {service_name} deleted successfully"}

@router.put("/byzer-sql/{service_name}")
async def update_byzer_sql(service_name: str, request: AddByzerSQLRequest):
    """Update an existing Byzer SQL service."""
    services = await load_byzer_sql_from_json()
    
    if service_name not in services:
        raise HTTPException(
            status_code=404, 
            detail=f"Byzer SQL {service_name} not found"
        )
        
    service_info = services[service_name]
    if service_info['status'] == 'running':
        raise HTTPException(
            status_code=400, 
            detail="Cannot update a running service. Please stop it first."
        )
    
    service_info.update(request.model_dump())
    services[service_name] = service_info
    await save_byzer_sql_to_json(services)
    
    return {"message": f"Byzer SQL {service_name} updated successfully"}

@router.post("/byzer-sql/{service_name}/{action}")
async def manage_byzer_sql(service_name: str, action: str):
    """Start or stop a Byzer SQL service."""
    services = await load_byzer_sql_from_json()
    
    if service_name not in services:
        raise HTTPException(
            status_code=404, 
            detail=f"Byzer SQL {service_name} not found"
        )
        
    if action not in ["start", "stop"]:
        raise HTTPException(
            status_code=400, 
            detail="Invalid action. Use 'start' or 'stop'"
        )
        
    service_info = services[service_name]
    install_dir = service_info["install_dir"]
    
    if not os.path.exists(os.path.join(install_dir, "bin", "byzer.sh")):
        raise HTTPException(
            status_code=400,
            detail="Invalid installation directory. Missing byzer.sh script."
        )
        
    try:
        os.makedirs("logs", exist_ok=True)
        stdout_log = open(os.path.join("logs", f"{service_name}.out"), "w")
        stderr_log = open(os.path.join("logs", f"{service_name}.err"), "w")
        
        if action == "start":
            start_script = os.path.join(install_dir, "bin", "byzer.sh")
            process = subprocess.Popen(
                [start_script, "start"],
                stdout=stdout_log,
                stderr=stderr_log,
                cwd=install_dir
            )
            service_info["status"] = "running"
            service_info["process_id"] = process.pid
            
        else:  # stop
            if "process_id" in service_info:
                stop_script = os.path.join(install_dir, "bin", "byzer.sh")
                subprocess.run([stop_script, "stop"], check=True, cwd=install_dir)
                service_info["status"] = "stopped"
                del service_info["process_id"]
                
        services[service_name] = service_info
        await save_byzer_sql_to_json(services)
        return {"message": f"Byzer SQL {service_name} {action}ed successfully"}
        
    except Exception as e:
        logger.error(f"Failed to {action} Byzer SQL: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail=f"Failed to {action} Byzer SQL: {str(e)}"
        )

@router.get("/byzer-sql/{service_name}/status")
async def get_byzer_sql_status(service_name: str):
    """Get the status of a specified Byzer SQL service."""
    services = await load_byzer_sql_from_json()
    
    if service_name not in services:
        raise HTTPException(
            status_code=404, 
            detail=f"Byzer SQL {service_name} not found"
        )
        
    service_info = services[service_name]
    is_alive = False
    
    if "process_id" in service_info:
        try:
            process = psutil.Process(service_info["process_id"])
            is_alive = process.is_running()
        except psutil.NoSuchProcess:
            is_alive = False
            
    status = "running" if is_alive else "stopped"
    service_info["status"] = status
    services[service_name] = service_info
    await save_byzer_sql_to_json(services)
    
    return {
        "service": service_name,
        "status": status,
        "process_id": service_info.get("process_id"),
        "is_alive": is_alive,
        "success": True
    }

@router.get("/byzer-sql/{service_name}/logs/{log_type}/{offset}")
async def get_byzer_sql_logs(service_name: str, log_type: str, offset: int = 0) -> Dict[str, Any]:
    """Get the logs for a specific Byzer SQL service."""
    if log_type not in ["out", "err"]:
        raise HTTPException(status_code=400, detail="Invalid log type")
    
    log_file = f"logs/{service_name}.{log_type}"
    
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