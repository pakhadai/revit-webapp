# Цей файл містить спільні залежності, щоб уникнути циклічних імпортів.
from fastapi import Depends, HTTPException, status, Header
from sqlalchemy.ext.asyncio import AsyncSession
from jose import JWTError, jwt
from typing import Optional

from database import get_session
from models.user import User
from config import settings


async def get_current_user_dependency(
        authorization: Optional[str] = Header(None),
        session: AsyncSession = Depends(get_session)
):
    """
    Декодує JWT токен з заголовка 'Authorization' та повертає поточного користувача.
    """
    if authorization is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header is missing",
        )

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        # Очікуємо формат "Bearer <token>"
        scheme, token = authorization.split()
        if scheme.lower() != "bearer":
            raise credentials_exception

        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id_str: Optional[str] = payload.get("sub")
        if user_id_str is None:
            raise credentials_exception
        user_id = int(user_id_str)

    except (ValueError, JWTError, TypeError):
        raise credentials_exception

    user = await session.get(User, user_id)
    if user is None:
        raise credentials_exception

    return user
