import json
import os
import hashlib
from typing import Dict, List, Optional
import aiofiles
from ..storage.json_file import with_file_lock


class UserManager:
    def __init__(self):
        self.user_file = "./users.json"
        self._ensure_user_file()

    def _ensure_user_file(self):
        if not os.path.exists(self.user_file):
            with open(self.user_file, 'w') as f:
                json.dump({
                    "admin": {
                        "password": "admin",
                        "is_admin": True,
                        "first_login": True,
                        "permissions": ["*"],
                        "model_permissions": ["*"],
                        "rag_permissions": ["*"]
                    }
                }, f, indent=2)

    def _hash_password(self, password: str) -> str:
        return hashlib.sha256(password.encode()).hexdigest()

    async def _load_users(self) -> Dict:
        async with with_file_lock(self.user_file):
            if os.path.exists(self.user_file):
                async with aiofiles.open(self.user_file, "r") as f:
                    content = await f.read()
                    return json.loads(content)
            return {}

    async def _save_users(self, users: Dict):
        async with with_file_lock(self.user_file):
            async with aiofiles.open(self.user_file, "w") as f:
                content = json.dumps(users, indent=2, ensure_ascii=False)
                await f.write(content)

    async def authenticate(self, username: str, password: str) -> tuple[bool, bool, List[str]]:
        users = await self._load_users()
        if username not in users:
            return False, False, []

        user = users[username]
        if user["password"] == password:  # For first time admin login
            return True, user.get("first_login", False), user.get("permissions", [])

        if user["password"] == self._hash_password(password):
            return True, user.get("first_login", False), user.get("permissions", [])

        return False, False, []

    async def change_password(self, username: str, new_password: str):
        users = await self._load_users()
        if username not in users:
            raise ValueError("User not found")

        users[username]["password"] = self._hash_password(new_password)
        users[username]["first_login"] = False
        await self._save_users(users)

    async def add_user(self, username: str, password: str, permissions: List[str],
                       model_permissions: List[str], rag_permissions: List[str], is_admin: bool = False):
        users = await self._load_users()
        if username in users:
            raise ValueError("User already exists")

        users[username] = {
            "password": self._hash_password(password),
            "is_admin": is_admin,
            "first_login": False,
            "permissions": permissions,
            "model_permissions": model_permissions,
            "rag_permissions": rag_permissions
        }
        await self._save_users(users)

    async def delete_user(self, username: str):
        users = await self._load_users()
        if username not in users:
            raise ValueError("User not found")
        if username == "admin":
            raise ValueError("Cannot delete admin user")

        del users[username]
        await self._save_users(users)

    async def get_users(self) -> Dict:
        users = await self._load_users()
        # Don't return password hashes
        return {username: {k: v for k, v in data.items() if k != "password"}
                for username, data in users.items()}

    async def update_page_permissions(self, username: str, page_permissions: List[str]):
        users = await self._load_users()
        if username not in users:
            raise ValueError("User not found")

        users[username]["permissions"] = page_permissions
        await self._save_users(users)

    async def update_model_permissions(self, username: str, model_permissions: List[str]):
        users = await self._load_users()
        if username not in users:
            raise ValueError("User not found")

        users[username]["model_permissions"] = model_permissions
        await self._save_users(users)

    async def update_rag_permissions(self, username: str, rag_permissions: List[str]):
        users = await self._load_users()
        if username not in users:
            raise ValueError("User not found")

        users[username]["rag_permissions"] = rag_permissions
        await self._save_users(users)
