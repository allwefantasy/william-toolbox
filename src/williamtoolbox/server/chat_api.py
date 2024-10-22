from fastapi import APIRouter, HTTPException
from typing import Optional, Dict, Any
import os
import json
import uuid
import asyncio
from datetime import datetime
from openai import AsyncOpenAI
from loguru import logger
from pydantic import BaseModel

router = APIRouter()

class AddMessageRequest(BaseModel):
    conversation_id: str
    message: Dict[str, Any]
    list_type: str
    selected_item: str

class AddMessageResponse(BaseModel):
    request_id: str

class EventResponse(BaseModel):
    events: list[Dict[str, Any]]

def get_event_file_path(request_id: str) -> str:
    os.makedirs("chat_events", exist_ok=True)
    return f"chat_events/{request_id}.json"

@router.post("/chat/conversations/{conversation_id}/messages/stream", response_model=AddMessageResponse)
async def add_message_stream(conversation_id: str, request: AddMessageRequest):
    request_id = str(uuid.uuid4())
    
    # Start background task to handle the streaming
    asyncio.create_task(process_message_stream(request_id, request))
    
    return AddMessageResponse(request_id=request_id)

@router.get("/chat/conversations/events/{request_id}", response_model=EventResponse)
async def get_message_events(request_id: str):
    file_path = get_event_file_path(request_id)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"No events found for request_id: {request_id}")
        
    with open(file_path, 'r') as f:
        events = json.load(f)
    
    return EventResponse(events=events)

async def process_message_stream(request_id: str, request: AddMessageRequest):
    file_path = get_event_file_path(request_id)
    events = []
    
    try:
        config = load_config()
        if request.list_type == "models":
            openai_server = config.get("openaiServerList", [{}])[0]
            base_url = f"http://{openai_server.get('host', 'localhost')}:{openai_server.get('port', 8000)}/v1"
            client = AsyncOpenAI(base_url=base_url, api_key="xxxx")

            response = await client.chat.completions.create(
                model=request.selected_item,
                messages=[
                    {"role": msg["role"], "content": msg["content"]}
                    for msg in conversation["messages"]
                ],
                stream=True
            )
            
            idx = 0
            async for chunk in response:
                if chunk.choices[0].delta.content:
                    event = {
                        "index": idx,
                        "event": "chunk",
                        "content": chunk.choices[0].delta.content,
                        "timestamp": datetime.now().isoformat()
                    }
                    events.append(event)
                    
                    # Write to file after each chunk
                    with open(file_path, 'w') as f:
                        json.dump(events, f)
                        
                    idx += 1

        elif request.list_type == "rags":
            rags = load_rags_from_json()
            rag_info = rags.get(request.selected_item, {})
            host = rag_info.get("host", "localhost")
            port = rag_info.get("port", 8000)
            base_url = f"http://{host}:{port}/v1"
            
            client = AsyncOpenAI(base_url=base_url, api_key="xxxx")
            response = await client.chat.completions.create(
                model=rag_info.get("model", "gpt-3.5-turbo"),
                messages=[
                    {"role": msg["role"], "content": msg["content"]}
                    for msg in conversation["messages"]
                ],
                stream=True
            )
            
            idx = 0
            async for chunk in response:
                if chunk.choices[0].delta.content:
                    event = {
                        "index": idx,
                        "event": "chunk",
                        "content": chunk.choices[0].delta.content,
                        "timestamp": datetime.now().isoformat()
                    }
                    events.append(event)
                    
                    # Write to file after each chunk
                    with open(file_path, 'w') as f:
                        json.dump(events, f)
                        
                    idx += 1
                    
    except Exception as e:
        # Add error event
        error_event = {
            "index": len(events),
            "event": "error",
            "content": str(e),
            "timestamp": datetime.now().isoformat()
        }
        events.append(error_event)
        with open(file_path, 'w') as f:
            json.dump(events, f)
        logger.error(f"Error processing message stream: {str(e)}")

def load_config():
    config_path = "config.json"
    if os.path.exists(config_path):
        with open(config_path, "r") as f:
            return json.load(f)
    return {}

def load_rags_from_json():
    rags_path = "rags.json"
    if os.path.exists(rags_path):
        with open(rags_path, "r") as f:
            return json.load(f)
    return {}