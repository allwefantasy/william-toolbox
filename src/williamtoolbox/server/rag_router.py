from fastapi import APIRouter, HTTPException
import os
import aiofiles
from loguru import logger
import traceback
from typing import Dict, Any
from pathlib import Path

router = APIRouter()

@router.get("/rags/{rag_name}/logs/{log_type}/{offset}")
async def get_rag_logs(rag_name: str, log_type: str, offset: int = 0) -> Dict[str, Any]:
    """Get the logs for a specific RAG with offset support."""
    if log_type not in ["out", "err"]:
        raise HTTPException(status_code=400, detail="Invalid log type")
    
    log_file = f"logs/{rag_name}.{log_type}"
    
    try:
        if not os.path.exists(log_file):
            return {"content": "", "exists": False, "offset": 0}
            
        file_size = os.path.getsize(log_file)
        if offset > file_size or offset == -1:
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