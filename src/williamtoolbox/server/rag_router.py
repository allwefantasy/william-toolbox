from fastapi import APIRouter, HTTPException
import os
import aiofiles
from loguru import logger
import traceback
from typing import Dict, Any, List
from pathlib import Path
from ..storage.json_file import load_rags_from_json, save_rags_to_json
from .request_types import AddRAGRequest
import subprocess
import signal
import psutil
import asyncio

router = APIRouter()


@router.get("/rags", response_model=List[Dict[str, Any]])
async def list_rags():
    """List all RAGs and their current status."""
    rags = await load_rags_from_json()
    
    # Check and update status for each RAG
    for rag_name, rag_info in rags.items():
        process_id = rag_info.get("process_id")
        if process_id is not None:
            try:
                process = psutil.Process(process_id)
                if not process.is_running():
                    rag_info["status"] = "stopped"
                    del rag_info["process_id"]
            except psutil.NoSuchProcess:
                rag_info["status"] = "stopped"
                if "process_id" in rag_info:
                    del rag_info["process_id"]
    
    await save_rags_to_json(rags)
    return [{"name": name, **info} for name, info in rags.items()]


@router.delete("/rags/{rag_name}")
async def delete_rag(rag_name: str):
    """Delete a RAG service."""
    rags = await load_rags_from_json()

    if rag_name not in rags:
        raise HTTPException(
            status_code=404, detail=f"RAG {rag_name} not found")

    rag_info = rags[rag_name]
    if rag_info['status'] == 'running':
        raise HTTPException(
            status_code=400,
            detail="Cannot delete a running RAG. Please stop it first."
        )

    # Delete the RAG
    del rags[rag_name]
    await save_rags_to_json(rags)

    # Try to delete log files if they exist
    try:
        log_files = [f"logs/{rag_name}.out", f"logs/{rag_name}.err"]
        for log_file in log_files:
            if os.path.exists(log_file):
                os.remove(log_file)
    except Exception as e:
        logger.warning(
            f"Failed to delete log files for RAG {rag_name}: {str(e)}")

    return {"message": f"RAG {rag_name} deleted successfully"}


@router.get("/rags/{rag_name}")
async def get_rag(rag_name: str):
    """Get detailed information for a specific RAG."""
    rags = await load_rags_from_json()

    if rag_name not in rags:
        raise HTTPException(
            status_code=404, detail=f"RAG {rag_name} not found")

    rag_info = rags[rag_name]
    process_id = rag_info.get("process_id")
    if process_id is not None:
        try:
            process = psutil.Process(process_id)
            if not process.is_running():
                rag_info["status"] = "stopped"
                del rag_info["process_id"]
        except psutil.NoSuchProcess:
            rag_info["status"] = "stopped"
            if "process_id" in rag_info:
                del rag_info["process_id"]
    
    await save_rags_to_json(rags)
    return rag_info


@router.put("/rags/{rag_name}")
async def update_rag(rag_name: str, request: AddRAGRequest):
    """Update an existing RAG."""
    rags = await load_rags_from_json()

    if rag_name not in rags:
        raise HTTPException(
            status_code=404, detail=f"RAG {rag_name} not found")

    rag_info = rags[rag_name]
    if rag_info['status'] == 'running':
        raise HTTPException(
            status_code=400,
            detail="Cannot update a running RAG. Please stop it first."
        )

    # Update the RAG configuration
    rag_info.update(request.model_dump())
    rags[rag_name] = rag_info
    logger.info(f"RAG {rag_name} updated: {rag_info}")
    await save_rags_to_json(rags)

    return {"message": f"RAG {rag_name} updated successfully"}


@router.get("/rags/{rag_name}/logs/{log_type}/{offset}")
async def get_rag_logs(rag_name: str, log_type: str, offset: int = 0) -> Dict[str, Any]:
    """Get the logs for a specific RAG with offset support.
    If offset is negative, returns the last |offset| characters from the end of file.
    """
    if log_type not in ["out", "err"]:
        raise HTTPException(status_code=400, detail="Invalid log type")

    log_file = f"logs/{rag_name}.{log_type}"

    try:
        if not os.path.exists(log_file):
            return {"content": "", "exists": False, "offset": 0}

        file_size = os.path.getsize(log_file)

        if offset < 0:
            # For negative offset, read the last |offset| characters
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
            # For positive offset, read from the specified position to end
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
        raise HTTPException(
            status_code=500, detail=f"Failed to read log file: {str(e)}")


@router.post("/rags/add")
async def add_rag(rag: AddRAGRequest):
    """Add a new RAG to the supported RAGs list."""
    rags = await load_rags_from_json()
    if rag.name in rags:
        raise HTTPException(
            status_code=400, detail=f"RAG {rag.name} already exists")

    # Check if the port is already in use by another RAG
    for other_rag in rags.values():
        if other_rag["port"] == rag.port:
            raise HTTPException(
                status_code=400,
                detail=f"Port {rag.port} is already in use by RAG {other_rag['name']}",
            )
    new_rag = {"status": "stopped", **rag.model_dump()}
    rags[rag.name] = new_rag
    await save_rags_to_json(rags)
    return {"message": f"RAG {rag.name} added successfully"}


