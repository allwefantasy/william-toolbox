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
from typing import Optional, List
import json
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
from openai import AsyncOpenAI
import json

app = FastAPI()
# Add CORS middleware with restricted origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict to trusted origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Path to the chat.json file
CHAT_JSON_PATH = "chat.json"

# Function to load chat data from JSON file
def load_chat_data():
    if os.path.exists(CHAT_JSON_PATH):
        with open(CHAT_JSON_PATH, 'r') as f:
            return json.load(f)
    return {"conversations": []}

# Function to save chat data to JSON file
def save_chat_data(data):
    with open(CHAT_JSON_PATH, 'w') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

# Chat-related models
class Message(BaseModel):
    role: str
    content: str
    timestamp: str

class Conversation(BaseModel):
    id: str
    title: str
    created_at: str
    updated_at: str
    messages: List[Message]

class ChatData(BaseModel):
    conversations: List[Conversation]


# Add this function to load the config
def load_config():
    config_path = "config.json"
    if os.path.exists(config_path):
        with open(config_path, 'r') as f:
            return json.load(f)
    return {}

# Add this new endpoint
@app.get("/config")
async def get_config():
    """Get the configuration information."""
    config = load_config()
    return config

@app.post("/config")
async def add_config_item(item: dict):
    """Add a new configuration item."""
    config = load_config()
    for key, value in item.items():
        if key in config:
            config[key].extend(value)
        else:
            config[key] = value
    save_config(config)
    return {"message": "Configuration item added successfully"}

@app.put("/config/{key}")
async def update_config_item(key: str, item: dict):
    """Update an existing configuration item."""
    config = load_config()
    if key not in config:
        raise HTTPException(status_code=404, detail="Configuration item not found")
    
    updated_items = item.get(key, [])
    if not isinstance(updated_items, list):
        raise HTTPException(status_code=400, detail="Invalid data format")
    
    # Update existing items and add new ones
    existing_values = {i['value'] for i in config[key]}
    for updated_item in updated_items:
        if updated_item['value'] in existing_values:
            for i, existing_item in enumerate(config[key]):
                if existing_item['value'] == updated_item['value']:
                    config[key][i] = updated_item
                    break
        else:
            config[key].append(updated_item)
    
    save_config(config)
    return {"message": "Configuration items updated successfully"}

@app.delete("/config/{key}")
async def delete_config_item(key: str):
    """Delete a configuration item."""
    config = load_config()
    if key not in config:
        raise HTTPException(status_code=404, detail="Configuration item not found")
    del config[key]
    save_config(config)
    return {"message": "Configuration item deleted successfully"}

@app.post("/openai-compatible-service/start")
async def start_openai_compatible_service(host: str = "0.0.0.0", port: int = 8000):
    config = load_config()
    if 'openaiServerList' in config and config['openaiServerList']:
        return {"message": "OpenAI compatible service is already running"}
    
    command = f"byzerllm serve --ray_address auto --host {host} --port {port}"
    try:
        # Create logs directory if it doesn't exist
        os.makedirs("logs", exist_ok=True)
        
        # Open log files for stdout and stderr
        stdout_log = open(os.path.join("logs", "openai_compatible_service.out"), "w")
        stderr_log = open(os.path.join("logs", "openai_compatible_service.err"), "w")
        
        # Use subprocess.Popen to start the process in the background
        process = subprocess.Popen(command.split(), stdout=stdout_log, stderr=stderr_log)
        logger.info(f"OpenAI compatible service started with PID: {process.pid}")
        
        # Update config.json with the new server information
        if 'openaiServerList' not in config:
            config['openaiServerList'] = []
        config['openaiServerList'].append({
            'host': host,
            'port': port,
            'pid': process.pid
        })
        save_config(config)
        
        return {"message": "OpenAI compatible service started successfully", "pid": process.pid}
    except Exception as e:
        logger.error(f"Failed to start OpenAI compatible service: {str(e)}")
        traceback.print_exc()
        return {"error": f"Failed to start OpenAI compatible service: {str(e)}"}

