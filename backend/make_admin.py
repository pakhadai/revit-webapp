#!/usr/bin/env python3
"""
Скрипт для надання прав адміністратора користувачу
Використання: python make_admin.py ваш_telegram_id
"""

import asyncio
import sys
from sqlalchemy import select
from database import async_session
from models.user import User, UserRole


async def make_user_admin(telegram_id: str):
    """Надає права адміністратора користувачу за Telegram ID"""
    async with async_session() as session:
        # Шукаємо користувача
        result = await session.execute(
            select(User).where(User.telegram_id == telegram_id)
        )
        user = result.scalar_one_or_none()

        if not user:
            print(f"❌ Користувача з Telegram ID {telegram_id} не знайдено!")
            print("   Спочатку зайдіть в додаток через Telegram")
            return False

        # Робимо адміном
        user.role = UserRole.ADMIN
        await session.commit()

        print(f"✅ Користувач {user.first_name} (@{user.username}) тепер адміністратор!")
        print(f"   ID: {user.id}")
        print(f"   Telegram ID: {user.telegram_id}")
        print(f"   Роль: {user.role.value}")

        return True


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Використання: python make_admin.py ВАШ_TELEGRAM_ID")
        print("Дізнатись свій Telegram ID можна через @userinfobot")
        sys.exit(1)

    telegram_id = sys.argv[1]
    asyncio.run(make_user_admin(telegram_id))