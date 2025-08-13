#!/usr/bin/env python3
"""
Скрипт для створення всіх необхідних папок проекту
Запустіть з кореневої папки: python setup_folders.py
"""

import os
from pathlib import Path

print("=" * 60)
print("📁 СТВОРЕННЯ СТРУКТУРИ ПАПОК")
print("=" * 60)

# Визначаємо структуру папок
folders = {
    "Backend": [
        "backend/database",
        "backend/data",
        "backend/data/premium",
        "backend/data/free",
        "backend/media",
        "backend/media/archives",
        "backend/media/images",
        "backend/media/temp",
        "backend/media/previews",
        "backend/logs",
        "backend/translations",
        "backend/alembic",
        "backend/alembic/versions"
    ],
    "Frontend": [
        "frontend/images",
        "frontend/images/icons",
        "frontend/images/products",
        "frontend/images/furniture",
        "frontend/images/architecture",
        "frontend/images/plumbing",
        "frontend/css",
        "frontend/js",
        "frontend/js/modules",
        "frontend/js/services",
        "frontend/js/core",
        "frontend/js/locales"
    ]
}

# Створюємо папки
for section, folder_list in folders.items():
    print(f"\n{section}:")
    for folder in folder_list:
        path = Path(folder)
        if not path.exists():
            path.mkdir(parents=True, exist_ok=True)
            print(f"   ✅ Створено: {folder}")
        else:
            print(f"   ⏭️ Вже існує: {folder}")

# Створюємо порожні __init__.py файли де потрібно
print("\n\nСтворення __init__.py файлів:")
init_files = [
    "backend/api/__init__.py",
    "backend/models/__init__.py",
    "backend/services/__init__.py",
    "backend/data/__init__.py"
]

for init_file in init_files:
    path = Path(init_file)
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.touch()
        print(f"   ✅ Створено: {init_file}")
    else:
        print(f"   ⏭️ Вже існує: {init_file}")

# Створюємо .gitignore файли
print("\n\nСтворення .gitignore файлів:")

gitignore_content = {
    "backend/.gitignore": """# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
env/
venv/
.env
.venv

# Database
*.db
*.sqlite
*.sqlite3
database/*.db

# Logs
*.log
logs/

# Media files
media/temp/*
media/archives/*
!media/archives/.gitkeep

# IDE
.vscode/
.idea/
*.swp
*.swo

# Testing
.pytest_cache/
.coverage
htmlcov/
""",
    "frontend/.gitignore": """# Dependencies
node_modules/

# Build
dist/
build/

# Logs
*.log

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
"""
}

for file_path, content in gitignore_content.items():
    path = Path(file_path)
    if not path.exists():
        with open(path, 'w') as f:
            f.write(content)
        print(f"   ✅ Створено: {file_path}")
    else:
        print(f"   ⏭️ Вже існує: {file_path}")

# Створюємо .gitkeep файли для порожніх папок
print("\n\nСтворення .gitkeep файлів:")
gitkeep_folders = [
    "backend/media/archives",
    "backend/media/temp",
    "backend/logs",
    "backend/alembic/versions",
    "frontend/images/products"
]

for folder in gitkeep_folders:
    gitkeep_path = Path(folder) / ".gitkeep"
    if not gitkeep_path.exists():
        gitkeep_path.parent.mkdir(parents=True, exist_ok=True)
        gitkeep_path.touch()
        print(f"   ✅ Створено: {gitkeep_path}")

print("\n" + "=" * 60)
print("✅ СТРУКТУРА ПАПОК ГОТОВА!")
print("=" * 60)