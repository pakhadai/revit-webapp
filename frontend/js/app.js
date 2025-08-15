// frontend/js/app.js

// RevitBot Web App - Основний файл (ПОВНА ВЕРСІЯ З ВИПРАВЛЕННЯМИ)
import { config } from './config.js';

'use strict';

// ============= CORE CLASSES =============
class Storage {
    constructor() {
        this.prefix = 'revitbot_';
    }

    set(key, value) {
        try {
            localStorage.setItem(this.prefix + key, JSON.stringify(value));
        } catch (e) {
            console.error('Storage error:', e);
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

class Api {
    constructor(storage, baseURL) {
        this.storage = storage;
        this.baseURL = baseURL || '';
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
                ...options.headers
            }
        };

        if (this.token) {
            config.headers['Authorization'] = `Bearer ${this.token}`;
        }

        const url = this.baseURL ? `${this.baseURL}${endpoint}` : endpoint;
        const response = await fetch(url, config);

        if (!response.ok) {
            if (response.status === 401) {
                // Токен недійсний - перенаправляємо на авторизацію
                window.location.reload();
            }
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }

        return await response.json();
    }

    get(endpoint) {
        return this.request(endpoint);
    }

    post(endpoint, data) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    put(endpoint, data) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    delete(endpoint) {
        return this.request(endpoint, {
            method: 'DELETE'
        });
    }
}

class TelegramWebApp {
    constructor() {
        this.tg = window.Telegram?.WebApp;
        this.isAvailable = !!this.tg;
    }

    async init() {
        console.log('=== DEBUG START ===');
        console.log('Window.Telegram:', window.Telegram);
        console.log('WebApp:', window.Telegram?.WebApp);
        console.log('InitData:', window.Telegram?.WebApp?.initData);
        console.log('InitDataUnsafe:', window.Telegram?.WebApp?.initDataUnsafe);
        console.log('=== DEBUG END ===');

        if (this.isAvailable) {
            this.tg.ready();
            this.tg.expand();

            if (this.tg.version && parseFloat(this.tg.version) >= 6.1) {
                if (this.tg.enableClosingConfirmation) {
                    this.tg.enableClosingConfirmation();
                }
            }
        }
    }

    getInitData() {
        return this.isAvailable ? (this.tg.initData || '') : 'dev_mode=true';
    }

    getThemeParams() {
        return this.isAvailable ? this.tg.themeParams : {
            bg_color: '#ffffff',
            text_color: '#000000',
            hint_color: '#999999'
        };
    }

    showAlert(message) {
        if (this.isAvailable) {
            if (this.tg.version && parseFloat(this.tg.version) >= 6.2) {
                this.tg.showAlert(message);
            } else {
                alert(message);
            }
        } else {
            alert(message);
        }
    }
}

// ============= MAIN APP =============
class RevitWebApp {
    constructor() {
        this.storage = new Storage();
        this.api = new Api(this.storage, config.API_URL);
        this.tg = new TelegramWebApp();
        this.currentPage = 'home';
        this.user = null;
        this.translations = {};
        this.currentLang = 'ua';
        this.cart = this.storage.get('cart', []);
        this.promoCode = null;
    }

    async init() {
        try {
            this.tg.init();
            this.applyTheme();
            this.setupUI();

            await this.loadTranslations();
            const authResult = await this.authenticate();

            if (!authResult || !authResult.success) {
                throw new Error('Authentication failed');
            }

            this.api.setToken(authResult.access_token);
            this.user = authResult.user;

            if (this.user.language_code) {
                this.currentLang = this.user.language_code;
                await this.loadTranslations();
            }

            this.displayUserInfo();

            if (this.user.is_admin) {
                this.enableAdminFeatures();
            }

            await this.loadScript('js/modules/onboarding.js');
            const isNew = await window.OnboardingModule.checkIfNewUser(this);

            if (isNew) {
                await window.OnboardingModule.showWelcome(this);
            } else {
                await this.loadPage('home');
            }

            if (authResult.is_new_user && !isNew) {
                this.showWelcomeMessage();
            }

        } catch (error) {
            console.error('Init error:', error);
            this.showError('Помилка підключення. Спробуйте пізніше.');
        }
    }

