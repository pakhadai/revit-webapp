# backend/check_models.py
print("🔍 Checking imports...")

try:
    from database import Base, engine
    print("✅ Database import OK")
except Exception as e:
    print(f"❌ Database import failed: {e}")
    exit(1)

try:
    from models.user import User
    print("✅ User model OK")
except Exception as e:
    print(f"❌ User model failed: {e}")
    exit(1)

try:
    from models.archive import Archive, ArchivePurchase
    print("✅ Archive models OK")
except Exception as e:
    print(f"❌ Archive models failed: {e}")
    exit(1)

try:
    from models.order import Order, OrderItem
    print("✅ Order models OK")
except Exception as e:
    print(f"❌ Order models failed: {e}")
    exit(1)

try:
    from models.subscription import Subscription, SubscriptionArchive
    print("✅ Subscription models OK")
except Exception as e:
    print(f"❌ Subscription models failed: {e}")
    exit(1)

try:
    from models.bonus import BonusTransaction, DailyBonus, UserReferral, VipLevel
    print("✅ Bonus models OK")
except Exception as e:
    print(f"❌ Bonus models failed: {e}")
    exit(1)

print("\n✅ All models imported successfully!")

# Тепер створимо таблиці
import asyncio

async def create_tables():
    print("\n📦 Creating database tables...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("✅ Database tables created!")

asyncio.run(create_tables())