@router.post("/rags/{rag_name}/{action}")
async def manage_rag(rag_name: str, action: str):
    """Start or stop a specified RAG."""
    rags = await load_rags_from_json()
    if rag_name not in rags:
        raise HTTPException(
            status_code=404, detail=f"RAG {rag_name} not found")

    if action not in ["start", "stop"]:
        raise HTTPException(
            status_code=400, detail="Invalid action. Use 'start' or 'stop'"
        )

    rag_info = rags[rag_name]

    if action == "start":
        # Check if the port is already in use by another RAG
        port = rag_info["port"] or 8000
        for other_rag in rags.values():
            if other_rag["name"] != rag_name and other_rag["port"] == port:
                raise HTTPException(
                    status_code=400,
                    detail=f"Port {port} is already in use by RAG {other_rag['name']}",
                )

        rag_doc_filter_relevance = int(rag_info["rag_doc_filter_relevance"])
        command = "auto-coder.rag serve"
        command += f" --quick"
        command += f" --model {rag_info['model']}"

        if rag_info["tokenizer_path"]:
            command += f" --tokenizer_path {rag_info['tokenizer_path']}"

        command += f" --doc_dir {rag_info['doc_dir']}"
        command += f" --rag_doc_filter_relevance {rag_doc_filter_relevance}"
        command += f" --host {rag_info['host'] or '0.0.0.0'}"
        command += f" --port {port}"

        if rag_info["required_exts"]:
            command += f" --required_exts {rag_info['required_exts']}"
        if rag_info["disable_inference_enhance"]:
            command += f" --disable_inference_enhance"
        if rag_info["inference_deep_thought"]:
            command += f" --inference_deep_thought"

        if rag_info["without_contexts"]:
            command += f" --without_contexts"

        if "enable_hybrid_index" in rag_info and rag_info["enable_hybrid_index"]:
            command += f" --enable_hybrid_index"
            if "hybrid_index_max_output_tokens" in rag_info:
                command += f" --hybrid_index_max_output_tokens {rag_info['hybrid_index_max_output_tokens']}"

        if "infer_params" in rag_info:
            for key, value in rag_info["infer_params"].items():
                if value in ["true", "True"]:
                    command += f" --{key}"
                elif value in ["false", "False"]:
                    continue
                else:
                    command += f" --{key} {value}"

        logger.info(f"manage rag {rag_name} with command: {command}")
        try:
            # Create logs directory if it doesn't exist
            os.makedirs("logs", exist_ok=True)

            # Open log files for stdout and stderr
            stdout_log = open(os.path.join(
                "logs", f"{rag_info['name']}.out"), "w")
            stderr_log = open(os.path.join(
                "logs", f"{rag_info['name']}.err"), "w")

            # Use asyncio.create_subprocess_shell to start the process asynchronously
            process = await asyncio.create_subprocess_shell(
                command,
                stdout=stdout_log,
                stderr=stderr_log
            )
            rag_info["status"] = "running"
            rag_info["process_id"] = process.pid

            # Close the file handles
            stdout_log.close()
            stderr_log.close()
        except Exception as e:
            logger.error(f"Failed to start RAG: {str(e)}")
            traceback.print_exc()
            raise HTTPException(
                status_code=500, detail=f"Failed to start RAG: {str(e)}"
            )
    else:  # action == "stop"
        if "process_id" in rag_info:
            try:
                os.kill(rag_info["process_id"], signal.SIGTERM)
                rag_info["status"] = "stopped"
                del rag_info["process_id"]
            except ProcessLookupError:
                # Process already terminated
                rag_info["status"] = "stopped"
                del rag_info["process_id"]
            except Exception as e:
                logger.error(f"Failed to stop RAG: {str(e)}")
                traceback.print_exc()
                raise HTTPException(
                    status_code=500, detail=f"Failed to stop RAG: {str(e)}"
                )
        else:
            rag_info["status"] = "stopped"

    rags[rag_name] = rag_info
    await save_rags_to_json(rags)

    return {"message": f"RAG {rag_name} {action}ed successfully"}


@router.get("/rags/{rag_name}/status")
async def get_rag_status(rag_name: str) -> Dict[str, Any]:
    """
    Get the status of a specific RAG
    """
    rags = await load_rags_from_json()
    if rag_name not in rags:
        raise HTTPException(status_code=404, detail=f"RAG {rag_name} not found")

    rag_info = rags[rag_name]
    process_id = rag_info.get("process_id")

    if process_id is None:
        rag_info["status"] = "stopped"
        return rag_info

    try:
        # Use psutil to check process status asynchronously
        process = psutil.Process(process_id)
        if process.is_running():
            rag_info["status"] = "running"
        else:
            rag_info["status"] = "stopped"
            rag_info["process_id"] = None
    except psutil.NoSuchProcess:
        rag_info["status"] = "stopped"
        rag_info["process_id"] = None
    except Exception as e:
        logger.error(f"Error checking RAG status: {str(e)}")
        rag_info["status"] = "unknown"

    # Save updated status
    await save_rags_to_json(rags)
    return rag_info
