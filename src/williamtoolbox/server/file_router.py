from fastapi import APIRouter, HTTPException, UploadFile, File
from typing import List, Dict
import os
import aiofiles
import uuid
from ..storage.json_file import with_file_lock
from loguru import logger

router = APIRouter()

# 存储RAG文件的基础路径
RAG_FILES_BASE = "./rag_files"

async def ensure_rag_dir(rag_name: str):
    """确保RAG目录存在"""
    rag_dir = os.path.join(RAG_FILES_BASE, rag_name)
    os.makedirs(rag_dir, exist_ok=True)
    return rag_dir

@router.get("/rags/{rag_name}/files")
async def get_rag_files(rag_name: str):
    """获取RAG文件列表"""
    try:
        rag_dir = await ensure_rag_dir(rag_name)
        files = []
        for filename in os.listdir(rag_dir):
            file_path = os.path.join(rag_dir, filename)
            if os.path.isfile(file_path):
                stat = os.stat(file_path)
                files.append({
                    "name": filename,
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
        # 生成唯一文件名
        file_ext = os.path.splitext(file.filename)[1]
        unique_filename = f"{uuid.uuid4().hex}{file_ext}"
        file_path = os.path.join(rag_dir, unique_filename)
        
        # 异步写入文件
        async with aiofiles.open(file_path, "wb") as f:
            await f.write(await file.read())
        
        return {"filename": unique_filename}
    except Exception as e:
        logger.error(f"Error uploading file to RAG {rag_name}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/rags/{rag_name}/files/{filename}")
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