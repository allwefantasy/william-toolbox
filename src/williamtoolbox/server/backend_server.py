from .user_router import router as user_router
from .byzer_sql_router import router as byzer_sql_router
from .super_analysis_router import router as super_analysis_router
from .auto_coder_chat_router import router as auto_coder_chat_router
from .config_router import router as config_router
from .openai_service_router import router as openai_service_router
from .model_router import router as model_router
from .rag_router import router as rag_router
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
import uvicorn
from typing import Any, List
import mimetypes
import os
import argparse
import subprocess
from typing import List, Dict
import subprocess
import os
import signal
import psutil
from loguru import logger
import subprocess
import traceback
import psutil
from datetime import datetime
import uuid
from .request_types import *
from urllib.parse import unquote

from .chat_router import router as chat_router
from .file_router import router as file_router
from .apps.annotation_router import router as annotation_router

app = FastAPI()
app.include_router(chat_router)
app.include_router(file_router)
app.include_router(rag_router)
app.include_router(model_router)
app.include_router(openai_service_router)
app.include_router(config_router)
app.include_router(auto_coder_chat_router)
app.include_router(super_analysis_router)
app.include_router(byzer_sql_router)
app.include_router(user_router)
app.include_router(annotation_router)

@app.get("/{full_path:path}")
async def serve_image(full_path: str, request: Request):
    if "_images" in full_path:
        try:
            # 获取文件的完整路径，并进行URL解码            
            file_path = unquote(full_path)            
            # 使用 os.path.normpath 来标准化路径，自动处理不同操作系统的路径分隔符
            file_path = os.path.normpath(file_path)
            print(file_path)
            if not os.path.isabs(file_path):
                file_path = os.path.join("/", file_path)
            # 读取文件内容
            with open(file_path, "rb") as f:
                content = f.read()
            
            # 获取文件的 MIME 类型
            content_type, _ = mimetypes.guess_type(file_path)
            if not content_type:
                content_type = "application/octet-stream"
            
            # 返回文件内容
            return Response(content=content, media_type=content_type)
        except FileNotFoundError:
            raise HTTPException(status_code=404, detail="Image not found")
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    
    # 如果路径中没有 _images，返回 404
    raise HTTPException(status_code=404, detail="Not found")

# Add CORS middleware with restricted origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict to trusted origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def main():
    parser = argparse.ArgumentParser(description="Backend Server")
    parser.add_argument(
        "--port",
        type=int,
        default=8005,
        help="Port to run the backend server on (default: 8005)",
    )
    parser.add_argument(
        "--host",
        type=str,
        default="0.0.0.0",
        help="Host to run the backend server on (default: 0.0.0.0)",
    )
    args = parser.parse_args()
    print(f"Starting backend server on {args.host}:{args.port}")
    uvicorn.run(app, host=args.host, port=args.port)


if __name__ == "__main__":
    main()
