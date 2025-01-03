from fastapi import APIRouter, HTTPException, UploadFile, File
from typing import List, Dict
import os
import aiofiles
import uuid
from ..storage.json_file import with_file_lock
from loguru import logger

router = APIRouter()

from ..storage.json_file import load_rags_from_json

async def ensure_rag_dir(rag_name: str):
    """确保RAG目录存在"""
    rags = await load_rags_from_json()
    if rag_name not in rags:
        raise HTTPException(status_code=404, detail=f"RAG {rag_name} not found")
    
    rag_info = rags[rag_name]
    if "doc_dir" not in rag_info:
        raise HTTPException(status_code=400, detail=f"RAG {rag_name} has no doc_dir configured")
    
    rag_dir = rag_info["doc_dir"]
    os.makedirs(rag_dir, exist_ok=True)
    return rag_dir

@router.get("/rags/{rag_name}/files")
async def get_rag_files(rag_name: str):
    """获取RAG文件列表"""
    try:
        rag_dir = await ensure_rag_dir(rag_name)
        files = []
        for root, dirs, filenames in os.walk(rag_dir):
            # 过滤掉 _images 和 .cache 目录
            dirs[:] = [d for d in dirs if d not in ["_images", ".cache"]]
            for filename in filenames:
                file_path = os.path.join(root, filename)
                if os.path.isfile(file_path):
                    stat = os.stat(file_path)
                    relative_path = os.path.relpath(file_path, rag_dir)
                    # 过滤掉 _images 和 .cache 目录下的文件
                    if not any(part in ["_images", ".cache"] for part in relative_path.split(os.sep)):
                        files.append({
                            "name": relative_path,
                            "size": f"{stat.st_size / 1024:.2f} KB",
                            "modified": stat.st_mtime
                        })
        return files
    except Exception as e:
        logger.error(f"Error getting files for RAG {rag_name}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/rags/{rag_name}/upload")
async def upload_file_to_rag(rag_name: str, file: UploadFile = File(...)):
    """上传文件到RAG"""
    try:
        rag_dir = await ensure_rag_dir(rag_name)
        # 保持原始文件名
        file_path = os.path.join(rag_dir, file.filename)
        
        # 确保目录存在
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        
        # 异步写入文件
        async with aiofiles.open(file_path, "wb") as f:
            await f.write(await file.read())
        
        return {"filename": file.filename}
    except Exception as e:
        logger.error(f"Error uploading file to RAG {rag_name}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/rags/{rag_name}/files/{filename:path}")
async def delete_rag_file(rag_name: str, filename: str):
    """删除RAG文件"""
    try:
        rag_dir = await ensure_rag_dir(rag_name)
        file_path = os.path.join(rag_dir, filename)
        
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="File not found")
        
        os.remove(file_path)
        return {"message": "File deleted successfully"}
    except Exception as e:
        logger.error(f"Error deleting file {filename} from RAG {rag_name}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))