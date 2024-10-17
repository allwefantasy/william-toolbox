from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn
import httpx
from typing import Optional,Any
import os
import argparse
import aiofiles
import subprocess
from typing import List, Dict
from pydantic import BaseModel, Field
from typing import Optional
import json
import subprocess
import os
import signal
import psutil
from loguru import logger
import subprocess

app = FastAPI()

class AddModelRequest(BaseModel):
    name: str
    pretrained_model_type: str
    cpus_per_worker: float = Field(default=0.001)
    gpus_per_worker: int = Field(default=0)
    num_workers: int = Field(default=1)
    worker_concurrency: Optional[int] = Field(default=None)
    infer_params: dict = Field(default_factory=dict)
    model_path: Optional[str] = Field(default=None)
    infer_backend: Optional[str] = Field(default=None)

class AddRAGRequest(BaseModel):
    name: str
    model: str
    tokenizer_path: str
    doc_dir: str
    rag_doc_filter_relevance: float = Field(default=2.0)

# Path to the models.json file
MODELS_JSON_PATH = "models.json"
RAGS_JSON_PATH = "rags.json"

# Function to load models from JSON file
def load_models_from_json():
    if os.path.exists(MODELS_JSON_PATH):
        with open(MODELS_JSON_PATH, 'r') as f:
            return json.load(f)
    return {}

# Function to save models to JSON file
def save_models_to_json(models):
    with open(MODELS_JSON_PATH, 'w') as f:
        json.dump(models, f, indent=2,ensure_ascii=False)

# Function to load RAGs from JSON file
def load_rags_from_json():
    if os.path.exists(RAGS_JSON_PATH):
        with open(RAGS_JSON_PATH, 'r') as f:
            return json.load(f)
    return {}

# Function to save RAGs to JSON file
def save_rags_to_json(rags):
    with open(RAGS_JSON_PATH, 'w') as f:
        json.dump(rags, f, indent=2,ensure_ascii=False)

@app.get("/rags", response_model=List[Dict[str, Any]])
async def list_rags():
    """List all RAGs and their current status."""
    rags = load_rags_from_json()
    return [{"name": name, **info} for name, info in rags.items()]

# Add CORS middleware with restricted origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict to trusted origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class DeployCommand(BaseModel):
    pretrained_model_type: str
    cpus_per_worker: float = Field(default=0.001)
    gpus_per_worker: int = Field(default=0)
    num_workers: int = Field(default=1)
    worker_concurrency: Optional[int] = Field(default=None)
    infer_params: dict = Field(default_factory=dict)
    model: str
    model_path: Optional[str] = Field(default=None)
    infer_backend: Optional[str] = Field(default=None)
    model_config = {"protected_namespaces": ()}

# Load supported models from JSON file
supported_models = load_models_from_json()

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
                    "saas.model": "deepseek-chat"
                },
                model="deepseek_chat"
            ).model_dump(),
            "undeploy_command": "byzerllm undeploy deepseek_chat",
            "status_command": "byzerllm stat --model deepseek_chat"
        },
        "emb": {
            "status": "stopped",
            "deploy_command": DeployCommand(
                pretrained_model_type="custom/bge",
                worker_concurrency=1000,
                model_path="/home/winubuntu/.auto-coder/storage/models/AI-ModelScope/bge-large-zh",
                infer_backend="transformers",
                model="emb"
            ).model_dump(),
            "undeploy_command": "byzerllm undeploy emb",
            "status_command": "byzerllm stat --model emb"
        }
    }
    save_models_to_json(supported_models)

