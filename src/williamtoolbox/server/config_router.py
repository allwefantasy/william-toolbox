from fastapi import APIRouter, HTTPException
from typing import Optional, Dict, Any
from loguru import logger
from ..storage.json_file import *
from .request_types import *
from datetime import datetime

router = APIRouter()

@router.get("/config")
async def get_config():
    """Get the configuration information."""
    config = await load_config()
    return config

@router.post("/config")
async def add_config_item(item: dict):
    """Add a new configuration item."""
    config = await load_config()
    for key, value in item.items():
        if key in config:
            config[key].extend(value)
        else:
            config[key] = value
    await save_config(config)
    return {"message": "Configuration item added successfully"}

@router.put("/config/{key}")
async def update_config_item(key: str, item: dict):
    """Update an existing configuration item."""
    config = await load_config()
    if key not in config:
        raise HTTPException(status_code=404, detail="Configuration item not found")

    updated_items = item.get(key, [])
    if not isinstance(updated_items, list):
        raise HTTPException(status_code=400, detail="Invalid data format")

    # Update existing items and add new ones
    existing_values = {i["value"] for i in config[key]}
    for updated_item in updated_items:
        if updated_item["value"] in existing_values:
            for i, existing_item in enumerate(config[key]):
                if existing_item["value"] == updated_item["value"]:
                    config[key][i] = updated_item
                    break
        else:
            config[key].append(updated_item)

    await save_config(config)
    return {"message": "Configuration items updated successfully"}

@router.delete("/config/{key}")
async def delete_config_item(key: str):
    """Delete a configuration item."""
    config = await load_config()
    if key not in config:
        raise HTTPException(status_code=404, detail="Configuration item not found")
    del config[key]
    await save_config(config)
    return {"message": "Configuration item deleted successfully"}