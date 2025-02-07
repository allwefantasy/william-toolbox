from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from os import environ

# JWT configuration
JWT_SECRET = environ.get('JWT_SECRET', 'williamtoolbox')
JWT_ALGORITHM = environ.get('JWT_ALGORITHM', 'HS256')

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
    except jwt.PyJWTError as e:        
        raise HTTPException(
            status_code=401,
            detail="Invalid token"
        )
