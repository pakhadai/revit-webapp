# backend/main.py - ВИПРАВЛЕНА ВЕРСІЯ
import os
import asyncio
import logging
from logging.handlers import RotatingFileHandler
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler
from api.user_settings import router as user_settings_router
from api.marketplace import router as marketplace_router
from limiter import limiter
from pathlib import Path

# Імпорти для роботи з БД
from database import engine, Base, async_session
from models import *
from data.mock_data import mock_archives_list
from sqlalchemy import select, func
from scheduler import scheduler

# ВАЖЛИВО: Імпортуємо роутери з пакету api, використовуючи імена,
# які задані у файлі api/__init__.py
from api import (
    auth_router,
    archives_router,
    orders_router,
    admin_router,
    subscriptions_router,
    bonuses_router,
    referrals_router,
    vip_router,
    payments_router,
    downloads_router,
    favorites_router,
    history_router,
    ratings_router,
    notifications_router,
    comments_router,
    promo_codes_router,
    uploads_router
)

from config import settings

# Налаштування логування (ваш код залишається без змін)
log_formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
log_file = "app.log"
file_handler = RotatingFileHandler(log_file, maxBytes=10 * 1024 * 1024, backupCount=5)
file_handler.setFormatter(log_formatter)
console_handler = logging.StreamHandler()
console_handler.setFormatter(log_formatter)
logger = logging.getLogger()
logger.setLevel(logging.INFO)
logger.addHandler(file_handler)
logger.addHandler(console_handler)
logger = logging.getLogger(__name__)


# --- ЛОГІКА ЗАПУСКУ ТА НАПОВНЕННЯ БД --- (код без змін)
async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables verified/created.")
        #await seed_data()

async def seed_data():
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
    scheduler_task = asyncio.create_task(scheduler.start())
    yield
    scheduler.stop()
    logger.info("Application shutdown.")


# --- СТВОРЕННЯ ДОДАТКУ ---
app = FastAPI(title="RevitBot Web API", version="1.0.0", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
os.makedirs("media/archives", exist_ok=True)
os.makedirs("media/images", exist_ok=True)

# Монтуємо тільки якщо папка існує
if os.path.exists("media"):
    app.mount("/media", StaticFiles(directory=os.path.join(os.path.dirname(__file__), "media")), name="media")

# --- CORS MIDDLEWARE ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- ПІДКЛЮЧЕННЯ ВСІХ РОУТЕРІВ ---
# Тепер ми використовуємо правильні імена роутерів, які імпортували вище
app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
app.include_router(archives_router, prefix="/api/archives", tags=["archives"])
app.include_router(orders_router, prefix="/api/orders", tags=["orders"])
app.include_router(admin_router, prefix="/api/admin", tags=["admin"])
app.include_router(subscriptions_router, prefix="/api/subscriptions", tags=["subscriptions"])
app.include_router(bonuses_router, prefix="/api/bonuses", tags=["bonuses"])
app.include_router(referrals_router, prefix="/api/referrals", tags=["referrals"])
app.include_router(vip_router, prefix="/api/vip", tags=["vip"])
app.include_router(payments_router, prefix="/api/payments", tags=["payments"])
app.include_router(downloads_router, prefix="/api/downloads", tags=["downloads"])
app.include_router(favorites_router, prefix="/api/favorites", tags=["favorites"])
app.include_router(history_router, prefix="/api/history", tags=["history"])
app.include_router(ratings_router, prefix="/api/ratings", tags=["ratings"])
app.include_router(notifications_router, prefix="/api/notifications", tags=["notifications"])
app.include_router(comments_router, prefix="/api/comments", tags=["comments"])
app.include_router(promo_codes_router, prefix="/api/promo-codes", tags=["promo-codes"])
app.include_router(uploads_router, prefix="/api/uploads", tags=["uploads"])
app.include_router(user_settings_router, prefix="/api/users", tags=["user-settings"])
app.include_router(marketplace_router, prefix="/api/marketplace", tags=["marketplace"])

# --- ТЕСТОВІ ЕНДПОІНТИ --- (код без змін)

@app.get("/api/health")
async def health_check():
    return {"status": "ok"}


@app.get("/")
async def root():
    return {"status": "ok", "message": "RevitBot API is running", "version": "1.0.0"}

@app.get("/api/test-promo")
async def test_promo():
    return {"status": "ok", "message": "Promo codes module is loaded"}

@app.get("/api/debug/routes")
async def debug_routes():
    routes = []
    for route in app.routes:
        if hasattr(route, "path"):
            routes.append({"path": route.path, "name": route.name, "methods": list(route.methods) if hasattr(route, "methods") else None})
    return {"total_routes": len(routes), "promo_routes": [r for r in routes if "promo" in r["path"]], "all_routes": routes}

logger.info("FastAPI application created with all routers")