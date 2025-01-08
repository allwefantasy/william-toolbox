from fastapi import APIRouter, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse
from pathlib import Path
import uuid
import os
import asyncio
from concurrent.futures import ThreadPoolExecutor
from typing import Dict, Any
from williamtoolbox.storage.json_file import load_file_resources, save_file_resources
from williamtoolbox.annotation import extract_text_from_docx, extract_annotations_from_docx, auto_generate_annotations
from datetime import datetime

router = APIRouter()


# 线程池用于处理阻塞操作
executor = ThreadPoolExecutor(max_workers=4)

# 确保上传目录存在
UPLOAD_DIR = Path("./data/upload")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

async def save_uploaded_file(file: UploadFile) -> str:
    """保存上传的文件并返回生成的UUID"""
    file_uuid = str(uuid.uuid4())
    file_path = UPLOAD_DIR / file_uuid
    
    try:
        with open(file_path, "wb") as buffer:
            buffer.write(await file.read())
        return file_uuid
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")

@router.post("/api/annotations/upload")
async def upload_file(file: UploadFile, username: str):
    """上传文档接口"""
    file_uuid = await save_uploaded_file(file)
    
    # 保存文件资源信息
    file_resources = await load_file_resources()
    file_resources[file_uuid] = {
        "uuid": file_uuid,
        "path": str(UPLOAD_DIR / file_uuid),
        "username": username,
        "original_name": file.filename,
        "upload_time": str(datetime.now())
    }
    await save_file_resources(file_resources)
    
    return JSONResponse({
        "uuid": file_uuid,
        "message": "File uploaded successfully"
    })

@router.get("/api/annotations/document/{file_uuid}")
async def get_document_content(file_uuid: str):
    """获取文档内容和注释"""
    file_resources = await load_file_resources()
    if file_uuid not in file_resources:
        raise HTTPException(status_code=404, detail="File not found")
    
    file_path = file_resources[file_uuid]["path"]
    
    # 使用线程池处理阻塞操作
    loop = asyncio.get_event_loop()
    try:
        full_text = await loop.run_in_executor(
            executor, extract_text_from_docx, file_path
        )
        comments = await loop.run_in_executor(
            executor, extract_annotations_from_docx, file_path
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process document: {str(e)}")
    
    return JSONResponse({
        "full_text": full_text,
        "comments": comments
    })

@router.get("/api/annotations/document/{file_uuid}/info")
async def get_document_info(file_uuid: str):
    """获取文档元信息"""
    file_resources = await load_file_resources()
    if file_uuid not in file_resources:
        raise HTTPException(status_code=404, detail="File not found")
    
    return JSONResponse(file_resources[file_uuid])

@router.post("/api/annotations/auto_generate")
async def auto_generate_annotation(file_uuid: str):
    """自动生成文档批注"""
    file_resources = await load_file_resources()
    if file_uuid not in file_resources:
        raise HTTPException(status_code=404, detail="File not found")
    
    file_path = file_resources[file_uuid]["path"]
    
    try:
        # 读取文档内容
        loop = asyncio.get_event_loop()
        doc_text = await loop.run_in_executor(
            executor, extract_text_from_docx, file_path
        )
        
        # 调用自动生成批注
        result = await loop.run_in_executor(
            executor, auto_generate_annotations, llm, doc_text
        )
        
        return JSONResponse({
            "doc_text": result.doc_text,
            "annotations": [
                {
                    "text": annotation.text,
                    "comment": annotation.comment,
                    "timestamp": annotation.timestamp if hasattr(annotation, "timestamp") else None
                }
                for annotation in result.annotations
            ]
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate annotations: {str(e)}")