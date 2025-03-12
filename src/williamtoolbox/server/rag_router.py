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
import tempfile
import uuid
import time

router = APIRouter()

# 存储构建缓存任务的状态和日志
cache_build_tasks = {}

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
    
    # 检查RAG状态 - 对所有类型都相同
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
            
    # 确保设置默认的product_type
    rag_data = rag.model_dump()
    if "product_type" not in rag_data or not rag_data["product_type"]:
        rag_data["product_type"] = "lite"
        
    new_rag = {"status": "stopped", **rag_data}
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
    
    # 默认设置product_type为lite，如果未指定
    product_type = rag_info.get("product_type", "lite")
    
    # 可以在这里添加基于product_type的特定限制
    # 例如，如果有某些操作只允许Pro版本执行

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
        
        # 添加新的模型参数（如果有指定）
        if rag_info.get("recall_model"):
            command += f" --recall_model {rag_info['recall_model']}"
            
        if rag_info.get("chunk_model"):
            command += f" --chunk_model {rag_info['chunk_model']}"
            
        if rag_info.get("qa_model"):
            command += f" --qa_model {rag_info['qa_model']}"
        
        # 只在tokenizer_path有值时添加该参数
        if rag_info.get("tokenizer_path"):
            command += f" --tokenizer_path {rag_info['tokenizer_path']}"
            
        command += f" --doc_dir {rag_info['doc_dir']}"
        command += f" --rag_doc_filter_relevance {rag_doc_filter_relevance}"
        command += f" --host {rag_info['host'] or '0.0.0.0'}"
        command += f" --port {port}"

        # 根据产品类型添加相应的参数
        if product_type == "lite":
            command += f" --lite"
        else:
            command += f" --pro"

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
            
            if "emb_model" in rag_info:
                command += f" --emb_model {rag_info['emb_model']}"

            if "hybrid_index_max_output_tokens" in rag_info:
                command += f" --hybrid_index_max_output_tokens {rag_info['hybrid_index_max_output_tokens']}"
            
            # Add storage type parameter if provided
            if "rag_storage_type" in rag_info:
                command += f" --rag_storage_type {rag_info['rag_storage_type']}"
        
        # 添加本地图片托管参数
        if "enable_local_image_host" in rag_info and rag_info["enable_local_image_host"]:
            command += f" --enable_local_image_host"

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
            stdout_log_path = os.path.join("logs", f"{rag_info['name']}.out")
            stderr_log_path = os.path.join("logs", f"{rag_info['name']}.err")
            
            stdout_log = open(stdout_log_path, "w")
            stderr_log = open(stderr_log_path, "w")
            
            # Store file descriptors in rag_info for later cleanup
            rag_info["stdout_fd"] = stdout_log.fileno()
            rag_info["stderr_fd"] = stderr_log.fileno() 
            
            # 使用修改后的环境变量启动进程
            process = await asyncio.create_subprocess_shell(
                command,
                stdout=stdout_log,
                stderr=stderr_log                
            )
            
            # 保存更多信息以便后续终止
            rag_info["status"] = "running"
            rag_info["process_id"] = process.pid                                
        except Exception as e:
            # Clean up file handles in case of error
            if 'stdout_fd' in rag_info:
                try:
                    os.close(rag_info['stdout_fd'])
                    del rag_info['stdout_fd']
                except:
                    pass
                    
            if 'stderr_fd' in rag_info:
                try:
                    os.close(rag_info['stderr_fd'])
                    del rag_info['stderr_fd']
                except:
                    pass
                    
            logger.error(f"Failed to start RAG: {str(e)}")
            traceback.print_exc()
            raise HTTPException(
                status_code=500, detail=f"Failed to start RAG: {str(e)}"
            )
    else:  # action == "stop"
        if "process_id" in rag_info:
            try:
                process_id = rag_info["process_id"]
                # Get the process object
                process = psutil.Process(process_id)
                
                # Kill any child processes first
                try:
                    children = process.children(recursive=True)
                    for child in children:
                        child.kill()
                except:
                    pass
                
                # Then try to terminate gracefully (SIGTERM)
                process.terminate()
                
                # Wait up to 5 seconds for graceful termination
                try:
                    process.wait(timeout=5)
                except psutil.TimeoutExpired:
                    # If process doesn't terminate in time, force kill it
                    logger.warning(f"Process {process_id} didn't terminate gracefully, force killing")
                    process.kill()
                                                    
                logger.info(f"Successfully stopped RAG process {process_id}")
                
                # Close any open file descriptors
                if 'stdout_fd' in rag_info:
                    try:
                        os.close(rag_info['stdout_fd'])
                    except OSError:
                        pass  # Already closed
                    del rag_info['stdout_fd']
                
                if 'stderr_fd' in rag_info:
                    try:
                        os.close(rag_info['stderr_fd'])
                    except OSError:
                        pass  # Already closed
                    del rag_info['stderr_fd']
                                
                rag_info["status"] = "stopped"
                for key in ["process_id", "pgid", "service_id"]:
                    if key in rag_info:
                        del rag_info[key]
                
            except psutil.NoSuchProcess:
                # Process already not running, just update status and clean up file handles
                logger.info(f"Process {rag_info.get('process_id')} already not running")
                
                # Close any open file descriptors
                if 'stdout_fd' in rag_info:
                    try:
                        os.close(rag_info['stdout_fd'])
                    except OSError:
                        pass  # Already closed
                    del rag_info['stdout_fd']
                
                if 'stderr_fd' in rag_info:
                    try:
                        os.close(rag_info['stderr_fd'])
                    except OSError:
                        pass  # Already closed
                    del rag_info['stderr_fd']
                    
                rag_info["status"] = "stopped"
                for key in ["process_id", "pgid", "service_id"]:
                    if key in rag_info:
                        del rag_info[key]
            except Exception as e:
                logger.error(f"Failed to stop RAG: {str(e)}")
                traceback.print_exc()
                raise HTTPException(
                    status_code=500, detail=f"Failed to stop RAG: {str(e)}"
                )
        else:
            rag_info["status"] = "stopped"
            
            # Clean up any lingering file descriptors
            if 'stdout_fd' in rag_info:
                try:
                    os.close(rag_info['stdout_fd'])
                except OSError:
                    pass  # Already closed
                del rag_info['stdout_fd']
            
            if 'stderr_fd' in rag_info:
                try:
                    os.close(rag_info['stderr_fd'])
                except OSError:
                    pass  # Already closed
                del rag_info['stderr_fd']

    # 确保保存product_type
    if "product_type" not in rag_info:
        rag_info["product_type"] = product_type
        
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

