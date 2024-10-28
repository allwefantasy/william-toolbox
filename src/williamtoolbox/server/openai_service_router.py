from fastapi import APIRouter
import os
import signal
import psutil
from loguru import logger
import subprocess
import traceback
from typing import Dict
from ..storage.json_file import *

router = APIRouter()

@router.post("/openai-compatible-service/start")
async def start_openai_compatible_service(request: OpenAIServiceStartRequest):
    config = await load_config()
    if "openaiServerList" in config and config["openaiServerList"]:
        return {"message": "OpenAI compatible service is already running"}

    command = f"byzerllm serve --ray_address auto --host {request.host} --port {request.port}"
    try:
        # Create logs directory if it doesn't exist
        os.makedirs("logs", exist_ok=True)

        # Open log files for stdout and stderr
        stdout_log = open(os.path.join("logs", "openai_compatible_service.out"), "w")
        stderr_log = open(os.path.join("logs", "openai_compatible_service.err"), "w")

        # Use subprocess.Popen to start the process in the background
        process = subprocess.Popen(
            command.split(), stdout=stdout_log, stderr=stderr_log
        )
        logger.info(f"OpenAI compatible service started with PID: {process.pid}")

        # Update config.json with the new server information
        if "openaiServerList" not in config:
            config["openaiServerList"] = []
        config["openaiServerList"].append(
            {"host": request.host, "port": request.port, "pid": process.pid}
        )
        await save_config(config)

        return {
            "message": "OpenAI compatible service started successfully",
            "pid": process.pid,
        }
    except Exception as e:
        logger.error(f"Failed to start OpenAI compatible service: {str(e)}")
        traceback.print_exc()
        return {"error": f"Failed to start OpenAI compatible service: {str(e)}"}


@router.post("/openai-compatible-service/stop")
async def stop_openai_compatible_service():
    config = await load_config()
    if "openaiServerList" not in config or not config["openaiServerList"]:
        return {"message": "OpenAI compatible service is not running"}

    try:
        for server in config["openaiServerList"]:
            try:
                process = psutil.Process(server["pid"])
                for child in process.children(recursive=True):
                    child.terminate()
                process.terminate()
            except psutil.NoSuchProcess:
                logger.warning(f"Process with PID {server['pid']} not found")

        config["openaiServerList"] = []
        await save_config(config)
        return {"message": "OpenAI compatible service stopped successfully"}
    except Exception as e:
        return {"error": f"Failed to stop OpenAI compatible service: {str(e)}"}


@router.get("/openai-compatible-service/status")
async def get_openai_compatible_service_status():
    config = await load_config()
    is_running = False
    if "openaiServerList" in config and len(config["openaiServerList"]) > 0:
        # 获取存储的pid
        server = config["openaiServerList"][0]
        pid = server.get("pid")
        if pid:
            try:
                # 检查进程是否存在
                process = psutil.Process(pid)
                is_running = process.is_running()
            except psutil.NoSuchProcess:
                is_running = False
                # 进程不存在,清理配置
                config["openaiServerList"] = []
                await save_config(config)
    
    return {"isRunning": is_running}