# backend/main.py

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging
from pathlib import Path

# Імпорти для роботи з БД
from database import engine, Base, async_session
from models.archive import Archive
from data.mock_data import mock_archives_list
from sqlalchemy import select, func

# Імпорти для API
from api import auth, archives, orders, admin, subscriptions, bonuses, referrals
from config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- ЛОГІКА ЗАПУСКУ ТА НАПОВНЕННЯ БД ---
async def init_db():
    """Створює всі таблиці в базі даних."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables created.")

async def seed_data():
    """Заповнює таблицю архівів тестовими даними."""
    async with async_session() as session:
        result = await session.execute(select(func.count(Archive.id)))
        if result.scalar_one() == 0:
            logger.info("Database is empty. Seeding mock archives...")
            for archive_data in mock_archives_list:
                session.add(Archive(**archive_data))
            await session.commit()
            logger.info("Mock archives have been seeded.")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Application startup...")
    await init_db()
    await seed_data()
    yield
    logger.info("Application shutdown.")

# --- СТВОРЕННЯ ДОДАТКУ ---
app = FastAPI(title="RevitBot Web API", version="1.0.0", lifespan=lifespan)

# --- НАЛАШТУВАННЯ CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost:3000",
        "https://web.telegram.org"
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Підключення роутерів (ДОДАНО ADMIN)
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(archives.router, prefix="/api/archives", tags=["archives"])
app.include_router(orders.router, prefix="/api/orders", tags=["orders"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])
app.include_router(subscriptions.router, prefix="/api/subscriptions", tags=["subscriptions"])
app.include_router(bonuses.router, prefix="/api/bonuses", tags=["bonuses"])
app.include_router(referrals.router, prefix="/api/referrals", tags=["referrals"])

# Тестовий ендпоінт
@app.get("/")
async def root():
    return {"status": "ok", "message": "RevitBot API is running"}

# Додатковий тест ендпоінт для перевірки CORS
@app.get("/test")
async def test():
    return {"message": "CORS test successful"}