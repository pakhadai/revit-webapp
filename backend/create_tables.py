#!/usr/bin/env python3
"""
Скрипт для створення/оновлення всіх таблиць в базі даних
Запустіть в папці backend: python create_tables.py
"""

import asyncio
import sys
from pathlib import Path

# Додаємо поточну директорію в шлях
sys.path.insert(0, str(Path(__file__).parent))


async def create_all_tables():
    print("=" * 60)
    print("📦 СТВОРЕННЯ ТАБЛИЦЬ БАЗИ ДАНИХ")
    print("=" * 60)

    try:
        # Імпортуємо базові компоненти
        from database import Base, engine
        print("✅ Database engine імпортовано")

        # Імпортуємо ВСІ моделі - це ВАЖЛИВО!
        from models.user import User
        from models.archive import Archive, ArchivePurchase
        from models.order import Order, OrderItem
        from models.payment import Payment
        from models.subscription import Subscription, SubscriptionArchive
        from models.bonus import BonusTransaction, DailyBonus, UserReferral, VipLevel
        from models.favorite import Favorite
        from models.view_history import ViewHistory
        from models.archive_rating import ArchiveRating
        from models.notification import Notification
        from models.comment import Comment
        from models.promo_code import PromoCode
        from models.marketplace import (
            DeveloperApplication, DeveloperProfile,
            MarketplaceProduct, MarketplaceTransaction,
            DeveloperWithdrawal, ProductReview, DeveloperAnalytics
        )

        print("✅ Всі моделі імпортовано")

        # Створюємо таблиці
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        print("✅ Всі таблиці створено успішно!")

        # Перевіряємо які таблиці створено
        from sqlalchemy import inspect
        async with engine.connect() as conn:
            def check_tables(connection):
                inspector = inspect(connection)
                tables = inspector.get_table_names()
                return tables

            tables = await conn.run_sync(check_tables)

        print(f"\n📋 Створено {len(tables)} таблиць:")
        for table in sorted(tables):
            print(f"   - {table}")

    except Exception as e:
        print(f"❌ Помилка: {e}")
        import traceback
        traceback.print_exc()
        return False

    return True


if __name__ == "__main__":
    success = asyncio.run(create_all_tables())

    if success:
        print("\n✅ База даних готова до роботи!")
        print("Тепер можете запустити сервер:")
        print("   uvicorn main:app --reload --port 8001")
    else:
        print("\n❌ Виникли помилки при створенні бази даних")
        print("Перевірте помилки вище та спробуйте ще раз")