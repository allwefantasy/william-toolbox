from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
import uuid
from datetime import datetime, timedelta
from ..storage.json_file import load_api_keys, save_api_keys, create_api_key, revoke_api_key, verify_api_key
from loguru import logger
from pydantic import BaseModel
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from .auth import verify_token
from .user_manager import UserManager
from .openai_service_router import get_openai_compatible_service_status
from ..storage.json_file import load_config

router = APIRouter()
security = HTTPBearer()
user_manager = UserManager()

async def verify_admin(token_payload: dict = Depends(verify_token)):
    """Verify if user is admin"""
    username = token_payload.get("username")
    if not username:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    users = await user_manager.get_users()
    user = users.get(username)
    if not user or not user.get("is_admin", False):
        raise HTTPException(status_code=403, detail="Admin privileges required")
    
    return token_payload

async def get_api_key(credentials: HTTPAuthorizationCredentials = Depends(security)):    
    if credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication scheme"
        )
    
    api_key = credentials.credentials
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

@router.post("/api-keys")
async def create_api_key_endpoint(request: CreateAPIKeyRequest, token_payload: dict = Depends(verify_admin)):
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

@router.get("/api-keys")
async def list_api_keys(token_payload: dict = Depends(verify_admin)):
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
async def revoke_api_key_endpoint(key: str, token_payload: dict = Depends(verify_admin)):
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

@router.get("/api/public/openai-compatible-service-info")
async def get_openai_compatible_service_info():
    """Get OpenAI compatible service information"""
    try:        
        config = await load_config()
        status = await get_openai_compatible_service_status()
        
        if "openaiServerList" in config and len(config["openaiServerList"]) > 0:
            server = config["openaiServerList"][0]
            return {
                "host": server["host"],
                "port": server["port"],
                "isRunning": status["isRunning"]
            }
        return {
            "host": None,
            "port": None,
            "isRunning": False
        }
    except Exception as e:
        logger.error(f"Failed to get OpenAI compatible service info: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to get OpenAI compatible service info"
        )

@router.get("/api/public/available-rags")
async def get_available_rags(api_key: str = Depends(get_api_key)):
    """Get available RAGs list"""
    try:
        from .rag_router import list_rags
        return await list_rags()
    except Exception as e:
        logger.error(f"Failed to get RAGs list: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to get RAGs list"
        )

@router.get("/api/public/available-models")
async def get_available_models(api_key: str = Depends(get_api_key)):
    """Get available models list"""
    try:
        from .model_router import list_models
        return await list_models()
    except Exception as e:
        logger.error(f"Failed to get models list: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to get models list"
        )