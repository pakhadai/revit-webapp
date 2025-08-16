#!/usr/bin/env python3
"""
🔧 СКРИПТ ПЕРЕВІРКИ ТА ПІДГОТОВКИ TELEGRAM WEB APP
Запускайте перед початком роботи з реальними користувачами
"""

import os
import json
import sys
from pathlib import Path

# Кольори для виводу
GREEN = '\033[92m'
YELLOW = '\033[93m'
RED = '\033[91m'
BLUE = '\033[94m'
RESET = '\033[0m'


def print_header(text):
    print(f"\n{BLUE}{'=' * 60}")
    print(f"  {text}")
    print(f"{'=' * 60}{RESET}\n")


def print_success(text):
    print(f"{GREEN}✅ {text}{RESET}")


def print_warning(text):
    print(f"{YELLOW}⚠️  {text}{RESET}")


def print_error(text):
    print(f"{RED}❌ {text}{RESET}")


def print_info(text):
    print(f"{BLUE}ℹ️  {text}{RESET}")


# Перевірка структури проекту
def check_project_structure():
    print_header("1. ПЕРЕВІРКА СТРУКТУРИ ПРОЕКТУ")

    required_dirs = [
        'backend',
        'backend/api',
        'backend/models',
        'backend/services',
        'backend/database',
        'backend/data',
        'backend/data/premium',
        'backend/data/free',
        'frontend',
        'frontend/js',
        'frontend/js/modules',
        'frontend/css',
        'frontend/images',
        'frontend/locales'
    ]

    missing_dirs = []
    for dir_path in required_dirs:
        if os.path.exists(dir_path):
            print_success(f"Папка {dir_path} існує")
        else:
            missing_dirs.append(dir_path)
            print_warning(f"Створюю папку {dir_path}")
            os.makedirs(dir_path, exist_ok=True)

    if missing_dirs:
        print_info(f"Створено {len(missing_dirs)} відсутніх папок")
    else:
        print_success("Всі необхідні папки на місці")

    return len(missing_dirs) == 0


# Перевірка критичних файлів
def check_critical_files():
    print_header("2. ПЕРЕВІРКА КРИТИЧНИХ ФАЙЛІВ")

    critical_files = {
        'backend/main.py': 'Backend точка входу',
        'backend/config.py': 'Конфігурація backend',
        'backend/requirements.txt': 'Python залежності',
        'frontend/index.html': 'Frontend точка входу',
        'frontend/telegram.html': 'Telegram Web App сторінка',
        'frontend/js/app.js': 'Головний JS додаток',
        'frontend/js/config.js': 'Frontend конфігурація',
        'frontend/css/styles.css': 'Стилі'
    }

    missing_files = []
    for file_path, description in critical_files.items():
        if os.path.exists(file_path):
            print_success(f"{description}: {file_path}")
        else:
            missing_files.append(file_path)
            print_error(f"ВІДСУТНІЙ: {description} ({file_path})")

    if missing_files:
        print_error(f"Відсутні {len(missing_files)} критичних файлів!")
        print_info("Переконайтеся що всі файли проекту на місці")
        return False
    else:
        print_success("Всі критичні файли на місці")
        return True


