import asyncio
from sqlalchemy import text
from database import engine


async def migrate():
    async with engine.begin() as conn:
        print("🔄 Починаємо міграцію для файлів...")

        try:
            # SQLite не підтримує ALTER COLUMN, тому додаємо нові колонки
            await conn.execute(text(
                "ALTER TABLE archives ADD COLUMN image_paths TEXT DEFAULT '[]'"
            ))
            print("✅ Додано image_paths")
        except:
            print("⚠️ image_paths вже існує")

        try:
            await conn.execute(text(
                "ALTER TABLE archives ADD COLUMN file_path TEXT"
            ))
            print("✅ Додано file_path")
        except:
            print("⚠️ file_path вже існує")

        try:
            await conn.execute(text(
                "ALTER TABLE archives ADD COLUMN file_size INTEGER"
            ))
            print("✅ Додано file_size")
        except:
            print("⚠️ file_size вже існує")

        print("✨ Міграція завершена!")


if __name__ == "__main__":
    asyncio.run(migrate())
