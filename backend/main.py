# backend/main.py - ПОВНІСТЮ РОБОЧИЙ

import asyncio
import logging
from logging.handlers import RotatingFileHandler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler
from limiter import limiter
from pathlib import Path

# Імпорти для роботи з БД
from database import engine, Base, async_session
from models import *
from data.mock_data import mock_archives_list
from sqlalchemy import select, func
from scheduler import scheduler

# ВАЖЛИВО: Імпорти для API - включаючи promo_codes!
from api import (
    auth,
    archives,
    orders,
    admin,
    subscriptions,
    bonuses,
    referrals,
    vip,
    payments,
    downloads,
    favorites,
    history,
    ratings,
    notifications,
    comments,
    promo_codes  # <-- ЦЕ ВАЖЛИВО!
)

from config import settings

# Налаштування логування
log_formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')

# Налаштування для запису у файл
log_file = "app.log"
file_handler = RotatingFileHandler(log_file, maxBytes=10 * 1024 * 1024, backupCount=5)
file_handler.setFormatter(log_formatter)

# Налаштування для виводу в консоль
console_handler = logging.StreamHandler()
console_handler.setFormatter(log_formatter)

# Створюємо основний логер
logger = logging.getLogger()
logger.setLevel(logging.INFO)
logger.addHandler(file_handler)
logger.addHandler(console_handler)
logger = logging.getLogger(__name__)


# --- ЛОГІКА ЗАПУСКУ ТА НАПОВНЕННЯ БД ---

async def init_db():
    """Створює всі таблиці в базі даних на основі моделей, якщо вони ще не існують."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables verified/created.")
        await seed_data()


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

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# --- CORS MIDDLEWARE ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- ПІДКЛЮЧЕННЯ ВСІХ РОУТЕРІВ ---
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

# ПРОМОКОДИ - ОБОВ'ЯЗКОВО!
app.include_router(promo_codes.router, prefix="/api/promo-codes", tags=["promo-codes"])


# --- ТЕСТОВІ ЕНДПОІНТИ ---
@app.get("/")
async def root():
    return {
        "status": "ok",
        "message": "RevitBot API is running",
        "version": "1.0.0"
    }


@app.get("/api/test-promo")
async def test_promo():
    return {
        "status": "ok",
        "message": "Promo codes module is loaded"
    }


@app.get("/api/debug/routes")
async def debug_routes():
    """Показує всі зареєстровані маршрути"""
    routes = []
    for route in app.routes:
        if hasattr(route, "path"):
            routes.append({
                "path": route.path,
                "name": route.name,
                "methods": list(route.methods) if hasattr(route, "methods") else None
            })
    return {
        "total_routes": len(routes),
        "promo_routes": [r for r in routes if "promo" in r["path"]],
        "all_routes": routes
    }


logger.info("FastAPI application created with all routers")