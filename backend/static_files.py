# backend/static_files.py
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path
import os


def setup_static_files(app: FastAPI):
    """Налаштування для роздачі frontend файлів через backend"""

    # Шлях до frontend директорії (на рівень вище від backend)
    frontend_path = Path(__file__).parent.parent / "frontend"

    if not frontend_path.exists():
        print(f"⚠️ Frontend directory not found at {frontend_path}")
        return

    print(f"✅ Serving frontend from: {frontend_path}")

    # Монтуємо статичні директорії
    static_dirs = ["css", "js", "images", "locales"]

    for dir_name in static_dirs:
        dir_path = frontend_path / dir_name
        if dir_path.exists():
            app.mount(f"/{dir_name}", StaticFiles(directory=str(dir_path)), name=dir_name)
            print(f"  📁 Mounted /{dir_name}")

    # Головна сторінка
    @app.get("/")
    async def serve_index():
        index_path = frontend_path / "index.html"
        if index_path.exists():
            return FileResponse(str(index_path))
        return {"error": "index.html not found"}

    # Telegram сторінка
    @app.get("/telegram")
    async def serve_telegram():
        telegram_path = frontend_path / "telegram.html"
        if telegram_path.exists():
            return FileResponse(str(telegram_path))
        # Якщо telegram.html не існує, використовуємо index.html
        index_path = frontend_path / "index.html"
        if index_path.exists():
            return FileResponse(str(index_path))
        return {"error": "telegram.html not found"}

    # Manifest
    @app.get("/manifest.json")
    async def serve_manifest():
        manifest_path = frontend_path / "manifest.json"
        if manifest_path.exists():
            return FileResponse(str(manifest_path))
        return {"error": "manifest.json not found"}

    # Test сторінка
    @app.get("/test.html")
    async def serve_test():
        test_path = frontend_path / "test.html"
        if test_path.exists():
            return FileResponse(str(test_path))
        return {"error": "test.html not found"}

    print("✅ Static files setup complete!")