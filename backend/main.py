# backend/main.py - ВИПРАВЛЕНА ВЕРСІЯ
import datetime
import os
import asyncio
import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path
from fastapi.responses import FileResponse
from fastapi import FastAPI, Request, Body
from typing import Any, Dict
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler
from pydantic import BaseModel

# Імпорти для роботи з БД
from database import engine, Base, async_session
from models import *
from sqlalchemy import select, func

# Імпорти роутерів - ВИПРАВЛЕНО
from api.auth import router as auth_router
from api.auth_fallback import router as fallback_router
from api.archives import router as archives_router
from api.orders import router as orders_router
from api.admin import router as admin_router
from api.subscriptions import router as subscriptions_router
from api.bonuses import router as bonuses_router
from api.referrals import router as referrals_router
from api.vip import router as vip_router
from api.payments import router as payments_router
from api.downloads import router as downloads_router
from api.favorites import router as favorites_router
from api.history import router as history_router
from api.ratings import router as ratings_router
from api.notifications import router as notifications_router
from api.comments import router as comments_router
from api.promo_codes import router as promo_codes_router
from api.uploads import router as uploads_router
from api.user_settings import router as user_settings_router
from api.marketplace import router as marketplace_router

from static_files import setup_static_files
from limiter import limiter
from config import settings

# Налаштування логування
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


# Функція ініціалізації БД
async def init_db():
    """Створення всіх таблиць в БД"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables created/verified")


# Lifespan manager для ініціалізації при старті
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting up...")
    await init_db()
    yield
    # Shutdown
    logger.info("Shutting down...")


# Створюємо FastAPI додаток
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    lifespan=lifespan
)

# CORS налаштування
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Монтуємо статичні файли та медіа
app.mount("/media", StaticFiles(directory="media"), name="media")
app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/telegram")
async def telegram_redirect():
    """Перенаправлення з /telegram на головну сторінку"""
    return FileResponse(Path(__file__).parent / "frontend" / "index.html")
# Налаштування для роздачі frontend
setup_static_files(app)


# Модель для логування з фронтенду
class RemoteLog(BaseModel):
    level: str = 'INFO'
    message: str
    extra: Dict[str, Any] = {}


# Ендпоінт для логування з фронтенду
@app.post("/api/log")
async def remote_log(log_entry: RemoteLog):
    """Приймає лог-повідомлення від фронтенду"""
    print(f"[FRONTEND | {log_entry.level}] {log_entry.message}")
    if log_entry.extra:
        print(f"  └── Extra: {log_entry.extra}")
    return {"status": "logged"}


# Підключаємо всі роутери
app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
app.include_router(fallback_router, prefix="/api/auth", tags=["auth"])
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


# Основні ендпоінти
@app.get("/api/health")
async def health_check():
    """Перевірка працездатності API"""
    return {"status": "ok", "version": settings.VERSION}


@app.get("/")
async def root():
    """Кореневий ендпоінт"""
    return {
        "status": "ok",
        "message": "RevitBot API is running",
        "version": settings.VERSION,
        "docs": "/docs"
    }


@app.get("/api/test")
async def test_endpoint():
    """Тестовий ендпоінт для перевірки"""
    return {
        "status": "ok",
        "timestamp": datetime.utcnow().isoformat(),
        "message": "API is working correctly"
    }


@app.get("/api/debug/routes")
async def debug_routes():
    """Показати всі доступні роути (тільки в DEV режимі)"""
    if not settings.DEBUG:
        return {"error": "Not available in production"}

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
        "routes": sorted(routes, key=lambda x: x["path"])
    }


@app.middleware("http")
async def log_requests(request: Request, call_next):
    print(f"Request: {request.method} {request.url}")
    print(f"Headers: {request.headers}")
    response = await call_next(request)
    return response


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8001,
        reload=True
    )