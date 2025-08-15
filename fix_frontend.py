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
print("\n3. Оновлення Service Worker:")

sw_path = 'frontend/service-worker.js'
if os.path.exists(sw_path):
    with open(sw_path, 'r', encoding='utf-8') as f:
        sw_content = f.read()

    # Перевіряємо чи є favorites.js в кеші
    if "'/js/modules/favorites.js'" not in sw_content:
        print("   ⚠️ favorites.js відсутній в Service Worker cache")
    else:
        print("   ✅ Service Worker налаштований правильно")
else:
    print("   ❌ Service Worker не знайдено")

# 4. Створюємо .env файл якщо його немає
print("\n4. Створення .env файлу:")

env_path = 'backend/.env'
if not os.path.exists(env_path):
    env_content = """# RevitBot Configuration

# Telegram Bot
BOT_TOKEN=your_bot_token_here
TELEGRAM_BOT_USERNAME=revitbot

# Admin Telegram IDs (comma separated)
ADMIN_TELEGRAM_IDS=123456789

# Database
DATABASE_URL=sqlite+aiosqlite:///./database/database.db

# Security
SECRET_KEY=your-secret-key-change-this-in-production

# Cryptomus Payment (optional)
CRYPTOMUS_MERCHANT_UUID=
CRYPTOMUS_API_KEY=
CRYPTOMUS_WEBHOOK_SECRET=

# App URL
APP_URL=http://localhost:8001

# Development
DEV_MODE=true
DEBUG=true
"""

    with open(env_path, 'w', encoding='utf-8') as f:
        f.write(env_content)
    print("   ✅ Створено .env файл (не забудьте додати BOT_TOKEN!)")
else:
    print("   ✅ .env файл вже існує")

# 5. Створюємо відсутній модуль favorites.js
print("\n5. Створення модуля favorites.js:")

favorites_path = 'frontend/js/modules/favorites.js'
if not os.path.exists(favorites_path):
    favorites_content = """// Модуль улюблених товарів
window.FavoritesModule = {
    favorites: [],

    async init(app) {
        this.app = app;
        await this.loadFavorites();
    },

    async loadFavorites() {
        try {
            const response = await this.app.api.get('/api/favorites');
            this.favorites = response.items || [];
        } catch (error) {
            console.error('Failed to load favorites:', error);
            this.favorites = [];
        }
    },

    isFavorite(archiveId) {
        return this.favorites.some(f => f.archive_id === archiveId);
    },

    async toggle(archiveId) {
        try {
            if (this.isFavorite(archiveId)) {
                await this.app.api.delete(`/api/favorites/${archiveId}`);
                this.favorites = this.favorites.filter(f => f.archive_id !== archiveId);
                this.app.showToast('Видалено з улюблених', 'info');
            } else {
                await this.app.api.post('/api/favorites', { archive_id: archiveId });
                this.favorites.push({ archive_id: archiveId });
                this.app.showToast('Додано в улюблені', 'success');
            }
            return true;
        } catch (error) {
            console.error('Failed to toggle favorite:', error);
            this.app.showToast('Помилка', 'error');
            return false;
        }
    },

    async getPage(app) {
        const t = (key) => app.t(key);
        const favorites = await app.api.get('/api/favorites');

        if (!favorites.items || favorites.items.length === 0) {
            return `
                <div class="favorites-page p-3" style="text-align: center; padding: 50px 20px;">
                    <div style="font-size: 80px; margin-bottom: 20px;">❤️</div>
                    <h3>Немає улюблених товарів</h3>
                    <p style="color: var(--tg-theme-hint-color);">
                        Додавайте товари в улюблені, щоб швидко їх знаходити
                    </p>
                    <button onclick="window.app.loadPage('catalog')" 
                            style="margin-top: 20px; padding: 12px 24px; background: var(--primary-color); color: white; border: none; border-radius: 8px;">
                        Перейти до каталогу
                    </button>
                </div>
            `;
        }

        return `
            <div class="favorites-page p-3">
                <h2 style="margin-bottom: 20px;">❤️ Улюблені товари</h2>
                <div class="products-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 15px;">
                    ${favorites.items.map(item => window.CatalogModule.getProductCard(item.archive, app)).join('')}
                </div>
            </div>
        `;
    }
};
"""

    with open(favorites_path, 'w', encoding='utf-8') as f:
        f.write(favorites_content)
    print("   ✅ Створено модуль favorites.js")
else:
    print("   ✅ favorites.js вже існує")

print("\n" + "=" * 60)
print("✅ FRONTEND ВИПРАВЛЕНО!")
print("=" * 60)
print("\n📝 Що далі:")
print("1. Відредагуйте backend/.env - додайте BOT_TOKEN")
print("2. Запустіть створення БД: cd backend && python create_tables.py")
print("3. Запустіть backend: cd backend && uvicorn main:app --reload --port 8001")
print("4. Запустіть frontend: cd frontend && python -m http.server 8000")
print("5. Відкрийте браузер: http://localhost:8000")