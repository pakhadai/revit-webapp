# backend/create_admin.py
import asyncio
from database import async_session
from models.user import User
from sqlalchemy import select


async def create_admin_user():
    """Створює тестового адміністратора"""
    async with async_session() as session:
        # Перевіряємо чи є вже адмін
        result = await session.execute(
            select(User).where(User.user_id == 12345)  # Тестовий користувач
        )
        existing_user = result.scalar_one_or_none()

        if existing_user:
            # Робимо його адміном
            existing_user.is_admin = True
            existing_user.role = "admin"
            print(f"✅ User {existing_user.username} is now admin")
        else:
            # Створюємо нового адміна
            admin_user = User(
                user_id=12345,  # Тестовий Telegram ID
                username="testuser",
                full_name="Test Admin",
                language_code="ua",
                is_admin=True,
                role="admin",
                bonuses=1000
            )
            session.add(admin_user)
            print("✅ Created new admin user: testuser")

        await session.commit()
        print("✅ Admin privileges granted!")


if __name__ == "__main__":
    asyncio.run(create_admin_user())