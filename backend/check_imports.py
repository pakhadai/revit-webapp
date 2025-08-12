#!/usr/bin/env python3
"""
Скрипт для перевірки імпортів
Запустіть: python check_imports.py
"""

print("=" * 60)
print("🔍 ПЕРЕВІРКА ІМПОРТІВ")
print("=" * 60)

# 1. Перевірка основних імпортів
print("\n1. Перевірка основних модулів:")
try:
    from fastapi import FastAPI, Depends

    print("   ✅ FastAPI імпортується")
except ImportError as e:
    print(f"   ❌ FastAPI: {e}")

try:
    from database import get_session

    print("   ✅ database імпортується")
except ImportError as e:
    print(f"   ❌ database: {e}")

# 2. Перевірка моделей
print("\n2. Перевірка моделей:")
try:
    from models.user import User

    print("   ✅ User модель імпортується")
except ImportError as e:
    print(f"   ❌ User: {e}")

try:
    from models.archive import Archive

    print("   ✅ Archive модель імпортується")
except ImportError as e:
    print(f"   ❌ Archive: {e}")

# 3. Перевірка API модулів
print("\n3. Перевірка API модулів:")

try:
    from api.auth import get_current_user_dependency

    print("   ✅ auth.get_current_user_dependency імпортується")
except ImportError as e:
    print(f"   ❌ auth: {e}")

try:
    from api.admin import admin_required

    print("   ✅ admin.admin_required імпортується")
except ImportError as e:
    print(f"   ❌ admin.admin_required: {e}")

# 4. Перевірка окремих файлів
print("\n4. Перевірка файлу archives.py:")
try:
    import api.archives as archives_module

    print("   ✅ archives.py імпортується")

    # Перевірка вмісту
    print("\n   Функції в archives.py:")
    for name in dir(archives_module):
        if not name.startswith('_'):
            obj = getattr(archives_module, name)
            if callable(obj):
                print(f"      - {name}")

except Exception as e:
    print(f"   ❌ Помилка в archives.py: {e}")
    import traceback

    print("\nПовний traceback:")
    traceback.print_exc()

# 5. Перевірка файлу uploads.py
print("\n5. Перевірка файлу uploads.py:")
try:
    import api.uploads as uploads_module

    print("   ✅ uploads.py імпортується")
except Exception as e:
    print(f"   ❌ uploads.py: {e}")

print("\n" + "=" * 60)
print("РЕКОМЕНДАЦІЇ:")
print("=" * 60)
print("""
Якщо є помилки з admin_required в archives.py:
1. Відкрийте backend/api/archives.py
2. Знайдіть рядок де використовується admin_required
3. Видаліть цей рядок або додайте імпорт:
   from .admin import admin_required
""")