from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Dict, Optional
from .user_manager import UserManager
from .auth import verify_token, JWT_SECRET, JWT_ALGORITHM
import os
import time
from functools import wraps
import jwt

router = APIRouter()
user_manager = UserManager()

class LoginRequest(BaseModel):
    username: str
    password: str

class ChangePasswordRequest(BaseModel):
    username: str
    new_password: str

class AddUserRequest(BaseModel):
    username: str
    password: str
    permissions: List[str]
    is_admin: bool = False

class UpdatePermissionsRequest(BaseModel):
    username: str
    page_permissions: List[str] = []
    model_permissions: List[str] = []
    rag_permissions: List[str] = []



# 添加JWT密钥


@router.post("/api/login")
async def login(request: LoginRequest):
    success, first_login, permissions = await user_manager.authenticate(request.username, request.password)
    if not success:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # 生成 access token
    payload = {
        "username": request.username,
        "permissions": permissions,
        "exp": time.time() + 24 * 60 * 60  # 24小时过期
    }
    access_token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    
    return {
        "success": True, 
        "first_login": first_login, 
        "permissions": permissions,
        "access_token": access_token
    }

@router.post("/api/change-password")
async def change_password(request: ChangePasswordRequest):
    try:
        await user_manager.change_password(request.username, request.new_password)
        return {"success": True}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/api/users")
async def get_users(token_payload: dict = Depends(verify_token)):
    return await user_manager.get_users()

@router.post("/api/users")
async def add_user(request: AddUserRequest, token_payload: dict = Depends(verify_token)):
    try:
        await user_manager.add_user(
            request.username,
            request.password,
            request.permissions,
            request.is_admin
        )
        return {"success": True}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/api/users/{username}")
async def delete_user(username: str,token_payload: dict = Depends(verify_token), ):
    try:
        await user_manager.delete_user(username)
        return {"success": True}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/api/users/{username}/page_permissions")
async def update_page_permissions(username: str, request: UpdatePermissionsRequest, token_payload: dict = Depends(verify_token)):
    try:
        await user_manager.update_page_permissions(username, request.page_permissions)
        return {"success": True}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/api/users/{username}/model_permissions")
async def update_model_permissions(username: str, request: UpdatePermissionsRequest, token_payload: dict = Depends(verify_token)):
    try:
        await user_manager.update_model_permissions(username, request.model_permissions)
        return {"success": True}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/api/users/{username}/rag_permissions")
async def update_rag_permissions(username: str, request: UpdatePermissionsRequest, token_payload: dict = Depends(verify_token)):
    try:
        await user_manager.update_rag_permissions(username, request.rag_permissions)
        return {"success": True}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

