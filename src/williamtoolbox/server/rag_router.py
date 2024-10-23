from fastapi import APIRouter, HTTPException
import os
import aiofiles
from loguru import logger
import traceback
from typing import Dict, Any
from pathlib import Path

router = APIRouter()

@router.get("/rags/{rag_name}/logs/{log_type}")
async def get_rag_logs(rag_name: str, log_type: str) -> Dict[str, Any]:
    """Get the logs for a specific RAG."""
    if log_type not in ["out", "err"]:
        raise HTTPException(status_code=400, detail="Invalid log type")
    
    log_file = f"logs/{rag_name}.{log_type}"
    
    try:
        if not os.path.exists(log_file):
            return {"content": "", "exists": False}
            
        async with aiofiles.open(log_file, mode='r') as f:
            content = await f.read()
            return {"content": content, "exists": True}
            
    except Exception as e:
        logger.error(f"Error reading log file: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Failed to read log file: {str(e)}")