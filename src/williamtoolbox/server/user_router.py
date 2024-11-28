from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Optional
from .user_manager import UserManager
import os

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

@router.post("/api/login")
async def login(request: LoginRequest):
    success, first_login, permissions = await user_manager.authenticate(request.username, request.password)
    if not success:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return {"success": True, "first_login": first_login, "permissions": permissions}

@router.post("/api/change-password")
async def change_password(request: ChangePasswordRequest):
    try:
        await user_manager.change_password(request.username, request.new_password)
        return {"success": True}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/api/users")
async def get_users():
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
