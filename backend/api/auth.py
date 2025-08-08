from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_session
from models.user import User
import hashlib
import hmac
import json
from urllib.parse import unquote
from config import settings

router = APIRouter()


def verify_telegram_data(init_data: str) -> dict:
    """Verify Telegram WebApp init data"""
    try:
        # In dev mode, skip verification
        if settings.DEV_MODE:
            # Return mock data for development
            return {
                "user": {
                    "id": 12345,
                    "first_name": "Test",
                    "last_name": "User",
                    "username": "testuser",
                    "language_code": "ua"
                }
            }

        # Parse init data (in production, verify with bot token)
        # This is simplified version
        data_dict = dict(pair.split('=') for pair in init_data.split('&'))
        user_data = json.loads(unquote(data_dict.get('user', '{}')))

        return {"user": user_data}

    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid init data")


@router.post("/telegram")
async def telegram_auth(
        data: dict,
        session: AsyncSession = Depends(get_session)
):
    """Authenticate user with Telegram WebApp data"""
    try:
        # Verify Telegram data
        verified_data = verify_telegram_data(data.get('initData', ''))
        tg_user = verified_data['user']

        # Find or create user
        result = await session.execute(
            select(User).where(User.user_id == tg_user['id'])
        )
        user = result.scalar_one_or_none()

        if not user:
            # Create new user
            user = User(
                user_id=tg_user['id'],
                username=tg_user.get('username'),
                full_name=f"{tg_user.get('first_name', '')} {tg_user.get('last_name', '')}".strip(),
                language_code=tg_user.get('language_code', 'en')
            )
            session.add(user)
            await session.commit()

        # Generate token (simplified)
        token = f"token_{user.user_id}_{user.username}"

        return {
            "success": True,
            "token": token,
            "user": {
                "id": user.id,
                "userId": user.user_id,
                "username": user.username,
                "fullName": user.full_name,
                "language": user.language_code,
                "isAdmin": user.is_admin,
                "role": user.role,
                "bonuses": user.bonuses
            }
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))