from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from typing import Any,List
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
from ..storage.json_file import *
from .chat_router import router as chat_router

app = FastAPI()
app.include_router(chat_router)
from .rag_router import router as rag_router
app.include_router(rag_router)
from .model_router import router as model_router
app.include_router(model_router)
from .openai_service_router import router as openai_service_router
app.include_router(openai_service_router)
from .config_router import router as config_router
app.include_router(config_router)
from .auto_coder_chat_router import router as auto_coder_chat_router
app.include_router(auto_coder_chat_router)
from .super_analysis_router import router as super_analysis_router
app.include_router(super_analysis_router)
# Add CORS middleware with restricted origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict to trusted origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/rags", response_model=List[Dict[str, Any]])
async def list_rags():
    """List all RAGs and their current status."""
    rags = await load_rags_from_json()
    return [{"name": name, **info} for name, info in rags.items()]

# Load supported models from JSON file
supported_models = b_load_models_from_json()

# If the JSON file is empty or doesn't exist, use the default models
if not supported_models:
    supported_models = {
        "deepseek_chat": {
            "status": "stopped",
            "deploy_command": DeployCommand(
                pretrained_model_type="saas/openai",
                worker_concurrency=1000,
                infer_params={
                    "saas.base_url": "https://api.deepseek.com/beta",
                    "saas.api_key": "${MODEL_DEEPSEEK_TOKEN}",
                    "saas.model": "deepseek-chat",
                },
                model="deepseek_chat",
            ).model_dump(),
            "undeploy_command": "byzerllm undeploy --model deepseek_chat",
            "status_command": "byzerllm stat --model deepseek_chat",
        }
    }
    b_save_models_to_json(supported_models)


def deploy_command_to_string(cmd: DeployCommand) -> str:
    base_cmd = f"byzerllm deploy --pretrained_model_type {cmd.pretrained_model_type} "
    base_cmd += f"--cpus_per_worker {cmd.cpus_per_worker} --gpus_per_worker {cmd.gpus_per_worker} "
    base_cmd += f"--num_workers {cmd.num_workers} "

    if cmd.worker_concurrency:
        base_cmd += f"--worker_concurrency {cmd.worker_concurrency} "

    if cmd.infer_params:
        base_cmd += "--infer_params "
        for key, value in cmd.infer_params.items():
            base_cmd += f"""{key}="{value}" """

    base_cmd += f"--model {cmd.model}"

    if cmd.model_path:
        base_cmd += f" --model_path {cmd.model_path}"

    if cmd.infer_backend:
        base_cmd += f" --infer_backend {cmd.infer_backend}"

    return base_cmd


@app.get("/models", response_model=List[ModelInfo])
async def list_models():
    """List all supported models and their current status."""
    models = await load_models_from_json() or supported_models
    return [
        ModelInfo(name=name, status=info["status"])
        for name, info in models.items()
    ]

@app.delete("/models/{model_name}")
async def delete_model(model_name: str):
    """Delete a model from the supported models list."""
    models = await load_models_from_json() or supported_models
    if model_name not in models:
        raise HTTPException(status_code=404, detail=f"Model {model_name} not found")
    
    # Check if the model is running
    if models[model_name]["status"] == "running":
        raise HTTPException(status_code=400, detail="Cannot delete a running model")
    
    # Delete the model from supported_models
    del models[model_name]
    await save_models_to_json(models)
    return {"message": f"Model {model_name} deleted successfully"}


@app.post("/models/add")
async def add_model(model: AddModelRequest):
    """Add a new model to the supported models list."""
    models = await load_models_from_json() or supported_models
    if model.name in models:
        raise HTTPException(
            status_code=400, detail=f"Model {model.name} already exists"
        )

    if model.infer_backend == "saas":
        model.infer_backend = None

    new_model = {
        "status": "stopped",
        "deploy_command": DeployCommand(
            pretrained_model_type=model.pretrained_model_type,
            cpus_per_worker=model.cpus_per_worker,
            gpus_per_worker=model.gpus_per_worker,
            num_workers=model.num_workers,
            worker_concurrency=model.worker_concurrency,
            infer_params=model.infer_params,
            model=model.name,
            model_path=model.model_path,
            infer_backend=model.infer_backend,
        ).model_dump(),
        "undeploy_command": f"byzerllm undeploy --model {model.name}",
    }

    models[model.name] = new_model
    await save_models_to_json(models)
    return {"message": f"Model {model.name} added successfully"}


@app.post("/rags/add")
async def add_rag(rag: AddRAGRequest):
    """Add a new RAG to the supported RAGs list."""
    rags = await load_rags_from_json()
    if rag.name in rags:
        raise HTTPException(status_code=400, detail=f"RAG {rag.name} already exists")

    # Check if the port is already in use by another RAG
    for other_rag in rags.values():
        if other_rag["port"] == rag.port:
            raise HTTPException(
                status_code=400,
                detail=f"Port {rag.port} is already in use by RAG {other_rag['name']}",
            )
    new_rag = {"status": "stopped", **rag.model_dump()}    
    rags[rag.name] = new_rag
    await save_rags_to_json(rags)
    return {"message": f"RAG {rag.name} added successfully"}


