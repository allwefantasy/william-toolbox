
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn
import httpx
from typing import Optional
import os
import argparse
import aiofiles
import subprocess
from typing import List, Dict
from pydantic import BaseModel

app = FastAPI()

# Add CORS middleware with restricted origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict to trusted origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dictionary to store supported models
supported_models = {
    "deepseek_chat": {
        "status": "stopped",
        "deploy_command": "byzerllm deploy --pretrained_model_type saas/openai --cpus_per_worker 0.001 --gpus_per_worker 0 --num_workers 1 --worker_concurrency 10 --infer_params saas.base_url='https://api.deepseek.com/beta' saas.api_key=${MODEL_DEEPSEEK_TOKEN} saas.model=deepseek-chat --model deepseek_chat",
        "undeploy_command": "byzerllm undeploy deepseek_chat"
    },
    "emb": {
        "status": "stopped",
        "deploy_command": "byzerllm deploy --pretrained_model_type custom/bge --cpus_per_worker 0.001 --gpus_per_worker 0 --worker_concurrency 10 --model_path /home/winubuntu/.auto-coder/storage/models/AI-ModelScope/bge-large-zh --infer_backend transformers --num_workers 1 --model emb",
        "undeploy_command": "byzerllm undeploy emb"
    }
}

class ModelInfo(BaseModel):
    name: str
    status: str

@app.get("/models", response_model=List[ModelInfo])
async def list_models():
    """List all supported models and their current status."""
    return [ModelInfo(name=name, status=info["status"]) for name, info in supported_models.items()]

@app.post("/models/{model_name}/{action}")
async def manage_model(model_name: str, action: str):
    """Start or stop a specified model."""
    if model_name not in supported_models:
        raise HTTPException(status_code=404, detail=f"Model {model_name} not found")
    
    if action not in ["start", "stop"]:
        raise HTTPException(status_code=400, detail="Invalid action. Use 'start' or 'stop'")
    
    model_info = supported_models[model_name]
    command = model_info["deploy_command"] if action == "start" else model_info["undeploy_command"]
    
    try:
        # Execute the command
        result = subprocess.run(command, shell=True, check=True, capture_output=True, text=True)
        
        # Update model status
        model_info["status"] = "running" if action == "start" else "stopped"
        
        return {"message": f"Model {model_name} {action}ed successfully", "output": result.stdout}
    except subprocess.CalledProcessError as e:
        raise HTTPException(status_code=500, detail=f"Failed to {action} model: {e.stderr}")

def main():
    parser = argparse.ArgumentParser(description="Backend Server")
    parser.add_argument('--port', type=int, default=8001,
                        help='Port to run the backend server on (default: 8001)')
    parser.add_argument('--host', type=str, default="0.0.0.0",
                        help='Host to run the backend server on (default: 0.0.0.0)')
    args = parser.parse_args()

    print(f"Starting backend server on {args.host}:{args.port}")
    uvicorn.run(app, host=args.host, port=args.port)

if __name__ == "__main__":
    main()