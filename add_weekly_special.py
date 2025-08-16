#!/usr/bin/env python3
"""
Скрипт для додавання таблиці weekly_specials в базу даних
Запустіть цей скрипт один раз для оновлення БД
"""

import asyncio
import sys
from pathlib import Path

# Додаємо шлях до backend
backend_path = Path(__file__).parent / 'backend'
sys.path.insert(0, str(backend_path))

from sqlalchemy import text
from database import engine, Base
from models import User, Archive  # Імпортуємо існуючі моделі

# Імпортуємо нову модель
from models.weekly_special import WeeklySpecial


async def create_weekly_special_table():
    """Створює таблицю weekly_specials якщо її ще немає"""

    print("🔄 Перевірка та створення таблиці weekly_specials...")

    async with engine.begin() as conn:
        # Перевіряємо чи таблиця вже існує
        result = await conn.execute(
            text("""
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name='weekly_specials'
            """)
        )

        if result.scalar():
            print("✅ Таблиця weekly_specials вже існує")
            return False

        # Створюємо таблицю
        await conn.execute(text("""
            CREATE TABLE weekly_specials (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                archive_id INTEGER NOT NULL,
                discount_percent INTEGER NOT NULL,
                discount_price REAL NOT NULL,
                start_date DATETIME NOT NULL,
                end_date DATETIME NOT NULL,
                bonus_multiplier REAL DEFAULT 1.0,
                is_active BOOLEAN DEFAULT 1,
                views_count INTEGER DEFAULT 0,
                clicks_count INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                created_by INTEGER,
                marketing_text TEXT,
                badge_text VARCHAR DEFAULT 'MEGA SALE',
                FOREIGN KEY (archive_id) REFERENCES archives(id),
                FOREIGN KEY (created_by) REFERENCES users(id)
            )
        """))

        # Створюємо індекси для швидкого пошуку
        await conn.execute(text("""
            CREATE INDEX idx_weekly_specials_active 
            ON weekly_specials(is_active, start_date, end_date)
        """))

        await conn.execute(text("""
            CREATE INDEX idx_weekly_specials_archive 
            ON weekly_specials(archive_id)
        """))

        print("✅ Таблиця weekly_specials створена успішно")
        return True


async def add_sample_weekly_special():
    """Додає приклад Сімейства тижня для тестування"""

    from datetime import datetime, timedelta
    import pytz

    KYIV_TZ = pytz.timezone('Europe/Kiev')

    async with engine.begin() as conn:
        # Перевіряємо чи є архіви
        result = await conn.execute(
            text("SELECT id, title, price FROM archives LIMIT 1")
        )
        archive = result.first()

        if not archive:
            print("⚠️  Немає архівів для створення Сімейства тижня")
            return

        # Перевіряємо чи вже є активне Сімейство тижня
        result = await conn.execute(
            text("SELECT id FROM weekly_specials WHERE is_active = 1")
        )

        if result.scalar():
            print("ℹ️  Вже є активне Сімейство тижня")
            return

        # Створюємо Сімейство тижня
        now = datetime.now(KYIV_TZ)
        end_date = now + timedelta(days=7)
        discount_percent = 40
        discount_price = round(float(archive.price) * 0.6, 2)

        await conn.execute(
            text("""
                INSERT INTO weekly_specials 
                (archive_id, discount_percent, discount_price, 
                 start_date, end_date, bonus_multiplier, is_active,
                 marketing_text, badge_text)
                VALUES 
                (:archive_id, :discount_percent, :discount_price,
                 :start_date, :end_date, :bonus_multiplier, 1,
                 :marketing_text, :badge_text)
            """),
            {
                "archive_id": archive.id,
                "discount_percent": discount_percent,
                "discount_price": discount_price,
                "start_date": now.isoformat(),
                "end_date": end_date.isoformat(),
                "bonus_multiplier": 1.5,
                "marketing_text": f"Тільки цього тижня! {archive.title} зі знижкою {discount_percent}%",
                "badge_text": f"-{discount_percent}%"
            }
        )

        print(f"✅ Створено Сімейство тижня: {archive.title} зі знижкою {discount_percent}%")


async def update_archive_relationship():
    """Оновлює модель Archive для зв'язку з WeeklySpecial"""

    print("\n📝 Інструкція для оновлення моделі Archive:")
    print("-" * 50)
    print("Додайте в файл backend/models/archive.py:")
    print("\n1. На початку файлу (якщо ще немає):")
    print("   from sqlalchemy.orm import relationship")
    print("\n2. В клас Archive додайте:")
    print("   weekly_specials = relationship('WeeklySpecial', back_populates='archive')")
    print("-" * 50)


async def main():
    """Головна функція міграції"""

    print("\n" + "=" * 60)
    print("🚀 МІГРАЦІЯ БАЗИ ДАНИХ - Сімейство тижня")
    print("=" * 60)

    try:
        # Створюємо таблицю
        created = await create_weekly_special_table()

        if created:
            # Додаємо приклад якщо таблиця щойно створена
            await add_sample_weekly_special()

        # Показуємо інструкцію
        await update_archive_relationship()

        print("\n✅ Міграція завершена успішно!")
        print("\nТепер можна:")
        print("1. Запустити backend: cd backend && uvicorn main:app --reload --port 8001")
        print("2. Перевірити Сімейство тижня на головній сторінці")
        print("3. В адмін-панелі встановити нове Сімейство тижня")

    except Exception as e:
        print(f"\n❌ Помилка міграції: {e}")
        print("Перевірте що backend налаштований правильно")
        return 1

    return 0


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)