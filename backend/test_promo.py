#!/usr/bin/env python3
"""
Діагностичний скрипт для перевірки роботи промокодів
Запустіть його в папці backend: python test_promo.py
"""

import asyncio
import sys
from pathlib import Path

# Додаємо поточну директорію в шлях
sys.path.insert(0, str(Path(__file__).parent))


async def test_promo_codes():
    print("🔍 Тестування модуля промокодів...")

    # 1. Перевірка імпортів
    try:
        from api import promo_codes
        print("✅ Модуль promo_codes успішно імпортовано")
    except ImportError as e:
        print(f"❌ Помилка імпорту promo_codes: {e}")
        return

    # 2. Перевірка моделі
    try:
        from models.promo_code import PromoCode, DiscountType
        print("✅ Модель PromoCode знайдено")
    except ImportError as e:
        print(f"❌ Помилка імпорту моделі PromoCode: {e}")
        print("   Створіть файл backend/models/promo_code.py")
        return

    # 3. Перевірка роутера
    try:
        print(f"📋 Доступні ендпоінти в promo_codes.router:")
        for route in promo_codes.router.routes:
            if hasattr(route, 'path'):
                print(f"   - {route.methods} {route.path}")
    except Exception as e:
        print(f"❌ Помилка перевірки роутера: {e}")

    # 4. Перевірка бази даних
    try:
        from database import engine, Base
        from sqlalchemy import inspect

        async with engine.connect() as conn:
            def check_tables(connection):
                inspector = inspect(connection)
                tables = inspector.get_table_names()

                if 'promo_codes' in tables:
                    print("✅ Таблиця promo_codes існує в БД")
                    columns = [col['name'] for col in inspector.get_columns('promo_codes')]
                    print(f"   Колонки: {', '.join(columns)}")
                else:
                    print("❌ Таблиця promo_codes НЕ існує в БД")
                    print("   Потрібно створити міграцію або перестворити БД")

                return 'promo_codes' in tables

            table_exists = await conn.run_sync(check_tables)

            if not table_exists:
                print("\n💡 Спробуйте:")
                print("   1. Видаліть файл database/database.db")
                print("   2. Перезапустіть сервер - таблиці створяться автоматично")

    except Exception as e:
        print(f"❌ Помилка перевірки БД: {e}")

    print("\n📌 Фінальна перевірка:")
    print("   1. Переконайтеся, що сервер запущено: uvicorn main:app --reload --port 8001")
    print("   2. Відкрийте в браузері: http://localhost:8001/api/promo-codes/")
    print("   3. Якщо 401 Unauthorized - це нормально, ендпоінт працює")
    print("   4. Якщо 404 Not Found - проблема з роутингом")


if __name__ == "__main__":
    asyncio.run(test_promo_codes())