from fastapi import APIRouter, Depends, HTTPException, Security
from fastapi.security import APIKeyHeader
from typing import Optional
import uuid
from datetime import datetime, timedelta
from ..storage.json_file import load_api_keys, save_api_keys, create_api_key, revoke_api_key, verify_api_key
from loguru import logger

router = APIRouter()

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

async def get_api_key(api_key: str = Security(api_key_header)):
    if not api_key:
        raise HTTPException(
            status_code=401, 
            detail="API key is required"
        )
    
    if not await verify_api_key(api_key):
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired API key"
        )
    return api_key

class CreateAPIKeyRequest(BaseModel):
    name: str
    description: Optional[str] = None
    expires_in_days: Optional[int] = 30

class APIKeyInfo(BaseModel):
    key: str
    name: str
    description: Optional[str]
    created_at: str
    expires_at: str
    is_active: bool

@router.post("/api-keys", response_model=APIKeyInfo)
async def create_api_key_endpoint(request: CreateAPIKeyRequest):
    """Create a new API key"""
    try:
        api_key_info = await create_api_key(
            name=request.name,
            description=request.description,
            expires_in_days=request.expires_in_days
        )
        return api_key_info
    except Exception as e:
        logger.error(f"Failed to create API key: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to create API key"
        )

@router.get("/api-keys", response_model=list[APIKeyInfo])
async def list_api_keys():
    """List all API keys"""
    try:
        api_keys = await load_api_keys()
        return list(api_keys.values())
    except Exception as e:
        logger.error(f"Failed to list API keys: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to list API keys"
        )

@router.delete("/api-keys/{key}")
async def revoke_api_key_endpoint(key: str):
    """Revoke an API key"""
    try:
        await revoke_api_key(key)
        return {"message": "API key revoked successfully"}
    except Exception as e:
        logger.error(f"Failed to revoke API key: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to revoke API key"
        )

@router.get("/protected-endpoint")
async def protected_endpoint(api_key: str = Depends(get_api_key)):
    """Example protected endpoint"""
    return {"message": "You have access to this protected endpoint"}