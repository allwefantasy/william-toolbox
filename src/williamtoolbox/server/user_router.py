from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import List, Dict, Optional
from .user_manager import UserManager
import os
import jwt
from functools import wraps

security = HTTPBearer()

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=401,
            detail="Token has expired"
        )
    except jwt.JWTError:
        raise HTTPException(
            status_code=401,
            detail="Invalid token"
        )

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
    permissions: List[str]

import jwt
import time

# 添加JWT密钥
JWT_SECRET = "your-secret-key"  # 在实际应用中应该从环境变量或配置文件中读取
JWT_ALGORITHM = "HS256"

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
async def add_user(request: AddUserRequest):
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
async def delete_user(username: str):
    try:
        await user_manager.delete_user(username)
        return {"success": True}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/api/users/{username}/permissions")
async def update_permissions(username: str, request: UpdatePermissionsRequest):
    try:
        await user_manager.update_permissions(username, request.permissions)
        return {"success": True}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