@app.post("/rags/{rag_name}/{action}")
async def manage_rag(rag_name: str, action: str):
    """Start or stop a specified RAG."""
    rags = await load_rags_from_json()
    if rag_name not in rags:
        raise HTTPException(status_code=404, detail=f"RAG {rag_name} not found")

    if action not in ["start", "stop"]:
        raise HTTPException(
            status_code=400, detail="Invalid action. Use 'start' or 'stop'"
        )

    rag_info = rags[rag_name]

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
        command += f" --model {rag_info['model']}"
        command += f" --tokenizer_path {rag_info['tokenizer_path']}"
        command += f" --doc_dir {rag_info['doc_dir']}"
        command += f" --rag_doc_filter_relevance {rag_doc_filter_relevance}"
        command += f" --host {rag_info['host'] or '0.0.0.0'}"
        command += f" --port {port}"

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
            if "hybrid_index_max_output_tokens" in rag_info:
                command += f" --hybrid_index_max_output_tokens {rag_info['hybrid_index_max_output_tokens']}"

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

            # Open log files for stdout and stderr using os.path.join
            stdout_log = open(os.path.join("logs", f"{rag_info['name']}.out"), "w")
            stderr_log = open(os.path.join("logs", f"{rag_info['name']}.err"), "w")

            # Use subprocess.Popen to start the process in the background
            process = subprocess.Popen(
                command, shell=True, stdout=stdout_log, stderr=stderr_log
            )
            rag_info["status"] = "running"
            rag_info["process_id"] = process.pid
        except Exception as e:
            logger.error(f"Failed to start RAG: {str(e)}")
            traceback.print_exc()
            raise HTTPException(
                status_code=500, detail=f"Failed to start RAG: {str(e)}"
            )
    else:  # action == "stop"
        if "process_id" in rag_info:
            try:
                os.kill(rag_info["process_id"], signal.SIGTERM)
                rag_info["status"] = "stopped"
                del rag_info["process_id"]
            except ProcessLookupError:
                # Process already terminated
                rag_info["status"] = "stopped"
                del rag_info["process_id"]
            except Exception as e:
                logger.error(f"Failed to stop RAG: {str(e)}")
                traceback.print_exc()
                raise HTTPException(
                    status_code=500, detail=f"Failed to stop RAG: {str(e)}"
                )
        else:
            rag_info["status"] = "stopped"

    rags[rag_name] = rag_info
    await save_rags_to_json(rags)

    return {"message": f"RAG {rag_name} {action}ed successfully"}


@app.get("/rags/{rag_name}/status")
async def get_rag_status(rag_name: str):
    """Get the status of a specified RAG."""
    rags = await load_rags_from_json()
    if rag_name not in rags:
        raise HTTPException(status_code=404, detail=f"RAG {rag_name} not found")

    rag_info = rags[rag_name]

    # Check if the process is running
    is_alive = False
    if "process_id" in rag_info:
        try:
            process = psutil.Process(rag_info["process_id"])
            is_alive = process.is_running()
        except psutil.NoSuchProcess:
            is_alive = False

    # Update the status based on whether the process is alive
    status = "running" if is_alive else "stopped"
    rag_info["status"] = status
    rags[rag_name] = rag_info
    await save_rags_to_json(rags)

    return {
        "rag": rag_name,
        "status": status,
        "process_id": rag_info.get("process_id"),
        "is_alive": is_alive,
        "success": True,
    }


@app.post("/models/{model_name}/{action}")
async def manage_model(model_name: str, action: str):
    """Start or stop a specified model."""
    models = await load_models_from_json() or supported_models
    if model_name not in models:
        raise HTTPException(status_code=404, detail=f"Model {model_name} not found")

    if action not in ["start", "stop"]:
        raise HTTPException(
            status_code=400, detail="Invalid action. Use 'start' or 'stop'"
        )

    model_info = models[model_name]
    command = (
        deploy_command_to_string(DeployCommand(**model_info["deploy_command"]))
        if action == "start"
        else model_info["undeploy_command"]
    )

    try:
        # Execute the command
        logger.info(f"manage model {model_name} with command: {command}")
        result = subprocess.run(
            command, shell=True, check=True, capture_output=True, text=True
        )

        # Check if the command was successful
        if result.returncode == 0:
            # Update model status only if the command was successful
            model_info["status"] = "running" if action == "start" else "stopped"
            models[model_name] = model_info

            # Save updated models to JSON file
            await save_models_to_json(models)

            return {
                "message": f"Model {model_name} {action}ed successfully",
                "output": result.stdout,
            }
        else:
            # If the command failed, raise an exception
            logger.error(f"Failed to {action} model: {result.stderr or result.stdout}")
            traceback.print_exc()
            raise subprocess.CalledProcessError(
                result.returncode, command, result.stdout, result.stderr
            )
    except subprocess.CalledProcessError as e:
        # If an exception occurred, don't update the model status
        error_message = f"Failed to {action} model: {e.stderr or e.stdout}"
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=error_message)


@app.get("/models/{model_name}/status")
async def get_model_status(model_name: str):
    """Get the status of a specified model."""
    models = await load_models_from_json() or supported_models
    if model_name not in models:
        raise HTTPException(status_code=404, detail=f"Model {model_name} not found")

    try:
        # Execute the byzerllm stat command
        command = (
            models[model_name]["status_command"]
            if model_name in models
            and "status_command" in models[model_name]
            else f"byzerllm stat --model {model_name}"
        )
        result = subprocess.run(command, shell=True, capture_output=True, text=True)

        # Check the result status
        if result.returncode == 0:
            status_output = result.stdout.strip()
            models[model_name]["status"] = "running"
            await save_models_to_json(models)
            return {"model": model_name, "status": status_output, "success": True}
        else:
            error_message = f"Command failed with return code {result.returncode}: {result.stderr.strip()}"
            models[model_name]["status"] = "stopped"
            await save_models_to_json(models)
            return {
                "model": model_name,
                "status": "error",
                "error": error_message,
                "success": False,
            }
    except Exception as e:
        error_message = f"Failed to get status for model {model_name}: {str(e)}"
        return {
            "model": model_name,
            "status": "error",
            "error": error_message,
            "success": False,
        }


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