@router.post("/rags/cache/build/{rag_name}")
async def build_cache(rag_name: str):
    """Start building cache (hybrid index) for a RAG service."""
    rags = await load_rags_from_json()
    if rag_name not in rags:
        raise HTTPException(status_code=404, detail=f"RAG {rag_name} not found")
    
    rag_info = rags[rag_name]
    
    # 验证是否为Pro版本且启用了混合索引
    if not rag_info.get("enable_hybrid_index"):
        raise HTTPException(
            status_code=400, 
            detail="Only Pro version RAGs with hybrid index enabled can build cache"
        )
    
    # 创建临时日志文件
    log_file = os.path.join("logs", f"cache_build_{rag_name}_{uuid.uuid4()}.log")
    os.makedirs("logs", exist_ok=True)
    
    # 构建命令
    command = f"auto-coder.rag build_hybrid_index"
    command += f" --model {rag_info['model']}"
    command += f" --doc_dir {rag_info['doc_dir']}"
    
    if "emb_model" in rag_info:
        command += f" --emb_model {rag_info['emb_model']}"

    if "rag_storage_type" in rag_info:
        command += f" --rag_storage_type {rag_info['rag_storage_type']}"
    
    if rag_info.get("required_exts"):
        command += f" --required_exts {rag_info['required_exts']}"
    
    command += f" --enable_hybrid_index"        
    
    logger.info(f"Starting cache build for {rag_name} with command: {command}")
    
    try:
        # 开始后台任务
        with open(log_file, "w") as f:
            f.write(f"Starting cache build for {rag_name}\n")
            f.write(f"Command: {command}\n\n")
        
        task_id = str(uuid.uuid4())
        cache_build_tasks[task_id] = {
            "rag_name": rag_name,
            "command": command,
            "log_file": log_file,
            "start_time": time.time(),
            "completed": False,
            "success": None,
            "process": None
        }
        
        # 启动异步任务
        asyncio.create_task(run_build_task(task_id, command, log_file))
        
        # 将任务ID存储在RAG配置中
        rag_info["cache_build_task_id"] = task_id
        rags[rag_name] = rag_info
        await save_rags_to_json(rags)
        
        return {
            "success": True,
            "message": "Cache build started",
            "task_id": task_id
        }
    except Exception as e:
        logger.error(f"Failed to start cache build: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to start cache build: {str(e)}")

async def run_build_task(task_id, command, log_file):
    """Run the build task in background."""
    task_info = cache_build_tasks[task_id]
    
    try:
        with open(log_file, "a") as f:
            process = await asyncio.create_subprocess_shell(
                command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            task_info["process"] = process
            
            # 实时处理输出并写入日志
            async def read_stream(stream, f):
                while True:
                    line = await stream.readline()
                    if not line:
                        break
                    line_str = line.decode('utf-8') if isinstance(line, bytes) else line
                    f.write(line_str)
                    f.flush()
            
            # 同时处理stdout和stderr
            await asyncio.gather(
                read_stream(process.stdout, f),
                read_stream(process.stderr, f)
            )
            
            # 等待进程完成
            return_code = await process.wait()
            
            # 更新任务状态
            task_info["completed"] = True
            task_info["success"] = return_code == 0
            task_info["return_code"] = return_code
            
            # 添加完成信息到日志
            f.write(f"\nBuild process completed with return code: {return_code}\n")
            if return_code == 0:
                f.write("Cache build completed successfully!\n")
            else:
                f.write("Cache build failed. See above for errors.\n")
            
    except Exception as e:
        logger.error(f"Error running build task: {str(e)}")
        with open(log_file, "a") as f:
            f.write(f"\nError running build task: {str(e)}\n")
            f.write(traceback.format_exc())
        
        task_info["completed"] = True
        task_info["success"] = False
        task_info["error"] = str(e)

@router.get("/rags/cache/logs/{rag_name}")
async def get_build_cache_logs(rag_name: str):
    """Get logs for the cache build process."""
    rags = await load_rags_from_json()
    if rag_name not in rags:
        raise HTTPException(status_code=404, detail=f"RAG {rag_name} not found")
    
    rag_info = rags[rag_name]
    task_id = rag_info.get("cache_build_task_id")
    
    if not task_id or task_id not in cache_build_tasks:
        raise HTTPException(status_code=404, detail="No active cache build task found")
    
    task_info = cache_build_tasks[task_id]
    log_file = task_info["log_file"]
    
    try:
        if os.path.exists(log_file):
            async with aiofiles.open(log_file, mode='r') as f:
                logs = await f.read()
        else:
            logs = "Log file not found"
        
        return {
            "logs": logs,
            "completed": task_info["completed"],
            "success": task_info["success"],
            "start_time": task_info["start_time"],
            "elapsed_time": time.time() - task_info["start_time"]
        }
    except Exception as e:
        logger.error(f"Error reading build logs: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to read build logs: {str(e)}")
