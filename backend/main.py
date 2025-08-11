# backend/main.py - З ВИПРАВЛЕНИМ CORS
import asyncio

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging
from pathlib import Path

# Імпорти для роботи з БД
from database import engine, Base, async_session
from models import * # Імпортуємо все одразу для Alembic
from data.mock_data import mock_archives_list
from sqlalchemy import select, func
from scheduler import scheduler

# Імпорти для API
from api import (auth, archives, orders, admin, subscriptions, bonuses, referrals,
                 vip, payments, downloads, favorites, history, ratings, notifications, comments )
from config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- ЛОГІКА ЗАПУСКУ ТА НАПОВНЕННЯ БД ---

async def init_db():
    """Створює всі таблиці в базі даних на основі моделей, якщо вони ще не існують."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables verified/created.")

        await seed_data()  # <--- ТЕПЕР ВІН АКТИВНИЙ

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

    # Запускаємо планувальник в фоні
    scheduler_task = asyncio.create_task(scheduler.start())

    yield

    # Зупиняємо планувальник при виключенні
    scheduler.stop()
    logger.info("Application shutdown.")

# --- СТВОРЕННЯ ДОДАТКУ ---
app = FastAPI(title="RevitBot Web API", version="1.0.0", lifespan=lifespan)

# --- ВИПРАВЛЕННЯ CORS ---
# Дозволяємо запити з будь-якого джерела, з будь-якими методами та заголовками.
# Для розробки це безпечно, для продакшену можна буде обмежити.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Дозволити всі джерела
    allow_credentials=True,
    allow_methods=["*"], # Дозволити всі методи (GET, POST, etc.)
    allow_headers=["*"], # Дозволити всі заголовки
)

# Підключення роутерів (всі ваші існуючі роутери)
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(archives.router, prefix="/api/archives", tags=["archives"])
app.include_router(orders.router, prefix="/api/orders", tags=["orders"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])
app.include_router(subscriptions.router, prefix="/api/subscriptions", tags=["subscriptions"])
app.include_router(bonuses.router, prefix="/api/bonuses", tags=["bonuses"])
app.include_router(referrals.router, prefix="/api/referrals", tags=["referrals"])
app.include_router(vip.router, prefix="/api/vip", tags=["vip"])
app.include_router(payments.router, prefix="/api/payments", tags=["payments"])
app.include_router(downloads.router, prefix="/api/downloads", tags=["downloads"])
app.include_router(favorites.router, prefix="/api/favorites", tags=["favorites"])
app.include_router(history.router, prefix="/api/history", tags=["history"])
app.include_router(ratings.router, prefix="/api/ratings", tags=["ratings"])
app.include_router(notifications.router, prefix="/api/notifications", tags=["notifications"])
app.include_router(comments.router, prefix="/api/comments", tags=["comments"])

# Тестовий ендпоінт
@app.get("/")
async def root():
    return {"status": "ok", "message": "RevitBot API is running"}