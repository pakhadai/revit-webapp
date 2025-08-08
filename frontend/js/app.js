// RevitBot Web App - All in One
(function() {
    'use strict';

    // ============= CORE CLASSES =============

    // Storage Manager
    class Storage {
        constructor() {
            this.prefix = 'revitbot_';
        }

        set(key, value) {
            try {
                localStorage.setItem(this.prefix + key, JSON.stringify(value));
                return true;
            } catch (e) {
                console.error('Storage error:', e);
                return false;
            }
        }

        get(key, defaultValue = null) {
            try {
                const item = localStorage.getItem(this.prefix + key);
                return item ? JSON.parse(item) : defaultValue;
            } catch (e) {
                return defaultValue;
            }
        }

        remove(key) {
            localStorage.removeItem(this.prefix + key);
        }
    }

    // API Client
    class Api {
        constructor(baseURL) {
            this.baseURL = baseURL || 'http://localhost:8001';
            this.token = null;
        }

        setToken(token) {
            this.token = token;
        }

        async request(endpoint, options = {}) {
            const config = {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers,
                }
            };

            if (this.token) {
                config.headers['Authorization'] = `Bearer ${this.token}`;
            }

            try {
                const response = await fetch(this.baseURL + endpoint, config);
                const data = await response.json();
                return data;
            } catch (error) {
                console.error('API error:', error);
                throw error;
            }
        }

        post(endpoint, data) {
            return this.request(endpoint, {
                method: 'POST',
                body: JSON.stringify(data)
            });
        }
    }

    // Telegram Web App
    class TelegramWebApp {
        constructor() {
            this.tg = window.Telegram?.WebApp;
            this.isAvailable = !!this.tg;
        }

        init() {
            if (this.isAvailable) {
                this.tg.ready();
                this.tg.expand();
            }
        }

        getInitData() {
            // For development without Telegram
            if (!this.isAvailable) {
                return 'dev_mode=true';
            }
            return this.tg.initData || '';
        }

        getThemeParams() {
            if (!this.isAvailable) {
                return {
                    bg_color: '#ffffff',
                    text_color: '#000000',
                    hint_color: '#999999',
                    link_color: '#2481cc',
                    button_color: '#2481cc',
                    button_text_color: '#ffffff'
                };
            }
            return this.tg.themeParams;
        }
    }

    // ============= MAIN APP =============

    class RevitWebApp {
        constructor() {
            this.storage = new Storage();
            this.api = new Api();
            this.tg = new TelegramWebApp();
            this.currentPage = 'home';
            this.user = null;
            this.translations = {};
            this.currentLang = 'ua';
        }

        async init() {
            console.log('🚀 Initializing app...');

            try {
                // Initialize Telegram
                this.tg.init();

                // Apply theme
                this.applyTheme();

                // Load translations
                await this.loadTranslations();

                // Try to authenticate
                await this.authenticate();

                // Setup UI
                this.setupUI();

                // Load initial page
                this.loadPage('home');

                // Hide loader and show app
                document.getElementById('app-loader').style.display = 'none';
                document.getElementById('app').style.display = 'block';

                console.log('✅ App initialized successfully');

            } catch (error) {
                console.error('❌ Init error:', error);
                this.showError('Failed to initialize app');
            }
        }

        applyTheme() {
            const theme = this.tg.getThemeParams();
            const root = document.documentElement;

            Object.entries(theme).forEach(([key, value]) => {
                const cssVar = `--tg-theme-${key.replace(/_/g, '-')}`;
                root.style.setProperty(cssVar, value);
            });
        }

        async loadTranslations() {
            try {
                const response = await fetch('/locales/ua.json');
                if (response.ok) {
                    this.translations = await response.json();
                }
            } catch (e) {
                console.warn('Could not load translations');
            }
        }

        t(key) {
            const keys = key.split('.');
            let value = this.translations;

            for (const k of keys) {
                value = value?.[k];
                if (!value) return key;
            }

            return value || key;
        }

        async authenticate() {
            try {
                const initData = this.tg.getInitData();

                const response = await this.api.post('/api/auth/telegram', {
                    initData: initData
                });

                if (response.success) {
                    this.user = response.user;
                    this.storage.set('user', response.user);
                    this.storage.set('token', response.token);
                    this.api.setToken(response.token);

                    // Show admin nav if needed
                    if (response.user.isAdmin) {
                        document.getElementById('admin-nav').style.display = 'flex';
                    }

                    console.log('✅ Authenticated as:', response.user.username);
                }
            } catch (error) {
                console.error('Auth failed:', error);
                // Continue without auth for now
            }
        }

        setupUI() {
            // Setup navigation
            const navItems = document.querySelectorAll('.nav-item');
            navItems.forEach(item => {
                item.addEventListener('click', (e) => {
                    e.preventDefault();

                    // Update active state
                    navItems.forEach(nav => nav.classList.remove('active'));
                    item.classList.add('active');

                    // Load page
                    const page = item.dataset.page;
                    this.loadPage(page);
                });
            });

            // Setup search button
            const searchBtn = document.getElementById('search-btn');
            if (searchBtn) {
                searchBtn.addEventListener('click', () => {
                    this.showSearch();
                });
            }
        }

        loadPage(page) {
            console.log('Loading page:', page);
            this.currentPage = page;

            const content = document.getElementById('app-content');

            // Clear content
            content.innerHTML = '<div class="loader-container"><div class="loader"></div></div>';

            // Load page content
            setTimeout(() => {
                let html = '';

                switch(page) {
                    case 'home':
                        html = this.getHomePage();
                        break;
                    case 'catalog':
                        html = this.getCatalogPage();
                        break;
                    case 'cart':
                        html = this.getCartPage();
                        break;
                    case 'profile':
                        html = this.getProfilePage();
                        break;
                    case 'admin':
                        html = this.getAdminPage();
                        break;
                    default:
                        html = '<div class="p-3"><h2>404</h2><p>Page not found</p></div>';
                }

                content.innerHTML = html;
            }, 100);
        }

        getHomePage() {
            return `
                <div class="home-page">
                    <div class="welcome-section p-4">
                        <h2 style="color: var(--primary-color); margin-bottom: 10px;">
                            ${this.t('app.name')}
                        </h2>
                        <p style="color: var(--tg-theme-hint-color);">
                            Високоякісні Revit-сімейства для ваших проектів
                        </p>
                    </div>

                    <div class="section p-3">
                        <h3 style="margin-bottom: 15px;">🔥 Новинки</h3>
                        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px;">
                            ${this.getProductCard('Двері та вікна', 9.99)}
                            ${this.getProductCard('Меблі офісні', 14.99)}
                            ${this.getProductCard('Сантехніка', 12.99)}
                            ${this.getProductCard('Освітлення', 7.99)}
                        </div>
                    </div>

                    <div class="section p-3">
                        <h3 style="margin-bottom: 15px;">💎 Преміум колекції</h3>
                        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px;">
                            ${this.getProductCard('Архітектурні елементи', 29.99, true)}
                            ${this.getProductCard('Ландшафтний дизайн', 24.99, true)}
                        </div>
                    </div>
                </div>
            `;
        }

        getProductCard(title, price, isPremium = false) {
            return `
                <div style="
                    background: var(--tg-theme-bg-color);
                    border: 1px solid var(--tg-theme-secondary-bg-color);
                    border-radius: 12px;
                    padding: 12px;
                    cursor: pointer;
                " onclick="app.showProduct('${title}')">
                    <div style="
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        height: 120px;
                        border-radius: 8px;
                        margin-bottom: 10px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: white;
                        font-size: 40px;
                    ">
                        ${isPremium ? '💎' : '📦'}
                    </div>
                    <h4 style="margin: 0 0 5px; font-size: 14px;">${title}</h4>
                    <div style="
                        color: var(--primary-color);
                        font-weight: bold;
                        font-size: 16px;
                    ">$${price}</div>
                </div>
            `;
        }

        getCatalogPage() {
            return `
                <div class="catalog-page p-3">
                    <h2 style="margin-bottom: 20px;">Каталог</h2>

                    <div style="margin-bottom: 20px;">
                        <input type="text" placeholder="Пошук..." style="
                            width: 100%;
                            padding: 10px;
                            border: 1px solid var(--tg-theme-secondary-bg-color);
                            border-radius: 8px;
                            font-size: 16px;
                        ">
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px;">
                        ${this.getProductCard('Pack 01.2024', 9.99)}
                        ${this.getProductCard('Pack 02.2024', 9.99)}
                        ${this.getProductCard('Pack 03.2024', 9.99)}
                        ${this.getProductCard('Pack 04.2024', 9.99)}
                        ${this.getProductCard('Pack 05.2024', 9.99)}
                        ${this.getProductCard('Pack 06.2024', 9.99)}
                    </div>
                </div>
            `;
        }

        getCartPage() {
            const cartItems = this.storage.get('cart', []);

            if (cartItems.length === 0) {
                return `
                    <div class="cart-page p-3" style="text-align: center; padding: 50px 20px;">
                        <div style="font-size: 60px; margin-bottom: 20px;">🛒</div>
                        <h3>Кошик порожній</h3>
                        <p style="color: var(--tg-theme-hint-color);">
                            Додайте товари з каталогу
                        </p>
                    </div>
                `;
            }

            return `
                <div class="cart-page p-3">
                    <h2>Кошик</h2>
                    <p>У вас ${cartItems.length} товарів</p>
                </div>
            `;
        }

        getProfilePage() {
            const user = this.user || { username: 'Guest', bonuses: 0 };

            return `
                <div class="profile-page p-3">
                    <div style="text-align: center; padding: 20px;">
                        <div style="
                            width: 80px;
                            height: 80px;
                            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                            border-radius: 50%;
                            margin: 0 auto 15px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            color: white;
                            font-size: 32px;
                        ">👤</div>
                        <h3>${user.username}</h3>
                        <p style="color: var(--tg-theme-hint-color);">
                            Бонуси: ${user.bonuses} 💎
                        </p>
                    </div>

                    <div style="padding: 0 20px;">
                        ${this.getMenuItem('🛍️ Мої покупки', 'purchases')}
                        ${this.getMenuItem('💎 Бонусна програма', 'bonuses')}
                        ${this.getMenuItem('🎁 Реферальна система', 'referral')}
                        ${this.getMenuItem('⚙️ Налаштування', 'settings')}
                    </div>
                </div>
            `;
        }

        getMenuItem(title, action) {
            return `
                <div style="
                    padding: 15px;
                    border-bottom: 1px solid var(--tg-theme-secondary-bg-color);
                    cursor: pointer;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                " onclick="app.handleMenuAction('${action}')">
                    <span>${title}</span>
                    <span style="color: var(--tg-theme-hint-color);">›</span>
                </div>
            `;
        }

        getAdminPage() {
            if (!this.user?.isAdmin) {
                return '<div class="p-3"><h3>Access Denied</h3></div>';
            }

            return `
                <div class="admin-page p-3">
                    <h2>Адмін панель</h2>
                    <div style="padding: 20px 0;">
                        ${this.getMenuItem('📊 Статистика', 'stats')}
                        ${this.getMenuItem('👥 Користувачі', 'users')}
                        ${this.getMenuItem('📦 Контент', 'content')}
                        ${this.getMenuItem('💰 Платежі', 'payments')}
                    </div>
                </div>
            `;
        }

        showProduct(title) {
            alert(`Product: ${title}`);
        }

        handleMenuAction(action) {
            alert(`Action: ${action}`);
        }

        showSearch() {
            alert('Search feature coming soon!');
        }

        showError(message) {
            console.error(message);
            const content = document.getElementById('app-content');
            if (content) {
                content.innerHTML = `
                    <div style="text-align: center; padding: 50px;">
                        <h3>Error</h3>
                        <p>${message}</p>
                    </div>
                `;
            }
        }
    }

    // ============= START APP =============

    window.addEventListener('DOMContentLoaded', () => {
        console.log('DOM loaded, starting app...');
        window.app = new RevitWebApp();
        window.app.init();
    });

})();