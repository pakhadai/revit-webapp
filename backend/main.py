# backend/main.py

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware # <--- ВАЖЛИВИЙ ІМПОРТ
from contextlib import asynccontextmanager
import logging
from pathlib import Path

# Імпорти для роботи з БД
from database import engine, Base, async_session
from models.archive import Archive
from data.mock_data import mock_archives_list
from sqlalchemy import select, func

# Імпорти для API
from api import auth, archives, orders
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

# --- СТВОРЕННЯ ТА НАЛАШТУВАННЯ ДОДАТКУ ---
app = FastAPI(title="RevitBot Web API", version="1.0.0", lifespan=lifespan)

# --- ДОДАЄМО НАЛАШТУВАННЯ CORS ---
# Цей блок дозволяє фронтенду спілкуватися з бекендом
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Для розробки дозволяємо всі джерела
    allow_credentials=True,
    allow_methods=["*"],  # Дозволяємо всі методи (GET, POST, OPTIONS і т.д.)
    allow_headers=["*"],  # Дозволяємо всі заголовки
)

# Підключення роутерів
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(archives.router, prefix="/api/archives", tags=["archives"])
app.include_router(orders.router, prefix="/api/orders", tags=["orders"])

# Тестовий ендпоінт
@app.get("/")
async def root():
    return {"status": "ok"}