    loadScript(src) {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${src}"]`)) {
                return resolve();
            }
            const script = document.createElement('script');
            script.src = src;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`Script load error for ${src}`));
            document.head.append(script);
        });
    }

    async authenticate() {
        try {
            const initData = this.tg?.initData || "dev_mode=true";

            if (!initData) {
                throw new Error("Дані запуску від Telegram порожні. Будь ласка, відкрийте додаток через меню бота.");
            }

            const response = await this.api.post('/api/auth/telegram', {
                init_data: initData
            });

            if (response.access_token) {
                this.storage.set('token', response.access_token);
                this.storage.set('user', response.user);

                return {
                    success: true,
                    access_token: response.access_token,
                    user: response.user,
                    is_new_user: response.is_new_user
                };
            }

            return { success: false };
        } catch (error) {
            console.error('Auth error:', error);
            throw error;
        }
    }

    displayUserInfo() {
        const headerActions = document.querySelector('.header-actions');
        if (!headerActions || !this.user) return;

        const userInfo = document.createElement('div');
        userInfo.className = 'user-info';
        userInfo.innerHTML = `
            ${this.user.avatar_url ?
                `<img src="${this.user.avatar_url}" alt="Avatar" class="user-avatar">` :
                '<div class="user-avatar-placeholder">👤</div>'
            }
            <span class="user-name">${this.user.first_name || this.user.username || 'User'}</span>
            ${this.user.is_admin ? '<span class="admin-badge">Admin</span>' : ''}
        `;

        headerActions.insertBefore(userInfo, headerActions.firstChild);
        this.updateCartCount();
    }

    enableAdminFeatures() {
        const nav = document.getElementById('bottom-nav');
        if (!nav || nav.querySelector('.admin-nav')) return;

        const adminBtn = document.createElement('button');
        adminBtn.className = 'nav-item admin-nav';
        adminBtn.dataset.page = 'admin';
        adminBtn.innerHTML = `
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 15l-2 5 9-11h-4l2-5-9 11h4z"/>
            </svg>
            <span class="nav-label">Admin</span>
        `;

        adminBtn.addEventListener('click', () => this.loadPage('admin'));
        nav.appendChild(adminBtn);
    }

    updateCartCount() {
        const cartCount = document.getElementById('cart-count');
        if (cartCount) {
            const count = this.cart.length;
            cartCount.textContent = count;
            cartCount.style.display = count > 0 ? 'flex' : 'none';
        }
    }

    showWelcomeMessage() {
        const message = `
            Ласкаво просимо, ${this.user.first_name || 'друже'}! 🎉
            ${this.user.bonus_balance > 0 ?
                `Ви отримали ${this.user.bonus_balance} бонусів за реєстрацію!` :
                'Дякуємо за реєстрацію!'}
        `;
        this.tg.showAlert(message);
    }

    showError(message) {
        const container = document.getElementById('app');
        container.innerHTML = `
            <div class="error-container">
                <div class="error-icon">⚠️</div>
                <h2>Помилка</h2>
                <p>${message}</p>
                <button onclick="location.reload()" class="btn btn-primary">
                    Перезавантажити
                </button>
            </div>
        `;
    }

    applyTheme() {
        const theme = this.tg.getThemeParams();
        const root = document.documentElement;

        Object.keys(theme).forEach(key => {
            const cssVar = `--tg-theme-${key.replace(/_/g, '-')}`;
            root.style.setProperty(cssVar, theme[key]);
        });
    }

    setupUI() {
        this.setupNavigation();
        this.setupSearch();
        this.setupCart();
        this.setupLanguageSwitcher();
    }

    setupCart() {
        const cartBtn = document.getElementById('cart-btn');
        const cartSidebar = document.getElementById('cart-sidebar');
        const cartOverlay = document.getElementById('cart-overlay');
        const closeCart = document.getElementById('close-cart');

        if (cartBtn) cartBtn.addEventListener('click', () => {
            cartSidebar?.classList.add('active');
            cartOverlay?.classList.add('active');
        });
        if (closeCart) closeCart.addEventListener('click', () => {
            cartSidebar?.classList.remove('active');
            cartOverlay?.classList.remove('active');
        });
        if (cartOverlay) cartOverlay.addEventListener('click', () => {
            cartSidebar?.classList.remove('active');
            cartOverlay?.classList.remove('active');
        });

        const checkoutBtn = document.getElementById('checkout-btn');
        if (checkoutBtn) checkoutBtn.addEventListener('click', () => this.handleCheckout());
    }

    setupLanguageSwitcher() {
        const langSwitcher = document.getElementById('lang-switcher');
        if (langSwitcher) langSwitcher.addEventListener('click', () => this.switchLanguage());
    }

    async switchLanguage() {
        const languages = ['ua', 'en', 'de'];
        const currentIndex = languages.indexOf(this.currentLang);
        const nextIndex = (currentIndex + 1) % languages.length;
        this.currentLang = languages[nextIndex];

        const langBtn = document.getElementById('current-lang');
        if (langBtn) langBtn.textContent = this.currentLang.toUpperCase();

        await this.loadTranslations();
        await this.loadPage(this.currentPage);
    }

    async handleCheckout() {
        if (this.cart.length === 0) {
            this.tg.showAlert('Кошик порожній!');
            return;
        }
        console.log('Checkout:', this.cart);
    }

    setupNavigation() {
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                const page = e.currentTarget.dataset.page;
                if (page) this.loadPage(page);
            });
        });
    }

    setupSearch() {
        const searchInput = document.getElementById('search-input');
        if (searchInput) searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
    }

    async loadPage(page) {
        this.currentPage = page;
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.page === page);
        });

        const content = document.getElementById('app-content');
        if (!content) return;
        content.innerHTML = '<div class="loader-container"><div class="loader"></div></div>';

        try {
            switch(page) {
                case 'home':
                    await this.loadHomePage();
                    break;
                case 'catalog':
                    await this.loadCatalogPage();
                    break;
                case 'bonuses':
                    await this.loadBonusesPage();
                    break;
                case 'profile':
                    if (!window.ProfileModule) await this.loadScript('js/modules/profile.js');
                    await this.renderPage(await window.ProfileModule.getPage(this));
                    break;
                case 'downloads':
                    if (!window.DownloadsModule) await this.loadScript('js/modules/downloads.js');
                    await window.DownloadsModule.showDownloads(this);
                    break;
                case 'favorites':
                    if (!window.FavoritesModule) await this.loadScript('js/modules/favorites.js');
                    await window.FavoritesModule.showFavoritesPage(this);
                    break;
                case 'history':
                    if (!window.HistoryModule) await this.loadScript('js/modules/history.js');
                    await window.HistoryModule.showHistoryPage(this);
                    break;
                case 'settings':
                    if (!window.UserSettingsModule) await this.loadScript('js/modules/user-settings.js');
                    await window.UserSettingsModule.showSettings(this);
                    break;
                case 'marketplace':
                    if (!window.MarketplaceModule) await this.loadScript('js/modules/marketplace.js');
                    await window.MarketplaceModule.showMarketplace(this);
                    break;
                case 'admin':
                    if (this.user.is_admin) {
                        await this.loadAdminPage();
                    }
                    break;
            }
        } catch (error) {
            console.error('Page load error:', error);
            content.innerHTML = '<div class="error">Помилка завантаження</div>';
        }
    }

    async renderPage(html) {
        const content = document.getElementById('app-content');
        if (content) {
            content.innerHTML = html;
        }
    }

    async loadTranslations() {
        try {
            const lang = (this.currentLang === 'uk') ? 'ua' : this.currentLang;
            const response = await fetch(`/js/locales/${lang}.json`);
            if (response.ok) {
                this.translations = await response.json();
            }
        } catch (error) {
            console.error('Translation load error:', error);
        }
    }

    t(key) {
        const keys = key.split('.');
        let value = this.translations;

        for (const k of keys) {
            value = value?.[k];
            if (!value) break;
        }

        if (!value) {
            console.warn(`Translation not found: ${key}`);
            return key; // Повертаємо сам ключ, якщо переклад не знайдено
        }

        return value;
    }

    handleSearch(query) {
        console.log('Search:', query);
    }

    handleSearch(query) {
        console.log('Search:', query);
    }

    async loadHomePage() {
        const content = document.getElementById('app-content');
        content.innerHTML = '<h2>Головна сторінка</h2>';
    }

    async loadCatalogPage() {
        const content = document.getElementById('app-content');
        content.innerHTML = '<h2>Каталог</h2>';
    }

    async loadBonusesPage() {
        const content = document.getElementById('app-content');
        content.innerHTML = '<h2>Бонуси</h2>';
    }

    async loadAdminPage() {
        const content = document.getElementById('app-content');
        content.innerHTML = '<h2>Адмін панель</h2>';
    }
}

// ============= ЗАПУСК ДОДАТКУ =============
window.addEventListener('DOMContentLoaded', () => {
    const app = new RevitWebApp();
    window.app = app; // Робимо app глобальним для доступу з модулів
    app.init();
});