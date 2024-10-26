from fastapi import APIRouter, HTTPException
import os
import aiofiles
from loguru import logger
import traceback
from typing import Dict, Any
from pathlib import Path
from ..storage.json_file import load_rags_from_json, save_rags_to_json
from .request_types import AddRAGRequest

router = APIRouter()

@router.delete("/rags/{rag_name}")
async def delete_rag(rag_name: str):
    """Delete a RAG service."""
    rags = await load_rags_from_json()
    
    if rag_name not in rags:
        raise HTTPException(status_code=404, detail=f"RAG {rag_name} not found")
        
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
        logger.warning(f"Failed to delete log files for RAG {rag_name}: {str(e)}")
    
    return {"message": f"RAG {rag_name} deleted successfully"}

@router.get("/rags/{rag_name}")
async def get_rag(rag_name: str):
    """Get detailed information for a specific RAG."""
    rags = await load_rags_from_json()
    
    if rag_name not in rags:
        raise HTTPException(status_code=404, detail=f"RAG {rag_name} not found")
        
    return rags[rag_name]

@router.put("/rags/{rag_name}")
async def update_rag(rag_name: str, request: AddRAGRequest):
    """Update an existing RAG."""
    rags = await load_rags_from_json()
    
    if rag_name not in rags:
        raise HTTPException(status_code=404, detail=f"RAG {rag_name} not found")
        
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
        raise HTTPException(status_code=500, detail=f"Failed to read log file: {str(e)}")