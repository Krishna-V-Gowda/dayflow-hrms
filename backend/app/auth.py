from datetime import datetime, timedelta, timezone
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pwdlib import PasswordHash
from sqlalchemy.orm import Session
from .db import get_db
from .models import Role, User

SECRET_KEY = "DAYFLOW_LOCAL_DEMO_SECRET_CHANGE_BEFORE_PRODUCTION"
ALGORITHM = "HS256"
TOKEN_MINUTES = 8 * 60
password_hash = PasswordHash.recommended()
bearer = HTTPBearer()


def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    return password_hash.verify(password, hashed)


def create_token(user: User) -> str:
    payload = {
        "sub": str(user.id),
        "role": user.role.value if isinstance(user.role, Role) else str(user.role),
        "exp": datetime.now(timezone.utc) + timedelta(minutes=TOKEN_MINUTES),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication token")
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


def require_hr(user: User = Depends(get_current_user)) -> User:
    role = user.role.value if isinstance(user.role, Role) else str(user.role)
    if role != Role.HR.value:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="HR access required")
    return user