def deploy_command_to_string(cmd: DeployCommand) -> str:
    base_cmd = f"byzerllm deploy --pretrained_model_type {cmd.pretrained_model_type} "
    base_cmd += f"--cpus_per_worker {cmd.cpus_per_worker} --gpus_per_worker {cmd.gpus_per_worker} "
    base_cmd += f"--num_workers {cmd.num_workers} "
    
    if cmd.worker_concurrency:
        base_cmd += f"--worker_concurrency {cmd.worker_concurrency} "
    
    if cmd.infer_params:
        base_cmd += "--infer_params "
        for key, value in cmd.infer_params.items():
            base_cmd += f'''{key}="{value}" '''
    
    base_cmd += f"--model {cmd.model}"
    
    if cmd.model_path:
        base_cmd += f" --model_path {cmd.model_path}"
    
    if cmd.infer_backend:
        base_cmd += f" --infer_backend {cmd.infer_backend}"
    
    return base_cmd

class ModelInfo(BaseModel):
    name: str
    status: str

@app.get("/models", response_model=List[ModelInfo])
async def list_models():
    """List all supported models and their current status."""
    return [ModelInfo(name=name, status=info["status"]) for name, info in supported_models.items()]

@app.post("/models/add")
async def add_model(model: AddModelRequest):
    """Add a new model to the supported models list."""
    if model.name in supported_models:
        raise HTTPException(status_code=400, detail=f"Model {model.name} already exists")
    
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
            infer_backend=model.infer_backend
        ).model_dump(),
        "undeploy_command": f"byzerllm undeploy {model.name}"
    }
    
    supported_models[model.name] = new_model
    save_models_to_json(supported_models)
    return {"message": f"Model {model.name} added successfully"}

@app.post("/rags/add")
async def add_rag(rag: AddRAGRequest):
    """Add a new RAG to the supported RAGs list."""
    rags = load_rags_from_json()
    if rag.name in rags:
        raise HTTPException(status_code=400, detail=f"RAG {rag.name} already exists")
    
    new_rag = {
        "name": rag.name,
        "status": "stopped",
        "model": rag.model,
        "tokenizer_path": rag.tokenizer_path,
        "doc_dir": rag.doc_dir,
        "rag_doc_filter_relevance": rag.rag_doc_filter_relevance
    }
    
    rags[rag.name] = new_rag
    save_rags_to_json(rags)
    return {"message": f"RAG {rag.name} added successfully"}

@app.post("/rags/{rag_name}/{action}")
async def manage_rag(rag_name: str, action: str):
    """Start or stop a specified RAG."""
    rags = load_rags_from_json()
    if rag_name not in rags:
        raise HTTPException(status_code=404, detail=f"RAG {rag_name} not found")
    
    if action not in ["start", "stop"]:
        raise HTTPException(status_code=400, detail="Invalid action. Use 'start' or 'stop'")
    
    rag_info = rags[rag_name]
    
    if action == "start":
        # Check if the port is already in use by another RAG
        port = rag_info['port'] or 8000
        for other_rag in rags.values():
            if other_rag['name'] != rag_name and other_rag['status'] == 'running' and other_rag['port'] == port:
                raise HTTPException(status_code=400, detail=f"Port {port} is already in use by RAG {other_rag['name']}")

        command = "auto-coder.rag serve"
        command += f" --model {rag_info['model']}"        
        command += f" --tokenizer_path {rag_info['tokenizer_path']}"
        command += f" --doc_dir {rag_info['doc_dir']}"
        command += f" --rag_doc_filter_relevance {int(rag_info['rag_doc_filter_relevance'])}"
        command += f" --host {rag_info['host'] or '0.0.0.0'}"
        command += f" --port {port}"

        logger.info(f"Starting RAG {rag_name} with command: {command}")
        try:
            # Create logs directory if it doesn't exist
            os.makedirs("logs", exist_ok=True)
            
            # Open log files for stdout and stderr
            stdout_log = open(f"logs/{rag_info['name']}.out", "w")
            stderr_log = open(f"logs/{rag_info['name']}.err", "w")
            
            # Use subprocess.Popen to start the process in the background
            process = subprocess.Popen(command, shell=True, stdout=stdout_log, stderr=stderr_log)
            rag_info["status"] = "running"
            rag_info["process_id"] = process.pid                        
        except Exception as e:            
            import traceback
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"Failed to start RAG: {str(e)}")
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
                raise HTTPException(status_code=500, detail=f"Failed to stop RAG: {str(e)}")
        else:
            rag_info["status"] = "stopped"
    
    rags[rag_name] = rag_info
    save_rags_to_json(rags)
    
    return {"message": f"RAG {rag_name} {action}ed successfully"}

