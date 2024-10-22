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
from .request_types import *
from ..storage.json_file import *

router = APIRouter()

@router.post("/chat/conversations/{conversation_id}/messages", response_model=Message)
async def add_message(conversation_id: str, request: AddMessageRequest):
    chat_data = load_chat_data()
    conversation = next(
        (conv for conv in chat_data["conversations"] if conv["id"] == conversation_id),
        None,
    )
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    request.message.timestamp = datetime.now().isoformat()
    conversation["messages"].append(request.message.model_dump())

    list_type = request.list_type
    selected_item = request.selected_item

    # 根据 list_type 和 selected_item 选择合适的模型或 RAG
    try:
        config = load_config()        
        openai_server = config.get("openaiServerList", [{}])[0]
        base_url = f"http://{openai_server.get('host', 'localhost')}:{openai_server.get('port', 8000)}/v1"
        client = AsyncOpenAI(base_url=base_url, api_key="xxxx")

        if list_type == "models":
            response = await client.chat.completions.create(
                model=selected_item,
                messages=[
                    {"role": msg["role"], "content": msg["content"]}
                    for msg in conversation["messages"]
                ],
            )
            assistant_message = response.choices[0].message
        elif list_type == "rags":
            rags = load_rags_from_json()
            if not selected_item in rags:
                logger.error(f"RAG {selected_item} not found")
                raise ValueError(f"RAG {selected_item} not found")

            rag_info = rags.get(selected_item, {})
            openai_server = rag_info.get("host", "localhost")
            port = rag_info.get("port", 8000)
            base_url = f"http://{openai_server}:{port}/v1"
            client = AsyncOpenAI(base_url=base_url, api_key="xxxx")

            response = await client.chat.completions.create(
                model=rag_info.get(
                    "model", "gpt-3.5-turbo"
                ),  # Use a default model if not specified
                messages=[
                    {"role": msg["role"], "content": msg["content"]}
                    for msg in conversation["messages"]
                ],
            )
            assistant_message = response.choices[0].message
        else:
            raise ValueError("Invalid list_type")

        assistant_response = Message(
            role="assistant",
            content=assistant_message.content,
            timestamp=datetime.now().isoformat(),
        )
        conversation["messages"].append(assistant_response.model_dump())
    except Exception as e:
        logger.error(f"Error calling {list_type} service: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Failed to get response from {list_type} service"
        )

    conversation["updated_at"] = datetime.now().isoformat()
    save_chat_data(chat_data)
    return assistant_response

@router.post("/chat/conversations/{conversation_id}/messages/stream", response_model=AddMessageResponse)
async def add_message_stream(conversation_id: str, request: AddMessageRequest):
    request_id = str(uuid.uuid4())
    
    chat_data = load_chat_data()
    conversation = next(
        (conv for conv in chat_data["conversations"] if conv["id"] == conversation_id),
        None,
    )
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    conversation["messages"].append(request.message.model_dump())

    asyncio.create_task(process_message_stream(request_id, request, conversation))
    
    return AddMessageResponse(request_id=request_id)

@router.get("/chat/conversations/events/{request_id}/{index}", response_model=EventResponse)
async def get_message_events(request_id: str, index: int):    
    file_path = get_event_file_path(request_id)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"No events found for request_id: {request_id}")
        
    events = []
    with open(file_path, 'r') as f:
        for line in f:
            event = json.loads(line)
            if event['index'] >= index:
                events.append(event)
    
    return EventResponse(events=events)

async def process_message_stream(request_id: str, request: AddMessageRequest, conversation: Conversation):
    file_path = get_event_file_path(request_id)
    idx = 0
    with open(file_path, 'w') as event_file:    
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
                                
                async for chunk in response:
                    if chunk.choices[0].delta.content:
                        event = {
                            "index": idx,
                            "event": "chunk",
                            "content": chunk.choices[0].delta.content,
                            "timestamp": datetime.now().isoformat()
                        }
                        event_file.write(json.dumps(event,ensure_ascii=False))
                        event_file.flush()
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
                                
                async for chunk in response:
                    if chunk.choices[0].delta.content:
                        event = {
                            "index": idx,
                            "event": "chunk",
                            "content": chunk.choices[0].delta.content,
                            "timestamp": datetime.now().isoformat()
                        }
                        event_file.write(json.dumps(event,ensure_ascii=False))
                        event_file.flush()
                            
                        idx += 1
                        
        except Exception as e:
            # Add error event
            error_event = {
                "index": idx,
                "event": "error",
                "content": str(e),
                "timestamp": datetime.now().isoformat()
            }
            event_file.write(json.dumps(error_event,ensure_ascii=False))
            event_file.flush()
            logger.error(f"Error processing message stream: {str(e)}")
        
        event_file.write(json.dumps({
            "index": idx,
            "event": "done",
            "content": "",
            "timestamp": datetime.now().isoformat()
        },ensure_ascii=False))
        event_file.flush()

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
