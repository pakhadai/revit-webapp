# test_all.py - ОНОВЛЕНА ВЕРСІЯ

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
        elif response.status_code == 403:
             return f"⛔️ {name}: Доступ заборонено (працює)"
        elif response.status_code == 404:
            return f"❌ {name}: Not Found (404)"
        elif response.status_code == 405:
            return f"❌ {name}: Method Not Allowed (405)"
        else:
            return f"⚠️ {name}: Status {response.status_code} - {response.text[:100]}"
    except requests.exceptions.ConnectionError:
        return f"❌ {name}: Сервер не доступний"
    except Exception as e:
        return f"❌ {name}: {str(e)}"


print("=" * 60)
print("🧪 ОНОВЛЕНИЙ ТЕСТ ВСІХ КОМПОНЕНТІВ")
print("=" * 60)

# Тест Backend
print("\n📡 BACKEND ТЕСТИ (Публічні):")
print("-" * 40)

backend_tests = [
    ("API Status", "GET", f"{BASE_URL}/"),
    ("API Docs", "GET", f"{BASE_URL}/docs"),
    ("Auth", "POST", f"{BASE_URL}/api/auth/telegram", {"initData": "dev_mode=true"}),
    ("Archives List", "GET", f"{BASE_URL}/api/archives/paginated/list"),
]

token = None
for test in backend_tests:
    result = test_endpoint(*test)
    print(result)
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
    ("App JS", "GET", f"{FRONTEND_URL}/js/app.js"),
]
for test in frontend_tests:
    print(test_endpoint(*test))


# Тест з токеном
if token:
    print("\n🔑 ТЕСТИ З АВТОРИЗАЦІЄЮ:")
    print("-" * 40)
    auth_headers = {"Authorization": f"Bearer {token}"}
    auth_tests = [
        ("My Profile (Auth)", "GET", f"{BASE_URL}/api/auth/me", None, auth_headers),
        ("Daily Bonus Status", "GET", f"{BASE_URL}/api/bonuses/daily-bonus", None, auth_headers),
        ("My Orders", "GET", f"{BASE_URL}/api/orders/check-bonus-limit", None, auth_headers), # Placeholder, needs a real endpoint
        ("Favorites List", "GET", f"{BASE_URL}/api/favorites/", None, auth_headers),
        ("Notifications", "GET", f"{BASE_URL}/api/notifications/", None, auth_headers),
        ("Admin Dashboard", "GET", f"{BASE_URL}/api/admin/dashboard", None, auth_headers),
    ]
    for test in auth_tests:
        print(test_endpoint(*test))
else:
    print("\n⚠️ Не вдалося отримати токен, тести з авторизацією пропущено.")

print("\n" + "=" * 60)
print("✅ Тестування завершено. Перевірте результати вище.")
print("=" * 60)