@app.post("/openai-compatible-service/stop")
async def stop_openai_compatible_service():
    config = load_config()
    if 'openaiServerList' not in config or not config['openaiServerList']:
        return {"message": "OpenAI compatible service is not running"}
    
    try:
        for server in config['openaiServerList']:
            try:
                process = psutil.Process(server['pid'])
                for child in process.children(recursive=True):
                    child.terminate()
                process.terminate()
            except psutil.NoSuchProcess:
                logger.warning(f"Process with PID {server['pid']} not found")
        
        config['openaiServerList'] = []
        save_config(config)
        return {"message": "OpenAI compatible service stopped successfully"}
    except Exception as e:
        return {"error": f"Failed to stop OpenAI compatible service: {str(e)}"}

@app.get("/openai-compatible-service/status")
async def get_openai_compatible_service_status():
    config = load_config()
    is_running = 'openaiServerList' in config and len(config['openaiServerList']) > 0
    return {"isRunning": is_running}

def save_config(config):
    """Save the configuration to file."""
    with open("config.json", 'w') as f:
        json.dump(config, f, indent=2,ensure_ascii=False)

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
    host: str = Field(default="0.0.0.0")
    port: int = Field(default=8000)
    required_exts: str = Field(default="")
    disable_inference_enhance: bool = Field(default=False)
    inference_deep_thought: bool = Field(default=False)

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
            "undeploy_command": "byzerllm undeploy --model deepseek_chat",
            "status_command": "byzerllm stat --model deepseek_chat"
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
            infer_backend=model.infer_backend
        ).model_dump(),
        "undeploy_command": f"byzerllm undeploy --model {model.name}"
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
    
    # Check if the port is already in use by another RAG    
    for other_rag in rags.values():        
        if other_rag['port'] == rag.port:
            raise HTTPException(status_code=400, detail=f"Port {rag.port} is already in use by RAG {other_rag['name']}")
    new_rag = {        
        "status": "stopped",
        **rag.model_dump()        
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
            if other_rag['name'] != rag_name and other_rag['port'] == port:
                raise HTTPException(status_code=400, detail=f"Port {port} is already in use by RAG {other_rag['name']}")
         
        rag_doc_filter_relevance = int(rag_info['rag_doc_filter_relevance'])
        command = "auto-coder.rag serve"
        command += f" --model {rag_info['model']}"        
        command += f" --tokenizer_path {rag_info['tokenizer_path']}"
        command += f" --doc_dir {rag_info['doc_dir']}"
        command += f" --rag_doc_filter_relevance {rag_doc_filter_relevance}"
        command += f" --host {rag_info['host'] or '0.0.0.0'}"
        command += f" --port {port}"

        if rag_info['required_exts']:
            command += f" --required_exts {rag_info['required_exts']}"
        if rag_info['disable_inference_enhance']:
            command += f" --disable_inference_enhance"
        if rag_info['inference_deep_thought']:
            command += f" --inference_deep_thought"

        logger.info(f"manage rag {rag_name} with command: {command}")
        try:
            # Create logs directory if it doesn't exist
            os.makedirs("logs", exist_ok=True)
            
            # Open log files for stdout and stderr using os.path.join
            stdout_log = open(os.path.join("logs", f"{rag_info['name']}.out"), "w")
            stderr_log = open(os.path.join("logs", f"{rag_info['name']}.err"), "w")
            
            # Use subprocess.Popen to start the process in the background
            process = subprocess.Popen(command, shell=True, stdout=stdout_log, stderr=stderr_log)
            rag_info["status"] = "running"
            rag_info["process_id"] = process.pid                        
        except Exception as e:            
            logger.error(f"Failed to start RAG: {str(e)}")            
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
                logger.error(f"Failed to stop RAG: {str(e)}")
                traceback.print_exc()  
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
        logger.info(f"manage model {model_name} with command: {command}")
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
            logger.error(f"Failed to {action} model: {result.stderr or result.stdout}")
            traceback.print_exc()  
            raise subprocess.CalledProcessError(result.returncode, command, result.stdout, result.stderr)
    except subprocess.CalledProcessError as e:
        # If an exception occurred, don't update the model status
        error_message = f"Failed to {action} model: {e.stderr or e.stdout}"
        traceback.print_exc()  
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

# Path to the chat.json file
CHAT_JSON_PATH = "chat.json"

# Function to load chat data from JSON file
def load_chat_data():
    if os.path.exists(CHAT_JSON_PATH):
        with open(CHAT_JSON_PATH, 'r') as f:
            return json.load(f)
    return {"conversations": []}

# Function to save chat data to JSON file
def save_chat_data(data):
    with open(CHAT_JSON_PATH, 'w') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

# Chat-related models
class Message(BaseModel):
    role: str
    content: str
    timestamp: str

class Conversation(BaseModel):
    id: str
    title: str
    created_at: str
    updated_at: str
    messages: List[Message]

class ChatData(BaseModel):
    conversations: List[Conversation]

# Chat-related API endpoints
@app.get("/chat/conversations", response_model=List[Conversation])
async def get_conversations():
    chat_data = load_chat_data()
    return chat_data["conversations"]

@app.post("/chat/conversations", response_model=Conversation)
async def create_conversation(title: str):
    chat_data = load_chat_data()
    new_conversation = Conversation(
        id=str(uuid.uuid4()),
        title=title,
        created_at=datetime.now().isoformat(),
        updated_at=datetime.now().isoformat(),
        messages=[]
    )
    chat_data["conversations"].append(new_conversation.dict())
    save_chat_data(chat_data)
    return new_conversation

@app.get("/chat/conversations/{conversation_id}", response_model=Conversation)
async def get_conversation(conversation_id: str):
    chat_data = load_chat_data()
    conversation = next((conv for conv in chat_data["conversations"] if conv["id"] == conversation_id), None)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversation

@app.post("/chat/conversations/{conversation_id}/messages", response_model=Message)
async def add_message(conversation_id: str, message: Message, list_type: str, selected_item: str):
    chat_data = load_chat_data()
    conversation = next((conv for conv in chat_data["conversations"] if conv["id"] == conversation_id), None)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    message.timestamp = datetime.now().isoformat()
    conversation["messages"].append(message.model_dump())

    # 根据 list_type 和 selected_item 选择合适的模型或 RAG
    try:
        config = load_config()
        base_url = config.get('openaiServerList', [{}])[0].get('host', 'http://localhost:8000/v1')
        openai_server = config.get('openaiServerList', [{}])[0]
        base_url = f"http://{openai_server.get('host', 'localhost')}:{openai_server.get('port', 8000)}/v1"        
        client = AsyncOpenAI(base_url=base_url, api_key="xxxx")
        
        if list_type == "models":
            response = await client.chat.completions.create(
                model=selected_item,
                messages=[{"role": msg["role"], "content": msg["content"]} for msg in conversation["messages"]]
            )
            assistant_message = response.choices[0].message
        elif list_type == "rags":
            rags = load_rags_from_json()
            if not selected_item in rags:
                logger.error(f"RAG {selected_item} not found")
                raise ValueError(f"RAG {selected_item} not found")
            
            rag_info = rags.get(selected_item, {})            
            openai_server = rag_info.get('host', 'localhost')
            port = rag_info.get('port', 8000)
            base_url = f"http://{openai_server}:{port}/v1"
            client = AsyncOpenAI(base_url=base_url, api_key="xxxx")
            
            response = await client.chat.completions.create(
                model=rag_info.get('model', 'gpt-3.5-turbo'),  # Use a default model if not specified
                messages=[{"role": msg["role"], "content": msg["content"]} for msg in conversation["messages"]]                            
            )
            assistant_message = response.choices[0].message
        else:
            raise ValueError("Invalid list_type")

        assistant_response = Message(
            role="assistant",
            content=assistant_message.content,
            timestamp=datetime.now().isoformat()
        )
        conversation["messages"].append(assistant_response.dict())
    except Exception as e:
        logger.error(f"Error calling {list_type} service: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get response from {list_type} service")

    conversation["updated_at"] = datetime.now().isoformat()
    save_chat_data(chat_data)
    return message

@app.delete("/chat/conversations/{conversation_id}")
async def delete_conversation(conversation_id: str):
    chat_data = load_chat_data()
    chat_data["conversations"] = [conv for conv in chat_data["conversations"] if conv["id"] != conversation_id]
    save_chat_data(chat_data)
    return {"message": "Conversation deleted successfully"}

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