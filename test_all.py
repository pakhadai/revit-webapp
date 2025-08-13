#!/usr/bin/env python3
"""
Фінальний тест всіх компонентів системи
Запустіть після запуску серверів: python test_all.py
"""

import requests
import json
import time

BASE_URL = "http://localhost:8001"
FRONTEND_URL = "http://localhost:8000"


def test_endpoint(name, method, url, data=None, headers=None):
    """Тестувати один ендпоінт"""
    try:
        if method == "GET":
            response = requests.get(url, headers=headers, timeout=5)
        elif method == "POST":
            response = requests.post(url, json=data, headers=headers, timeout=5)
        else:
            return f"❓ {name}: Невідомий метод {method}"

        if response.status_code in [200, 201]:
            return f"✅ {name}: OK ({response.status_code})"
        elif response.status_code == 401:
            return f"🔐 {name}: Потребує авторизації (працює)"
        elif response.status_code == 404:
            return f"❌ {name}: Not Found (404)"
        else:
            return f"⚠️ {name}: Status {response.status_code}"
    except requests.exceptions.ConnectionError:
        return f"❌ {name}: Сервер не доступний"
    except Exception as e:
        return f"❌ {name}: {str(e)}"


print("=" * 60)
print("🧪 ФІНАЛЬНИЙ ТЕСТ ВСІХ КОМПОНЕНТІВ")
print("=" * 60)

# Тест Backend
print("\n📡 BACKEND ТЕСТИ:")
print("-" * 40)

backend_tests = [
    ("API Status", "GET", f"{BASE_URL}/"),
    ("API Docs", "GET", f"{BASE_URL}/docs"),
    ("Auth", "POST", f"{BASE_URL}/api/auth/telegram", {"initData": "dev_mode=true"}),
    ("Archives List", "GET", f"{BASE_URL}/api/archives/list"),
    ("Promo Codes", "GET", f"{BASE_URL}/api/promo-codes/"),
    ("Admin", "GET", f"{BASE_URL}/api/admin/stats"),
    ("Subscriptions", "GET", f"{BASE_URL}/api/subscriptions/plans"),
    ("Bonuses", "GET", f"{BASE_URL}/api/bonuses/balance"),
]

token = None
for test in backend_tests:
    result = test_endpoint(*test)
    print(result)

    # Зберігаємо токен якщо auth успішний
    if test[0] == "Auth" and "✅" in result:
        try:
            response = requests.post(test[2], json=test[3])
            data = response.json()
            if "token" in data:
                token = data["token"]
                print(f"   📝 Token отримано: {token[:20]}...")
        except:
            pass

# Тест Frontend
print("\n🌐 FRONTEND ТЕСТИ:")
print("-" * 40)

frontend_tests = [
    ("Homepage", "GET", f"{FRONTEND_URL}/"),
    ("Test Page", "GET", f"{FRONTEND_URL}/test.html"),
    ("Manifest", "GET", f"{FRONTEND_URL}/manifest.json"),
    ("Service Worker", "GET", f"{FRONTEND_URL}/service-worker.js"),
    ("Main CSS", "GET", f"{FRONTEND_URL}/css/main.css"),
    ("App JS", "GET", f"{FRONTEND_URL}/js/app.js"),
]

for test in frontend_tests:
    result = test_endpoint(*test)
    print(result)

# Тест з токеном
if token:
    print("\n🔑 ТЕСТИ З АВТОРИЗАЦІЄЮ:")
    print("-" * 40)

    auth_headers = {"Authorization": f"Bearer {token}"}

    auth_tests = [
        ("User Profile", "GET", f"{BASE_URL}/api/auth/me", None, auth_headers),
        ("User Bonuses", "GET", f"{BASE_URL}/api/bonuses/balance", None, auth_headers),
        ("User Orders", "GET", f"{BASE_URL}/api/orders/my", None, auth_headers),
        ("Favorites", "GET", f"{BASE_URL}/api/favorites/list", None, auth_headers),
        ("Notifications", "GET", f"{BASE_URL}/api/notifications/unread", None, auth_headers),
    ]

    for test in auth_tests:
        result = test_endpoint(*test)
        print(result)

# Перевірка БД
print("\n💾 БАЗА ДАНИХ:")
print("-" * 40)

try:
    import sqlite3

    conn = sqlite3.connect('backend/database/database.db')
    cursor = conn.cursor()

    # Отримуємо список таблиць
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = cursor.fetchall()

    print(f"Знайдено таблиць: {len(tables)}")
    for table in tables:
        cursor.execute(f"SELECT COUNT(*) FROM {table[0]}")
        count = cursor.fetchone()[0]
        print(f"   - {table[0]}: {count} записів")

    conn.close()
except Exception as e:
    print(f"❌ Помилка читання БД: {e}")

# Фінальний висновок
print("\n" + "=" * 60)
print("📊 РЕЗУЛЬТАТИ:")
print("=" * 60)

print("""
Якщо всі тести показують ✅ або 🔐 - система працює коректно!

Можливі проблеми та рішення:
- ❌ Сервер не доступний -> Запустіть сервер
- ❌ Not Found -> Перевірте роутинг в main.py
- ⚠️ Status 500 -> Перевірте логи сервера
- 🔐 Потребує авторизації -> Це нормально для захищених ендпоінтів

Для використання в Telegram:
1. Відкрийте @BotFather
2. Виберіть вашого бота
3. /setmenubutton -> введіть http://localhost:8000
4. Відкрийте бота і натисніть кнопку меню
""")

print("=" * 60)