#!/usr/bin/env python3
"""
Скрипт для виправлення конфігурації Frontend
Запустіть з кореневої папки проекту: python fix_frontend.py
"""

import os
import json

print("=" * 60)
print("🎨 ВИПРАВЛЕННЯ FRONTEND КОНФІГУРАЦІЇ")
print("=" * 60)

# 1. Перевіряємо файл app.js
print("\n1. Оновлення frontend/js/app.js:")

app_js_path = 'frontend/js/app.js'
if os.path.exists(app_js_path):
    with open(app_js_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Перевіряємо чи правильний API URL
    if 'http://localhost:8001' in content:
        print("   ✅ API URL вже правильний (http://localhost:8001)")
    else:
        # Заміняємо на правильний
        content = content.replace('http://localhost:8000', 'http://localhost:8001')
        content = content.replace('https://api.revitbot.com', 'http://localhost:8001')

        with open(app_js_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print("   ✅ API URL оновлено на http://localhost:8001")
else:
    print("   ❌ Файл frontend/js/app.js не знайдено")

# 2. Створюємо конфігураційний файл якщо його немає
print("\n2. Перевірка frontend/js/config.js:")

config_js = """// Frontend Configuration
const CONFIG = {
    API_URL: 'http://localhost:8001',  // Backend API URL
    APP_NAME: 'RevitBot Store',
    VERSION: '1.0.0',

    // Режим розробки
    DEV_MODE: true,

    // Мови
    SUPPORTED_LANGUAGES: ['ua', 'en', 'ru', 'de', 'ar'],
    DEFAULT_LANGUAGE: 'ua',

    // Telegram
    TELEGRAM_BOT_USERNAME: 'revitbot',

    // Features
    FEATURES: {
        BONUSES: true,
        REFERRALS: true,
        PROMOTIONS: true,
        SUBSCRIPTION: true,
        VIP: true,
        RATINGS: true,
        COMMENTS: true
    }
};

// Експортуємо для використання в модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}
"""

config_path = 'frontend/js/config.js'
if not os.path.exists(config_path):
    with open(config_path, 'w', encoding='utf-8') as f:
        f.write(config_js)
    print("   ✅ Створено файл config.js")
else:
    print("   ✅ config.js вже існує")

# 3. Перевіряємо Service Worker
print("\n3. Оновлення frontend/service-worker.js:")

sw_path = 'frontend/service-worker.js'
if os.path.exists(sw_path):
    with open(sw_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Збільшуємо версію кешу
    import re

    match = re.search(r"CACHE_NAME = 'revitbot-cache-v(\d+)'", content)
    if match:
        old_version = int(match.group(1))
        new_version = old_version + 1
        content = re.sub(
            r"CACHE_NAME = 'revitbot-cache-v\d+'",
            f"CACHE_NAME = 'revitbot-cache-v{new_version}'",
            content
        )

        with open(sw_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"   ✅ Service Worker оновлено (v{old_version} -> v{new_version})")
    else:
        print("   ⚠️ Не вдалося оновити версію Service Worker")
else:
    print("   ❌ Service Worker не знайдено")

# 4. Створюємо тестовий HTML для перевірки
print("\n4. Створення тестової сторінки:")

test_html = """<!DOCTYPE html>
<html lang="uk">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>RevitBot Test</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 50px auto;
            padding: 20px;
            background: #f5f5f5;
        }
        .test-block {
            background: white;
            padding: 20px;
            margin: 10px 0;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .status { font-weight: bold; }
        .success { color: green; }
        .error { color: red; }
        button {
            padding: 10px 20px;
            margin: 5px;
            border: none;
            border-radius: 4px;
            background: #2481cc;
            color: white;
            cursor: pointer;
        }
        button:hover { background: #1a5fa0; }
    </style>
</head>
<body>
    <h1>🤖 RevitBot Test Page</h1>

    <div class="test-block">
        <h2>1. API Connection Test</h2>
        <button onclick="testAPI()">Test API</button>
        <div id="api-result"></div>
    </div>

    <div class="test-block">
        <h2>2. Auth Test</h2>
        <button onclick="testAuth()">Test Auth</button>
        <div id="auth-result"></div>
    </div>

    <div class="test-block">
        <h2>3. Archives Test</h2>
        <button onclick="testArchives()">Test Archives</button>
        <div id="archives-result"></div>
    </div>

    <script>
        const API_URL = 'http://localhost:8001';

        async function testAPI() {
            const resultDiv = document.getElementById('api-result');
            try {
                const response = await fetch(API_URL + '/');
                const data = await response.json();
                resultDiv.innerHTML = '<span class="status success">✅ API працює!</span><br>' + 
                                     JSON.stringify(data, null, 2);
            } catch (error) {
                resultDiv.innerHTML = '<span class="status error">❌ API не доступний</span><br>' + error;
            }
        }

        async function testAuth() {
            const resultDiv = document.getElementById('auth-result');
            try {
                const response = await fetch(API_URL + '/api/auth/telegram', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({initData: 'dev_mode=true'})
                });
                const data = await response.json();
                resultDiv.innerHTML = '<span class="status success">✅ Auth працює!</span><br>' + 
                                     JSON.stringify(data, null, 2);
                if (data.token) {
                    localStorage.setItem('test_token', data.token);
                }
            } catch (error) {
                resultDiv.innerHTML = '<span class="status error">❌ Auth помилка</span><br>' + error;
            }
        }

        async function testArchives() {
            const resultDiv = document.getElementById('archives-result');
            try {
                const response = await fetch(API_URL + '/api/archives/list');
                const data = await response.json();
                resultDiv.innerHTML = '<span class="status success">✅ Archives працює!</span><br>' + 
                                     'Знайдено архівів: ' + (data.archives?.length || 0);
            } catch (error) {
                resultDiv.innerHTML = '<span class="status error">❌ Archives помилка</span><br>' + error;
            }
        }
    </script>
</body>
</html>"""

test_path = 'frontend/test.html'
with open(test_path, 'w', encoding='utf-8') as f:
    f.write(test_html)
print(f"   ✅ Створено тестову сторінку: {test_path}")

print("\n" + "=" * 60)
print("📋 ІНСТРУКЦІЇ ДЛЯ ТЕСТУВАННЯ:")
print("=" * 60)
print("""
1. Запустіть Backend сервер:
   cd backend && uvicorn main:app --reload --port 8001

2. Запустіть Frontend сервер:
   cd frontend && python -m http.server 8000

3. Відкрийте в браузері:
   - Основний додаток: http://localhost:8000
   - Тестова сторінка: http://localhost:8000/test.html

4. На тестовій сторінці натисніть кнопки для перевірки:
   - Test API - перевірка з'єднання
   - Test Auth - перевірка авторизації
   - Test Archives - перевірка завантаження архівів
""")