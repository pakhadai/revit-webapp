#!/usr/bin/env python3
"""
Прямий тест API промокодів
"""

import requests
import json

print("=" * 60)
print("🧪 ТЕСТ API ПРОМОКОДІВ")
print("=" * 60)

base_url = "http://localhost:8001"

# Список ендпоінтів для перевірки
endpoints = [
    "/",
    "/docs",
    "/api/promo-codes/",
    "/api/promo-codes/stats",
    "/api/test-promo",
    "/api/debug/routes",
]

print("\nПеревірка ендпоінтів:")
for endpoint in endpoints:
    try:
        url = base_url + endpoint
        response = requests.get(url, timeout=2)

        if response.status_code == 200:
            print(f"✅ {endpoint} -> 200 OK")
            if endpoint == "/api/debug/routes":
                # Перевіряємо чи є promo-codes в роутах
                data = response.json()
                promo_routes = [r for r in data.get("routes", []) if "promo" in r.get("path", "")]
                if promo_routes:
                    print(f"   Знайдено {len(promo_routes)} promo роутів:")
                    for route in promo_routes[:5]:
                        print(f"   - {route['path']}")
        elif response.status_code == 401:
            print(f"🔐 {endpoint} -> 401 (потрібна авторизація - ендпоінт працює!)")
        elif response.status_code == 404:
            print(f"❌ {endpoint} -> 404 Not Found")
        else:
            print(f"⚠️ {endpoint} -> {response.status_code}")

    except requests.exceptions.ConnectionError:
        print(f"❌ Сервер не відповідає на {base_url}")
        print("   Запустіть: uvicorn main:app --reload --port 8001")
        break
    except Exception as e:
        print(f"❌ {endpoint} -> Помилка: {e}")

print("\n" + "=" * 60)
print("Якщо /api/promo-codes/ повертає 404:")
print("1. Перевірте що promo_codes є в імпортах main.py")
print("2. Перевірте що є рядок app.include_router(promo_codes.router...)")
print("3. Перезапустіть сервер")
print("=" * 60)