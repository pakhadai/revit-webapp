// RevitBot Web App - Основний файл
(function() {
    'use strict';

    // ============= CORE CLASSES =============
    class Storage {
        constructor() { this.prefix = 'revitbot_'; }
        set(key, value) { try { localStorage.setItem(this.prefix + key, JSON.stringify(value)); } catch (e) { console.error('Storage error:', e); } }
        get(key, defaultValue = null) { try { const item = localStorage.getItem(this.prefix + key); return item ? JSON.parse(item) : defaultValue; } catch (e) { return defaultValue; } }
        remove(key) { localStorage.removeItem(this.prefix + key); }
    }

    class Api {
        constructor(baseURL) {
            this.baseURL = baseURL || 'http://localhost:8001';
            this.token = null;
        }

        setToken(token) {
            this.token = token;
            console.log('Token set:', token ? 'Token exists' : 'No token');
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
                console.log('Added Authorization header for:', endpoint);
            } else {
                console.warn('No token available for:', endpoint);
            }

            try {
                console.log(`API Request: ${endpoint}`, { method: config.method, hasAuth: !!this.token });
                const response = await fetch(`${this.baseURL}${endpoint}`, config);
                console.log(`API Response: ${endpoint}`, { status: response.status, ok: response.ok });

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error(`API Error Response: ${endpoint}`, errorText);
                    let errorData;
                    try {
                        errorData = JSON.parse(errorText);
                    } catch {
                        errorData = { detail: errorText || response.statusText };
                    }
                    throw new Error(errorData.detail || `HTTP error! Status: ${response.status}`);
                }

                const data = await response.json();
                return data;
            } catch (error) {
                console.error('API request error:', error);
                throw error;
            }
        }

        get(endpoint) { return this.request(endpoint, { method: 'GET' }); }
        post(endpoint, data) { return this.request(endpoint, { method: 'POST', body: JSON.stringify(data) }); }
        put(endpoint, data) { return this.request(endpoint, { method: 'PUT', body: JSON.stringify(data) }); }
        delete(endpoint) { return this.request(endpoint, { method: 'DELETE' }); }
    }

    class TelegramWebApp {
        constructor() {
            this.tg = window.Telegram?.WebApp;
            this.isAvailable = !!this.tg;
        }

        init() {
            if (this.isAvailable) {
                this.tg.ready();
                this.tg.expand();
                if (this.tg.enableClosingConfirmation) {
                    this.tg.enableClosingConfirmation();
                }
            }
        }

        onEvent(eventType, callback) {
            if (this.isAvailable) {
                this.tg.onEvent(eventType, callback);
            }
        }

        getInitData() {
            return this.isAvailable ? (this.tg.initData || '') : 'dev_mode=true';
        }

        getThemeParams() {
            if (!this.isAvailable) {
                return { bg_color: '#ffffff', text_color: '#000000', hint_color: '#999999', link_color: '#2481cc', button_color: '#2481cc', button_text_color: '#ffffff' };
            }
            return this.tg.themeParams;
        }

        showAlert(message) {
            try {
                if (this.isAvailable && this.tg.showAlert) {
                    this.tg.showAlert(message);
                } else {
                    alert(message);
                }
            } catch (e) {
                console.warn("showAlert unsupported, falling back to browser alert:", e);
                alert(message);
            }
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
            this.productsCache = [];
            this.cart = this.storage.get('cart', []);
            this.isRefreshing = false;
        }

        async init() {
            console.log('🚀 Initializing app...');
            try {
                this.tg.init();
                this.applyTheme();

                await this.loadTranslations();
                await this.authenticate();

                // Паралельно ініціалізуємо ResponsiveModule і PullToRefresh
                await Promise.all([
                    (async () => {
                        if (!window.ResponsiveModule) {
                            await this.loadScript('js/modules/responsive.js');
                        }
                        window.ResponsiveModule.init();
                    })(),
                    (async () => {
                        this.setupPullToRefresh();
                    })()
                ]);

                // Попередньо завантажуємо адмін модулі, якщо користувач - адмін
                if (this.user?.isAdmin) {
                    await this.preloadAdminModules();
                }

                this.setupUI();
                await this.loadPage('home');
                this.updateCartBadge();

                document.getElementById('app-loader').style.display = 'none';
                document.getElementById('app').style.display = 'block';

                console.log('✅ App initialized successfully');
            } catch (error) {
                console.error('❌ Init error:', error);
                this.showError('Failed to initialize app');
            }
        }

        async preloadAdminModules() {
            try {
                console.log('📦 Preloading admin modules...');

                // Завантажуємо основний адмін модуль
                await this.loadScript('js/modules/admin.js');

                // Завантажуємо модуль форм
                await this.loadScript('js/modules/admin-forms.js');

                console.log('✅ Admin modules loaded');
            } catch (error) {
                console.error('⚠️ Failed to preload admin modules:', error);
                // Не критична помилка - модулі завантажаться при потребі
            }
        }

        async authenticate() {
            console.log('🔐 Starting authentication...');
            try {
                const initData = this.tg.getInitData();
                console.log('Init data:', initData ? 'EXISTS' : 'EMPTY');

                const response = await this.api.post('/api/auth/telegram', {
                    initData: initData
                });

                console.log('Auth response:', response);

                if (response.success && response.token) {
                    this.user = response.user;
                    this.storage.set('user', response.user);
                    this.storage.set('token', response.token);
                    this.api.setToken(response.token);

                    console.log('✅ Authentication successful:');
                    console.log('- User:', response.user.username);
                    console.log('- Token stored in storage:', this.storage.get('token') ? 'YES' : 'NO');
                    console.log('- Token set in API:', this.api.token ? 'YES' : 'NO');

                    if (response.user.isAdmin) {
                        document.getElementById('admin-nav').style.display = 'flex';
                    }
                } else {
                    console.error('❌ Authentication failed - no success or token in response:', response);
                }
            } catch(error) {
                console.error('❌ Auth error:', error);
                const savedToken = this.storage.get('token');
                const savedUser = this.storage.get('user');

                if (savedToken && savedUser) {
                    console.log('📱 Restoring session from storage');
                    this.api.setToken(savedToken);
                    this.user = savedUser;
                    console.log('Session restored - API has token:', !!this.api.token);
                } else {
                    console.error('❌ No saved session available');
                }
            }
        }

        // --- РОУТИНГ ---
        async loadPage(page) {
            this.currentPage = page;
            const content = document.getElementById('app-content');
            content.innerHTML = `<div class="loader-container"><div class="loader"></div></div>`;
            let html = '';

            try {
                switch (page) {
                    case 'home':
                        html = await this.getHomePage();
                        break;
                    case 'catalog':
                        html = await this.getCatalogPage();
                        break;
                    case 'cart':
                        html = this.getCartPage();
                        break;
                    case 'profile':
                        html = await this.getProfilePage();
                        break;
                    case 'admin':
                        html = await this.getAdminPage();
                        break;
                    default:
                        html = `<h2>404 Not Found</h2><p>Сторінка "${page}" не знайдена</p>`;
                }
            } catch (error) {
                console.error('Page load error:', error);
                html = this.showError(`Failed to load page: ${page}. ${error.message}`);
            }
            content.innerHTML = html;
        }

        setupPullToRefresh() {
            // Ця функція вмикає відслідковування жесту "потягнути для оновлення"
            this.tg.onEvent('viewportChanged', async (event) => {
                if (!event.isStateStable && !this.isRefreshing && window.scrollY === 0) {
                    this.isRefreshing = true;
                    if (this.tg.isAvailable && this.tg.HapticFeedback) {
                        this.tg.HapticFeedback.impactOccurred('light');
                    }
                    await this.refreshPage();
                    setTimeout(() => { this.isRefreshing = false; }, 500);
                }
            });
        }

        async refreshPage() {
            // Ця функція перезавантажує поточну сторінку
            console.log('🔄 Reloading page:', this.currentPage);
            await this.loadPage(this.currentPage);
             if (this.tg.isAvailable && this.tg.HapticFeedback) {
                this.tg.HapticFeedback.notificationOccurred('success');
            }
        }

        // --- ОСНОВНІ СТОРІНКИ ---
        async getHomePage() {
            // Завантажуємо модулі
            if (!window.SubscriptionModule) {
                await this.loadScript('js/modules/subscription.js');
            }
            if (!window.DailyBonusModule) {
                await this.loadScript('js/modules/daily-bonus.js');
            }

            const subscriptionBlock = await window.SubscriptionModule.renderSubscriptionBlock(this);
            const dailyBonusBlock = await window.DailyBonusModule.renderDailyBonusBlock(this);

            return `
                <div class="home-page p-3">
                    <h2>${this.t('app.name')}</h2>

                    <!-- Блок підписки -->
                    ${subscriptionBlock}

                    <!-- Блок щоденних бонусів -->
                    <div id="daily-bonus-block">
                        ${dailyBonusBlock}
                    </div>

                    <p>Вітаємо в RevitBot Store!</p>
                </div>
            `;
        }

        async getCatalogPage() {
            // Завантажуємо модуль каталогу, якщо ще не завантажений
            if (!window.CatalogModule) {
                await this.loadScript('js/modules/catalog.js');
            }

            // Отримуємо HTML каталогу
            const html = await window.CatalogModule.getPage(this);

            // Повертаємо HTML, а ініціалізацію робимо після рендеру
            setTimeout(async () => {
                // Перевіряємо чи функція існує
                if (window.CatalogModule && window.CatalogModule.initInfiniteScroll) {
                    await window.CatalogModule.initInfiniteScroll(this);
                } else {
                    console.error('CatalogModule.initInfiniteScroll not found, using fallback');
                    // Використовуємо fallback
                    if (window.CatalogModule && window.CatalogModule.loadFallback) {
                        await window.CatalogModule.loadFallback(this);
                    }
                }
            }, 100);

            return html;
        }

        getCartPage() {
            if (this.cart.length === 0) {
                return `<div class="cart-page p-3" style="text-align: center; padding: 50px 20px;">
                            <div style="font-size: 60px; margin-bottom: 20px;">🛒</div>
                            <h3>Кошик порожній</h3>
                            <p style="color: var(--tg-theme-hint-color);">Додайте товари з каталогу</p>
                        </div>`;
            }

            const itemsHtml = this.cart.map(item => `
                <div style="display: flex; align-items: center; padding: 10px; border-bottom: 1px solid var(--tg-theme-secondary-bg-color);">
                    <div style="width: 60px; height: 60px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px; margin-right: 15px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; color: white; font-size: 24px;">
                        ${item.archive_type === 'premium' ? '💎' : '📦'}
                    </div>
                    <div style="flex-grow: 1;">
                        <div style="font-weight: 500;">${item.title.ua}</div>
                        <div style="font-size: 14px; color: var(--tg-theme-hint-color);">Кількість: ${item.quantity}</div>
                    </div>
                    <div style="font-weight: 600; color: var(--primary-color); margin: 0 15px;">$${(item.price * item.quantity).toFixed(2)}</div>
                    <button onclick="window.app.removeFromCart(${item.id})" style="background: transparent; border: none; color: #e74c3c; cursor: pointer; font-size: 24px; padding: 5px;">&times;</button>
                </div>`).join('');

            const total = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

            return `
                <div class="cart-page p-3">
                    <h2 style="margin-bottom: 20px;">Ваш кошик</h2>
                    <div>${itemsHtml}</div>
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 20px 10px; font-size: 18px; font-weight: bold; border-top: 1px solid #ddd; margin-top: 10px;">
                        <span>Всього:</span>
                        <span>$${total.toFixed(2)}</span>
                    </div>
                    <div style="padding: 10px;">
                        <button onclick="window.app.proceedToCheckout()" style="width: 100%; padding: 15px; font-size: 16px; font-weight: bold; border: none; border-radius: 8px; background-color: var(--tg-theme-button-color); color: var(--tg-theme-button-text-color); cursor: pointer;">
                            ${this.t('buttons.checkout')}
                        </button>
                    </div>
                </div>`;
        }

        async getProfilePage() {
            if (!this.user) {
                return this.showError('User not authenticated. Please restart the app.');
            }

            if (!window.DownloadsModule) {
                await this.loadScript('js/modules/downloads.js');
            }

            // Завантажуємо потрібні модулі
            if (!window.VipModule) await this.loadScript('js/modules/vip.js');
            if (!window.ReferralsModule) await this.loadScript('js/modules/referrals.js');

            const { fullName, username, role, bonuses } = this.user;

            const vipBlock = await window.VipModule.renderVipBlock(this);
            const referralsBlock = await window.ReferralsModule.renderReferralBlock(this);

            return `
                <div class="profile-page p-3">
                    <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 25px; background: var(--tg-theme-secondary-bg-color); padding: 15px; border-radius: 12px;">
                         <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=667eea&color=fff&size=64"
                              style="width: 64px; height: 64px; border-radius: 50%;">
                         <div>
                            <h2 style="margin: 0 0 5px;">${fullName}</h2>
                            <p style="margin: 0; color: var(--tg-theme-hint-color);">@${username || 'not_set'}</p>
                         </div>
                    </div>

                    ${vipBlock}

                    ${referralsBlock}

                    <div class="profile-item">
                        <span class="profile-item__label">Бонуси:</span>
                        <span class="profile-item__value">${bonuses} ✨</span>
                    </div>
                     <div class="profile-item">
                        <span class="profile-item__label">Роль:</span>
                        <span class="profile-item__value">${role}</span>
                    </div>

                    <div style="margin-top: 30px;">
                        <button onclick="DownloadsModule.showDownloads(window.app)"
                                style="width: 100%; padding: 15px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 10px; font-size: 16px; font-weight: bold; cursor: pointer; margin-bottom: 15px;">
                            📥 Мої завантаження
                        </button>
                    </div>

                </div>
                <style>
                    .profile-item {
                        background: var(--tg-theme-bg-color);
                        padding: 12px 15px;
                        border-radius: 8px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        font-size: 16px;
                        margin-top: 10px;
                        border: 1px solid var(--tg-theme-secondary-bg-color);
                    }
                    .profile-item__label {
                        color: var(--tg-theme-hint-color);
                    }
                    .profile-item__value {
                        font-weight: 500;
                    }
                </style>
            `;
        }

        // АДМІН ПАНЕЛЬ - буде в окремому файлі
        async getAdminPage() {
            if (!this.user?.isAdmin) {
                return `<div class="p-3"><h3>Доступ заборонено</h3><p>Тільки для адміністраторів</p></div>`;
            }

            // Завантажуємо адмін модуль, якщо ще не завантажений
            if (!window.AdminModule) {
                try {
                    // ВИПРАВЛЕННЯ: правильний шлях до файлу
                    await this.loadScript('js/modules/admin.js');

                    // Чекаємо поки модуль точно завантажиться
                    if (!window.AdminModule) {
                        throw new Error('Admin module failed to load');
                    }
                } catch (error) {
                    console.error('Failed to load admin module:', error);
                    return `<div class="p-3"><h3>Помилка</h3><p>Не вдалося завантажити адмін панель</p></div>`;
                }
            }

            // Тепер безпечно використовуємо модуль
            try {
                return await window.AdminModule.getDashboard(this);
            } catch (error) {
                console.error('Admin dashboard error:', error);
                return `<div class="p-3"><h3>Помилка</h3><p>Помилка завантаження панелі: ${error.message}</p></div>`;
            }
        }

        // --- УТИЛІТАРНІ МЕТОДИ ---
        async loadScript(src) {
            return new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = src;
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        }

        getProductCard(archive) {
            const { id, title, price, archive_type } = archive;
            const isInCart = this.cart.some(item => item.id === id);

            const buttonStyle = `padding: 6px 12px; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500;`;
            let buttonHtml;

            if (isInCart) {
                buttonHtml = `<button id="product-btn-${id}" style="${buttonStyle} background-color: #b0b0b0; color: #fff; cursor: not-allowed;" disabled>${this.t('buttons.inCart')}</button>`;
            } else {
                buttonHtml = `<button id="product-btn-${id}" style="${buttonStyle} background-color: var(--primary-color); color: white;" onclick="window.app.addToCart(${id})">${this.t('buttons.buy')}</button>`;
            }

            return `
                <div class="product-card" style="background: var(--tg-theme-bg-color); border: 1px solid var(--tg-theme-secondary-bg-color); border-radius: 12px; padding: 12px; display: flex; flex-direction: column; justify-content: space-between;">
                    <div>
                        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); height: 120px; border-radius: 8px; margin-bottom: 10px; display: flex; align-items: center; justify-content: center; color: white; font-size: 40px;">
                            ${archive_type === 'premium' ? '💎' : '📦'}
                        </div>
                        <h4 style="margin: 0 0 5px; font-size: 14px; color: var(--tg-theme-text-color);">${title.ua}</h4>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
                        <div style="color: var(--primary-color); font-weight: bold; font-size: 16px;">$${price}</div>
                        ${buttonHtml}
                    </div>
                </div>`;
        }

        // --- ЛОГІКА КОШИКА ---
        addToCart(productId) {
            const product = this.productsCache.find(p => p.id == productId);
            if (!product) return;

            const existingItem = this.cart.find(item => item.id == productId);
            if (existingItem) {
                existingItem.quantity++;
            } else {
                this.cart.push({ ...product, quantity: 1 });
            }

            this.storage.set('cart', this.cart);
            this.updateCartBadge();
            this.updateProductButton(productId);
        }

        removeFromCart(productId) {
            this.cart = this.cart.filter(item => item.id != productId);
            this.storage.set('cart', this.cart);
            this.updateCartBadge();
            this.loadPage('cart');
        }

        proceedToCheckout() {
            console.log('🛒 Starting checkout process...');

            const storedToken = this.storage.get('token');
            if (!storedToken) {
                this.tg.showAlert('Помилка: Немає токена в пам\'яті. Перезапустіть додаток.');
                return;
            }

            if (!this.api.token) {
                this.api.setToken(storedToken);
            }

            if (this.cart.length === 0) {
                this.tg.showAlert('Кошик порожній!');
                return;
            }

            this.api.post('/api/orders/create', { items: this.cart })
                .then(response => {
                    if (response.success) {
                        this.tg.showAlert(`Ваше замовлення #${response.order_id} успішно створено! Сума: $${response.total}`);
                        this.cart = [];
                        this.storage.set('cart', this.cart);
                        this.updateCartBadge();
                        this.loadPage('catalog');
                    } else {
                        this.tg.showAlert(`Помилка: ${response.detail || 'Не вдалося створити замовлення.'}`);
                    }
                })
                .catch(error => {
                    console.error('❌ Checkout error:', error);
                    this.tg.showAlert(`Помилка при оформленні: ${error.message}`);
                });
        }

        updateCartBadge() {
            const badge = document.getElementById('cart-badge');
            if (!badge) return;
            const count = this.cart.reduce((total, item) => total + item.quantity, 0);
            badge.textContent = count;
            badge.style.display = count > 0 ? 'block' : 'none';
        }

        updateProductButton(productId) {
            const button = document.getElementById(`product-btn-${productId}`);
            if (button) {
                button.innerText = this.t('buttons.inCart');
                button.disabled = true;
                button.style.cursor = 'not-allowed';
                button.style.backgroundColor = '#b0b0b0';
            }
        }

        // --- ДОПОМІЖНІ МЕТОДИ ---
        applyTheme() {
            const theme = this.tg.getThemeParams();
            Object.entries(theme).forEach(([key, value]) =>
                document.documentElement.style.setProperty(`--tg-theme-${key.replace(/_/g, '-')}`, value)
            );

            // Встановлюємо колір фону для pull-to-refresh з перевіркою наявності функції
            if (this.tg.isAvailable && this.tg.setBackgroundColor) {
                 this.tg.setBackgroundColor(theme.secondary_bg_color || '#f1f1f1');
            }
        }

        async loadTranslations(lang) {
            const langToLoad = lang || this.currentLang;
            const path = `/js/locales/${langToLoad}.json`;

            try {
                const response = await fetch(path);
                if (response.ok) {
                    this.translations = await response.json();
                    this.currentLang = langToLoad;
                    console.log(`Переклад для '${langToLoad}' успішно завантажено.`);
                }
            } catch (error) {
                console.warn(`Помилка при завантаженні файлу перекладу:`, error);
            }
        }

        t(key) {
            return key.split('.').reduce((o, i) => o?.[i], this.translations) || key;
        }

        setupUI() {
            document.querySelectorAll('.nav-item').forEach(item =>
                item.addEventListener('click', (e) => {
                    e.preventDefault();
                    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
                    item.classList.add('active');
                    this.loadPage(item.dataset.page);
                })
            );
        }

        showError(message) {
            return `<div style="text-align: center; padding: 50px;"><h3>Помилка</h3><p>${message}</p></div>`;
        }
    }

    // ============= START APP =============
    window.addEventListener('DOMContentLoaded', () => {
        window.app = new RevitWebApp();
        window.app.init();
    });
})();