# Перевірка та створення .env файлу
def check_env_file():
    print_header("3. НАЛАШТУВАННЯ ФАЙЛУ .ENV")

    env_path = 'backend/.env'

    if os.path.exists(env_path):
        print_success(".env файл існує")

        # Читаємо поточний .env
        with open(env_path, 'r', encoding='utf-8') as f:
            env_content = f.read()

        # Перевіряємо критичні параметри
        required_params = ['BOT_TOKEN', 'ADMIN_TELEGRAM_IDS']
        missing_params = []

        for param in required_params:
            if f'{param}=' in env_content:
                # Перевіряємо чи не пустий
                lines = env_content.split('\n')
                for line in lines:
                    if line.startswith(f'{param}='):
                        value = line.split('=', 1)[1].strip()
                        if value and value != f'your_{param.lower()}_here':
                            print_success(f"{param} налаштовано")
                        else:
                            print_warning(f"{param} потребує налаштування")
                            missing_params.append(param)
                        break
            else:
                print_error(f"{param} відсутній в .env")
                missing_params.append(param)

        if missing_params:
            print_warning("\n⚠️  НЕОБХІДНО НАЛАШТУВАТИ:")
            if 'BOT_TOKEN' in missing_params:
                print_info("  1. Отримайте Bot Token від @BotFather")
                print_info("  2. Додайте в .env: BOT_TOKEN=ваш_токен")
            if 'ADMIN_TELEGRAM_IDS' in missing_params:
                print_info("  1. Дізнайтеся свій Telegram ID від @userinfobot")
                print_info("  2. Додайте в .env: ADMIN_TELEGRAM_IDS=ваш_id")
            return False
    else:
        print_warning(".env файл не знайдено, створюю...")

        env_template = """# RevitBot Configuration

# Telegram Bot (ОБОВ'ЯЗКОВО ЗМІНІТЬ!)
BOT_TOKEN=your_bot_token_here
TELEGRAM_BOT_USERNAME=revitbot

# Admin Telegram IDs (ОБОВ'ЯЗКОВО ЗМІНІТЬ!)
ADMIN_TELEGRAM_IDS=123456789

# Database
DATABASE_URL=sqlite+aiosqlite:///./database/database.db

# Security
SECRET_KEY=your-secret-key-change-this-in-production-12345678

# Cryptomus Payment (опціонально)
CRYPTOMUS_MERCHANT_UUID=
CRYPTOMUS_API_KEY=
CRYPTOMUS_WEBHOOK_SECRET=

# App URL (змініть після запуску ngrok)
APP_URL=http://localhost:8001

# Development
DEV_MODE=false
DEBUG=true
"""

        with open(env_path, 'w', encoding='utf-8') as f:
            f.write(env_template)

        print_success(f"Створено {env_path}")
        print_warning("\n⚠️  ВАЖЛИВО: Відредагуйте .env файл:")
        print_info("  1. Додайте BOT_TOKEN від @BotFather")
        print_info("  2. Додайте ваш Telegram ID в ADMIN_TELEGRAM_IDS")
        return False

    return True


# Перевірка локалізації
def check_localization():
    print_header("4. ПЕРЕВІРКА ЛОКАЛІЗАЦІЇ")

    locales = ['ua', 'en']
    locale_files = {}

    for locale in locales:
        file_path = f'frontend/locales/{locale}.json'
        if os.path.exists(file_path):
            with open(file_path, 'r', encoding='utf-8') as f:
                try:
                    locale_data = json.load(f)
                    locale_files[locale] = locale_data
                    print_success(f"Локалізація {locale.upper()}: ✓ ({len(locale_data)} ключів)")
                except json.JSONDecodeError:
                    print_error(f"Помилка в файлі {file_path}")
                    return False
        else:
            print_error(f"Відсутній файл локалізації: {file_path}")
            return False

    # Перевіряємо що ключі однакові
    if len(locale_files) == 2:
        ua_keys = set(locale_files['ua'].keys())
        en_keys = set(locale_files['en'].keys())

        missing_in_en = ua_keys - en_keys
        missing_in_ua = en_keys - ua_keys

        if missing_in_en:
            print_warning(f"Відсутні в EN: {', '.join(list(missing_in_en)[:5])}")
        if missing_in_ua:
            print_warning(f"Відсутні в UA: {', '.join(list(missing_in_ua)[:5])}")

        if not missing_in_en and not missing_in_ua:
            print_success("Всі ключі локалізації синхронізовані")

    return True