@app.get("/rags/{rag_name}/status")
async def get_rag_status(rag_name: str):
    """Get the status of a specified RAG."""
    rags = load_rags_from_json()
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
    save_rags_to_json(rags)
    
    return {
        "rag": rag_name,
        "status": status,
        "process_id": rag_info.get("process_id"),
        "is_alive": is_alive,
        "success": True
    }

@app.post("/models/{model_name}/{action}")
async def manage_model(model_name: str, action: str):
    """Start or stop a specified model."""
    if model_name not in supported_models:
        raise HTTPException(status_code=404, detail=f"Model {model_name} not found")
    
    if action not in ["start", "stop"]:
        raise HTTPException(status_code=400, detail="Invalid action. Use 'start' or 'stop'")
    
    model_info = supported_models[model_name]
    command = deploy_command_to_string(DeployCommand(**model_info["deploy_command"])) if action == "start" else model_info["undeploy_command"]
    
    try:
        # Execute the command
        result = subprocess.run(command, shell=True, check=True, capture_output=True, text=True)
        
        # Check if the command was successful
        if result.returncode == 0:
            # Update model status only if the command was successful
            model_info["status"] = "running" if action == "start" else "stopped"
            supported_models[model_name] = model_info
            
            # Save updated models to JSON file
            save_models_to_json(supported_models)
            
            return {"message": f"Model {model_name} {action}ed successfully", "output": result.stdout}
        else:
            # If the command failed, raise an exception
            raise subprocess.CalledProcessError(result.returncode, command, result.stdout, result.stderr)
    except subprocess.CalledProcessError as e:
        # If an exception occurred, don't update the model status
        error_message = f"Failed to {action} model: {e.stderr or e.stdout}"
        raise HTTPException(status_code=500, detail=error_message)

@app.get("/models/{model_name}/status")
async def get_model_status(model_name: str):
    """Get the status of a specified model."""
    if model_name not in supported_models:
        raise HTTPException(status_code=404, detail=f"Model {model_name} not found")
    
    try:
        # Execute the byzerllm stat command
        command = supported_models[model_name]["status_command"] if model_name in supported_models and "status_command" in supported_models[model_name] else f"byzerllm stat --model {model_name}"        
        result = subprocess.run(command, shell=True, capture_output=True, text=True)
        
        # Check the result status        
        if result.returncode == 0:
            status_output = result.stdout.strip()
            supported_models[model_name]["status"] = "running"
            save_models_to_json(supported_models)
            return {"model": model_name, "status": status_output, "success": True}
        else:
            error_message = f"Command failed with return code {result.returncode}: {result.stderr.strip()}"
            return {"model": model_name, "status": "error", "error": error_message, "success": False}
    except Exception as e:
        error_message = f"Failed to get status for model {model_name}: {str(e)}"
        return {"model": model_name, "status": "error", "error": error_message, "success": False}

def main():
    parser = argparse.ArgumentParser(description="Backend Server")
    parser.add_argument('--port', type=int, default=8005,
                        help='Port to run the backend server on (default: 8005)')
    parser.add_argument('--host', type=str, default="0.0.0.0",
                        help='Host to run the backend server on (default: 0.0.0.0)')    
    args = parser.parse_args()        
    print(f"Starting backend server on {args.host}:{args.port}")
    uvicorn.run(app, host=args.host, port=args.port)

if __name__ == "__main__":
    main()