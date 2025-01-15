from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from os import environ

# JWT configuration
JWT_SECRET = environ.get('JWT_SECRET', 'williamtoolbox')
JWT_ALGORITHM = environ.get('JWT_ALGORITHM', 'HS256')

security = HTTPBearer()

async def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        
        # Add is_admin flag to payload
        users = await user_manager.get_users()
        username = payload.get("username")
        if username in users:
            payload["is_admin"] = users[username].get("is_admin", False)
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=401,
            detail="Token expired"
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=401,
            detail="Invalid token"
        )
