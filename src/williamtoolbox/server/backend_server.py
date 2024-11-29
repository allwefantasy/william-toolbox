from .user_router import router as user_router
from .byzer_sql_router import router as byzer_sql_router
from .super_analysis_router import router as super_analysis_router
from .auto_coder_chat_router import router as auto_coder_chat_router
from .config_router import router as config_router
from .openai_service_router import router as openai_service_router
from .model_router import router as model_router
from .rag_router import router as rag_router
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from typing import Any, List
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

from .chat_router import router as chat_router

app = FastAPI()
app.include_router(chat_router)
app.include_router(rag_router)
app.include_router(model_router)
app.include_router(openai_service_router)
app.include_router(config_router)
app.include_router(auto_coder_chat_router)
app.include_router(super_analysis_router)
app.include_router(byzer_sql_router)
app.include_router(user_router)
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
