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
import aiofiles
import traceback

router = APIRouter()


@router.post("/chat/conversations/{conversation_id}/messages", response_model=Message)
async def add_message(conversation_id: str, request: AddMessageRequest):
    chat_data = await load_chat_data()
    conversation = next(
        (conv for conv in chat_data["conversations"] if conv["id"] == conversation_id),
        None,
    )
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Instead of appending the last message, we use the full messages list from the request
    # Add timestamp to the last user message
    request.messages[-1]["timestamp"] = datetime.now().isoformat()
    # Replace the entire conversation messages with the new messages
    conversation["messages"] = [msg.model_dump() for msg in request.messages]

    list_type = request.list_type
    selected_item = request.selected_item

    # 根据 list_type 和 selected_item 选择合适的模型或 RAG
    try:
        config = await load_config()
        if list_type == "models":
            openai_server = config.get("openaiServerList", [{}])[0]
            base_url = f"http://{openai_server.get('host', 'localhost')}:{openai_server.get('port', 8000)}/v1"
            client = AsyncOpenAI(base_url=base_url, api_key="xxxx")

            response = await client.chat.completions.create(
                model=selected_item,
                messages=[
                    {"role": msg["role"], "content": msg["content"]}
                    for msg in request.messages
                ],
                max_tokens=4096,
            )
            assistant_message = response.choices[0].message
        elif list_type == "rags":
            rags = await load_rags_from_json()
            if not selected_item in rags:
                logger.error(f"RAG {selected_item} not found")
                raise ValueError(f"RAG {selected_item} not found")

            rag_info = rags.get(selected_item, {})
            host = rag_info.get("host", "localhost")
            port = rag_info.get("port", 8000)
            base_url = f"http://{host}:{port}/v1"
            client = AsyncOpenAI(base_url=base_url, api_key="xxxx")

            response = await client.chat.completions.create(
                model=rag_info.get(
                    "model", "gpt-3.5-turbo"
                ),  # Use a default model if not specified
                messages=[
                    {"role": msg["role"], "content": msg["content"]}
                    for msg in request.messages
                ],
                max_tokens=4096,
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
    await save_chat_data(chat_data)
    return assistant_response


@router.post(
    "/chat/conversations/{conversation_id}/messages/stream",
    response_model=AddMessageResponse,
)
async def add_message_stream(conversation_id: str, request: AddMessageRequest):
    request_id = str(uuid.uuid4())

    chat_data = await load_chat_data()
    conversation = next(
        (conv for conv in chat_data["conversations"] if conv["id"] == conversation_id),
        None,
    )
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Replace the entire conversation messages with the full message history
    conversation["messages"] = [msg.model_dump() for msg in request.messages]
    await save_chat_data(chat_data)
    response_message_id = str(uuid.uuid4())

    asyncio.create_task(
        process_message_stream(
            request_id, request, conversation, response_message_id, chat_data=chat_data
        )
    )

    return AddMessageResponse(
        request_id=request_id, response_message_id=response_message_id
    )


@router.get(
    "/chat/conversations/events/{request_id}/{index}", response_model=EventResponse
)
async def get_message_events(request_id: str, index: int):
    file_path = await get_event_file_path(request_id)
    if not os.path.exists(file_path):
        raise HTTPException(
            status_code=404, detail=f"No events found for request_id: {request_id}"
        )

    events = []
    if not os.path.exists(file_path):
        return EventResponse(events=[])

    with open(file_path, "r") as f:
        for line in f:
            event = json.loads(line)
            if event["index"] >= index:
                events.append(event)

    return EventResponse(events=events)


async def process_message_stream(
    request_id: str,
    request: AddMessageRequest,
    conversation: Conversation,
    response_message_id: str,
    chat_data: ChatData,
):
    file_path = await get_event_file_path(request_id)
    idx = 0
    async with aiofiles.open(file_path, "w") as event_file:
        try:
            config = await load_config()
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
                    stream=True,
                    max_tokens=4096,
                )

                async for chunk in response:
                    if chunk.choices[0].delta.content:
                        event = {
                            "index": idx,
                            "event": "chunk",
                            "content": chunk.choices[0].delta.content,
                            "timestamp": datetime.now().isoformat(),
                        }
                        await event_file.write(
                            json.dumps(event, ensure_ascii=False) + "\n"
                        )
                        await event_file.flush()
                        idx += 1

            elif request.list_type == "rags":
                rags = await load_rags_from_json()
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
                    stream=True,
                    max_tokens=4096,
                )

                async for chunk in response:
                    if chunk.choices[0].delta.content:
                        event = {
                            "index": idx,
                            "event": "chunk",
                            "content": chunk.choices[0].delta.content,
                            "timestamp": datetime.now().isoformat(),
                        }
                        await event_file.write(
                            json.dumps(event, ensure_ascii=False) + "\n"
                        )
                        await event_file.flush()

                        idx += 1

        except Exception as e:
            # Add error event
            error_event = {
                "index": idx,
                "event": "error",
                "content": str(e),
                "timestamp": datetime.now().isoformat(),
            }
            await event_file.write(json.dumps(error_event, ensure_ascii=False) + "\n")
            await event_file.flush()
            logger.error(traceback.format_exc())

        await event_file.write(
            json.dumps(
                {
                    "index": idx,
                    "event": "done",
                    "content": "",
                    "timestamp": datetime.now().isoformat(),
                },
                ensure_ascii=False,
            )
            + "\n"
        )
        await event_file.flush()

    s = ""
    async with aiofiles.open(file_path, "r") as event_file:
        async for line in event_file:
            event = json.loads(line)
            if event["event"] == "chunk":
                s += event["content"]

    # Add the assistant's response to the messages list
    conversation["messages"] = [msg.model_dump() for msg in request.messages] + [
        {
            "id": response_message_id,
            "role": "assistant",
            "content": s,
            "timestamp": datetime.now().isoformat(),
        }
    ]
    await save_chat_data(chat_data)


@router.put("/chat/conversations/{conversation_id}")
async def update_conversation(conversation_id: str, request: Conversation):
    """Update an existing conversation with new data."""
    chat_data = await load_chat_data()
    
    # Find and update the conversation
    for conv in chat_data["conversations"]:
        if conv["id"] == conversation_id:
            logger.info(f"Updating conversation {conversation_id}")
            conv.update({
                "title": request.title,
                "messages": [msg.model_dump() for msg in request.messages],
                "updated_at": datetime.now().isoformat()
            })
            await save_chat_data(chat_data)
            return conv
            
    raise HTTPException(status_code=404, detail="Conversation not found")

@router.put("/chat/conversations/{conversation_id}/title")
async def update_conversation_title(conversation_id: str, request: UpdateTitleRequest):
    """Update only the title of an existing conversation."""
    chat_data = await load_chat_data()
    
    # Find and update the conversation title
    for conv in chat_data["conversations"]:
        if conv["id"] == conversation_id:
            logger.info(f"Updating title for conversation {conversation_id}")
            conv["title"] = request.title
            conv["updated_at"] = datetime.now().isoformat()
            await save_chat_data(chat_data)
            return {"message": "Title updated successfully", "title": request.title}
            
    raise HTTPException(status_code=404, detail="Conversation not found")

@router.delete("/chat/conversations/{conversation_id}")
async def delete_conversation(conversation_id: str):
    chat_data = await load_chat_data()
    chat_data["conversations"] = [
        conv for conv in chat_data["conversations"] if conv["id"] != conversation_id
    ]
    await save_chat_data(chat_data)
    return {"message": "Conversation deleted successfully"}
