# backend/database.py
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from config import settings

# Створюємо двигун для асинхронної роботи
engine = create_async_engine(settings.DATABASE_URL, echo=False)

# Створюємо фабрику сесій
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

# Створюємо базовий клас для всіх наших моделей
Base = declarative_base()

# Функція-залежність для отримання сесії в ендпоінтах
async def get_session() -> AsyncSession:
    async with async_session() as session:
        yield session