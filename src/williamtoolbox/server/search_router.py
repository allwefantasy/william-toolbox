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
from byzerllm.utils.client import code_utils
from autocoder.utils.stream_thinking import stream_with_thinking_async, separate_stream_thinking_async

router = APIRouter()


@router.post(
    "/chat/search/messages/stream",
    response_model=AddMessageResponse,
)
async def add_message_stream(username: str, request: AddMessageRequest):
    request_id = str(uuid.uuid4())    
    response_message_id = str(uuid.uuid4())

    asyncio.create_task(
        process_message_stream(
            username, request_id, request, response_message_id
        )
    )

    return AddMessageResponse(
        request_id=request_id, response_message_id=response_message_id
    )


@router.get(
    "/chat/search/events/{request_id}/{index}", response_model=EventResponse
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
    username: str,
    request_id: str,
    request: AddMessageRequest,
    response_message_id: str,
):
    file_path = await get_event_file_path(request_id)
    idx = 0
    thoughts = []
    async with aiofiles.open(file_path, "w") as event_file:
        try:            
            if request.list_type == "rags":
                rags = await load_rags_from_json()
                rag_info = rags.get(request.selected_item, {})
                host = rag_info.get("host", "localhost")
                port = rag_info.get("port", 8000)
                if host == "0.0.0.0":
                    host = "127.0.0.1"

                base_url = f"http://{host}:{port}/v1"

                logger.info(f"RAG {request.selected_item} is using {base_url}")                
                client = AsyncOpenAI(base_url=base_url, api_key="xxxx")
                                

                response = await client.chat.completions.create(
                    model=rag_info.get("model", "deepseek_chat"),
                    messages=[
                            {"role": msg.role, "content": msg.content}
                            for msg in request.messages
                    ],
                    stream=True,
                    max_tokens=8096,
                    extra_body={
                        "extra_body": {
                            "only_contexts": True
                        }
                    },
                )
                thinking_gen,content_gen = await separate_stream_thinking_async(response)
                async for chunk in thinking_gen:
                    if chunk:
                        event = {
                            "index": idx,
                            "event": "thought",
                            "content": chunk,
                            "timestamp": datetime.now().isoformat(),
                        }
                        await event_file.write(
                            json.dumps(event, ensure_ascii=False) + "\n"
                        )
                        await event_file.flush()

                        idx += 1
                async for chunk in content_gen:
                    if chunk:
                        event = {
                            "index": idx,
                            "event": "chunk",                                
                            "content": chunk,
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
    
