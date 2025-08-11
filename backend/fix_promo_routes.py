#!/usr/bin/env python3
"""
Скрипт для автоматичного виправлення підключення промокодів
Запустіть: python fix_promo_routes.py
"""

import os
import sys

print("=" * 60)
print("🔧 АВТОМАТИЧНЕ ВИПРАВЛЕННЯ ПРОМОКОДІВ")
print("=" * 60)

# 1. Перевіряємо наявність файлів
print("\n1. Перевірка файлів:")
files_ok = True

if not os.path.exists('api/promo_codes.py'):
    print("   ❌ Файл api/promo_codes.py НЕ знайдено!")
    files_ok = False
else:
    print("   ✅ api/promo_codes.py існує")

if not os.path.exists('models/promo_code.py'):
    print("   ❌ Файл models/promo_code.py НЕ знайдено!")
    files_ok = False
else:
    print("   ✅ models/promo_code.py існує")

if not files_ok:
    print("\n❌ Спочатку створіть відсутні файли!")
    sys.exit(1)

# 2. Перевіряємо та виправляємо api/__init__.py
print("\n2. Перевірка api/__init__.py:")
init_file = 'api/__init__.py'

try:
    with open(init_file, 'r', encoding='utf-8') as f:
        content = f.read()

    needs_update = False

    # Перевіряємо імпорт
    if 'from .promo_codes import router as promo_codes_router' not in content:
        print("   ⚠️ Додаємо імпорт promo_codes_router...")

        # Знаходимо місце після останнього імпорту
        import_lines = [line for line in content.split('\n') if line.startswith('from .')]
        if import_lines:
            last_import = import_lines[-1]
            content = content.replace(
                last_import,
                last_import + '\nfrom .promo_codes import router as promo_codes_router'
            )
            needs_update = True

    # Перевіряємо __all__
    if "'promo_codes_router'" not in content:
        print("   ⚠️ Додаємо promo_codes_router в __all__...")
        content = content.replace(
            "'comments_router'",
            "'comments_router',\n    'promo_codes_router'"
        )
        needs_update = True

    if needs_update:
        # Створюємо бекап
        with open(init_file + '.backup', 'w', encoding='utf-8') as f:
            f.write(content)

        # Записуємо оновлений файл
        with open(init_file, 'w', encoding='utf-8') as f:
            f.write(content)
        print("   ✅ api/__init__.py оновлено!")
    else:
        print("   ✅ api/__init__.py вже правильний")

except Exception as e:
    print(f"   ❌ Помилка: {e}")

# 3. Перевіряємо та виправляємо main.py
print("\n3. Перевірка main.py:")
main_file = 'main.py'

try:
    with open(main_file, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    needs_update = False

    # Шукаємо рядок з імпортами
    import_found = False
    router_found = False

    for i, line in enumerate(lines):
        # Перевіряємо імпорт
        if 'from api import' in line and 'promo_codes' not in line:
            # Якщо це однорядковий імпорт
            if ')' in line:
                lines[i] = line.replace(')', ', promo_codes)')
                import_found = True
                needs_update = True
                print("   ⚠️ Додаємо promo_codes в імпорти (однорядковий)")
            else:
                # Багаторядковий імпорт - шукаємо кінець
                for j in range(i, min(i + 20, len(lines))):
                    if ')' in lines[j]:
                        lines[j] = lines[j].replace(')', ', promo_codes)')
                        import_found = True
                        needs_update = True
                        print("   ⚠️ Додаємо promo_codes в імпорти (багаторядковий)")
                        break

        # Перевіряємо підключення роутера
        if 'app.include_router(promo_codes.router' in line:
            router_found = True

    # Якщо роутер не підключений
    if not router_found:
        print("   ⚠️ Додаємо підключення роутера promo_codes...")

        # Знаходимо місце після останнього include_router
        last_router_idx = -1
        for i, line in enumerate(lines):
            if 'app.include_router(' in line:
                last_router_idx = i

        if last_router_idx > 0:
            # Додаємо після останнього роутера
            lines.insert(last_router_idx + 1,
                         'app.include_router(promo_codes.router, prefix="/api/promo-codes", tags=["promo-codes"])\n')
            needs_update = True

    if needs_update:
        # Створюємо бекап
        with open(main_file + '.backup', 'w', encoding='utf-8') as f:
            f.writelines(lines)

        # Записуємо оновлений файл
        with open(main_file, 'w', encoding='utf-8') as f:
            f.writelines(lines)
        print("   ✅ main.py оновлено!")
    else:
        print("   ✅ main.py вже містить підключення promo_codes")

except Exception as e:
    print(f"   ❌ Помилка: {e}")

# 4. Створюємо тестовий міні-сервер для перевірки
print("\n4. Створюємо тестовий файл test_server.py:")

test_server_code = '''# Тестовий сервер для перевірки промокодів
from fastapi import FastAPI
from api import promo_codes

app = FastAPI()
app.include_router(promo_codes.router, prefix="/api/promo-codes")

@app.get("/")
async def root():
    return {"message": "Test server for promo codes"}

if __name__ == "__main__":
    import uvicorn
    print("Запускаємо тестовий сервер на http://localhost:8002")
    print("Перевірте: http://localhost:8002/api/promo-codes/")
    uvicorn.run(app, host="0.0.0.0", port=8002)
'''

with open('test_server.py', 'w', encoding='utf-8') as f:
    f.write(test_server_code)

print("   ✅ test_server.py створено")

print("\n" + "=" * 60)
print("📌 ІНСТРУКЦІЇ:")
print("=" * 60)
print("""
1. ПЕРЕЗАПУСТІТЬ основний сервер:
   Ctrl+C (зупинити)
   uvicorn main:app --reload --port 8001

2. АБО запустіть тестовий сервер:
   python test_server.py

3. Перевірте в браузері:
   http://localhost:8001/api/promo-codes/
   АБО
   http://localhost:8002/api/promo-codes/ (тестовий)

4. Якщо досі не працює, покажіть вміст файлів:
   - main.py (рядки з from api import... та app.include_router)
   - api/__init__.py
""")

input("\nНатисніть Enter для завершення...")