# Перевірка модулів frontend
def check_frontend_modules():
    print_header("5. ПЕРЕВІРКА FRONTEND МОДУЛІВ")

    required_modules = [
        'api.js',
        'auth.js',
        'router.js',
        'storage.js',
        'ui.js',
        'cart.js',
        'catalog.js',
        'profile.js',
        'admin.js',
        'game.js',
        'favorites.js',
        'subscription.js',
        'payment.js',
        'referral.js',
        'bonuses.js'
    ]

    missing_modules = []
    for module in required_modules:
        module_path = f'frontend/js/modules/{module}'
        if os.path.exists(module_path):
            print_success(f"Модуль {module}")
        else:
            missing_modules.append(module)
            print_warning(f"Відсутній модуль: {module}")

    if missing_modules:
        print_info(f"Відсутні {len(missing_modules)} модулів")

        # Створюємо відсутній favorites.js якщо його немає
        if 'favorites.js' in missing_modules:
            create_favorites_module()
            print_success("Створено модуль favorites.js")

    return len(missing_modules) == 0


def create_favorites_module():
    """Створює модуль favorites.js якщо його немає"""
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
                const response = await this.app.api.get(`/api/archives/${archiveId}`);
                this.favorites.push({ archive_id: archiveId, archive: response });
                this.app.showToast('Додано в улюблені', 'success');
            }
            return !this.isFavorite(archiveId);
        } catch (error) {
            console.error('Failed to toggle favorite:', error);
            this.app.showToast('Помилка при зміні улюблених', 'error');
            return false;
        }
    },

    renderFavoriteButton(archiveId, container) {
        const isFav = this.isFavorite(archiveId);
        const button = document.createElement('button');
        button.className = `favorite-btn ${isFav ? 'active' : ''}`;
        button.innerHTML = isFav ? '❤️' : '🤍';
        button.onclick = async (e) => {
            e.stopPropagation();
            await this.toggle(archiveId);
            this.renderFavoriteButton(archiveId, container);
        };
        container.innerHTML = '';
        container.appendChild(button);
    }
};
"""

    with open('frontend/js/modules/favorites.js', 'w', encoding='utf-8') as f:
        f.write(favorites_content)


# Перевірка конфігурації
def check_configuration():
    print_header("6. ПЕРЕВІРКА КОНФІГУРАЦІЇ")

    # Frontend config
    config_path = 'frontend/js/config.js'
    if os.path.exists(config_path):
        with open(config_path, 'r', encoding='utf-8') as f:
            content = f.read()

        if "API_URL: ''" in content or "API_URL: '/'," in content:
            print_success("Frontend API_URL налаштовано для production")
        else:
            print_warning("Frontend API_URL може потребувати налаштування")

    # Backend config
    backend_config = 'backend/config.py'
    if os.path.exists(backend_config):
        with open(backend_config, 'r', encoding='utf-8') as f:
            content = f.read()

        if 'DEV_MODE: bool = False' in content or 'DEV_MODE: bool = True' in content:
            print_success("Backend config знайдено")
        else:
            print_warning("Перевірте DEV_MODE в backend/config.py")

    return True


# Головна функція
def main():
    print("\n" + "=" * 60)
    print(f"{BLUE}🚀 ПЕРЕВІРКА ГОТОВНОСТІ TELEGRAM WEB APP{RESET}")
    print("=" * 60)

    all_good = True

    # Виконуємо всі перевірки
    checks = [
        check_project_structure,
        check_critical_files,
        check_env_file,
        check_localization,
        check_frontend_modules,
        check_configuration
    ]

    for check in checks:
        if not check():
            all_good = False

    # Фінальний звіт
    print_header("РЕЗУЛЬТАТИ ПЕРЕВІРКИ")

    if all_good:
        print_success("✅ Додаток готовий до запуску!")
        print("\nНаступні кроки:")
        print("1. Запустіть backend: cd backend && uvicorn main:app --reload --port 8001")
        print("2. Запустіть ngrok: ngrok http 8001")
        print("3. Оновіть URL в @BotFather")
        print("4. Відкрийте бота в Telegram")
    else:
        print_warning("⚠️  Є проблеми які потрібно вирішити")
        print("\nВиправте проблеми вказані вище та запустіть скрипт знову")
        print("\nЯкщо потрібна допомога:")
        print("1. Перевірте що всі файли проекту на місці")
        print("2. Налаштуйте .env файл")
        print("3. Запустіть скрипт знову")

    print("\n" + "=" * 60)


if __name__ == "__main__":
    main()