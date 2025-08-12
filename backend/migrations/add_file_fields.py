#!/usr/bin/env python3
"""
Міграція для додавання полів файлів
Запустіть: python migrations/add_file_fields.py
"""

import asyncio
from sqlalchemy import text
from database import engine


async def migrate():
    async with engine.begin() as conn:
        print("🔄 Починаємо міграцію...")

        # Додаємо нові колонки
        try:
            await conn.execute(text("""
                ALTER TABLE archives ADD COLUMN IF NOT EXISTS image_paths JSON DEFAULT '[]';
            """))
            print("✅ Додано поле image_paths")
        except Exception as e:
            print(f"⚠️ image_paths можливо вже існує: {e}")

        try:
            await conn.execute(text("""
                ALTER TABLE archives ADD COLUMN IF NOT EXISTS file_path TEXT;
            """))
            print("✅ Додано поле file_path")
        except Exception as e:
            print(f"⚠️ file_path можливо вже існує: {e}")

        try:
            await conn.execute(text("""
                ALTER TABLE archives ADD COLUMN IF NOT EXISTS file_size INTEGER;
            """))
            print("✅ Додано поле file_size")
        except Exception as e:
            print(f"⚠️ file_size можливо вже існує: {e}")

        # Мігруємо старі дані
        try:
            await conn.execute(text("""
                UPDATE archives 
                SET image_paths = json_array(image_path) 
                WHERE image_path IS NOT NULL AND image_paths = '[]';
            """))
            print("✅ Мігровано старі зображення")
        except Exception as e:
            print(f"ℹ️ Міграція старих даних: {e}")

        print("✨ Міграція завершена!")


if __name__ == "__main__":
    asyncio.run(migrate())
    