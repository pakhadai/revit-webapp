// RevitBot Web App - Основний файл (Виправлення помилки ініціалізації)
(function() {
    'use strict';

    // ============= CORE CLASSES (без змін) =============
    class Storage { constructor() { this.prefix = 'revitbot_'; } set(key, value) { try { localStorage.setItem(this.prefix + key, JSON.stringify(value)); } catch (e) { console.error('Storage error:', e); } } get(key, defaultValue = null) { try { const item = localStorage.getItem(this.prefix + key); return item ? JSON.parse(item) : defaultValue; } catch (e) { return defaultValue; } } remove(key) { localStorage.removeItem(this.prefix + key); } }
    class Api { constructor(storage, baseURL) { this.storage = storage; this.baseURL = baseURL || 'https://aa6bc8661952.ngrok-free.app/'; this.token = null; } setToken(token) { this.token = token; } async request(endpoint, options = {}) { const config = { ...options, headers: { 'Content-Type': 'application/json', ...options.headers } }; if (this.token) config.headers['Authorization'] = `Bearer ${this.token}`; try { const response = await fetch(`${this.baseURL}${endpoint}`, config); window.dispatchEvent(new Event('connection-restored')); if (!response.ok) { const errorText = await response.text(); throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`); } return await response.json(); } catch (error) { if (error instanceof TypeError && error.message.includes('Failed to fetch')) { window.dispatchEvent(new Event('connection-lost')); } console.error('API request failed:', error); throw error; } } async get(endpoint, options = {}) { const { useCache = false, ttl = 300 } = options; if (!useCache) return this.request(endpoint); const cacheKey = `cache_${endpoint}`; const cachedItem = this.storage.get(cacheKey); if (cachedItem && (Date.now() - cachedItem.timestamp) / 1000 < ttl) { return cachedItem.data; } const data = await this.request(endpoint); this.storage.set(cacheKey, { data: data, timestamp: Date.now() }); return data; } post(endpoint, data) { return this.request(endpoint, { method: 'POST', body: JSON.stringify(data) }); } put(endpoint, data) { return this.request(endpoint, { method: 'PUT', body: JSON.stringify(data) }); } delete(endpoint) { return this.request(endpoint, { method: 'DELETE' }); } }
    class TelegramWebApp {
        constructor() {
            this.tg = window.Telegram?.WebApp;
            this.isAvailable = !!this.tg;
        }

        init() {
            if (this.isAvailable) {
                this.tg.ready();
                this.tg.expand();

                // Перевіряємо версію перед викликом
                if (this.tg.version && parseFloat(this.tg.version) >= 6.1) {
                    if (this.tg.enableClosingConfirmation) {
                        this.tg.enableClosingConfirmation();
                    }
                }
            }
        }

        onEvent(eventType, callback) {
            if (this.isAvailable) this.tg.onEvent(eventType, callback);
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
            try {
                if (this.isAvailable && this.tg.showAlert) this.tg.showAlert(message);
                else alert(message);
            } catch (e) {
                alert(message);
            }
        }
    }


    // ============= MAIN APP =============
    class RevitWebApp {
        constructor() {
            this.storage = new Storage();
            this.api = new Api(this.storage, 'https://aa6bc8661952.ngrok-free.app/');
            this.tg = new TelegramWebApp();
            this.currentPage = 'home';
            this.user = null;
            this.translations = {};
            this.currentLang = 'ua';
            this.productsCache = [];
            this.cart = this.storage.get('cart', []);
            this.isRefreshing = false;
            this.promoCode = null;
        }

        async init() {
            try {
                this.tg.init();
                this.applyTheme();
                this.handleConnectionChange();
                this.setupUI();
                await this.loadTranslations();

                // Аутентифікація та отримання результату
                const authResult = await this.authenticate();

                // Перевіряємо успішність аутентифікації
                if (authResult && authResult.success) {
                    this.api.setToken(authResult.token);
                    this.user = authResult.user;

                    // Перевірка на нового користувача
                    if (!window.OnboardingModule) {
                        await this.loadScript('js/modules/onboarding.js');
                    }

                    const isNewUser = await window.OnboardingModule.checkIfNewUser(this);
                    if (isNewUser) {
                        // Показуємо онбординг для нових
                        await window.OnboardingModule.showWelcome(this);
                    } else {
                        // Звичайне завантаження для існуючих
                        await this.loadUserData();
                        await this.loadProducts();
                    }

                    // Завантажуємо модулі після аутентифікації
                    if (!window.FavoritesModule) await this.loadScript('js/modules/favorites.js');
                    await window.FavoritesModule.init(this);

                    if (!window.RatingsModule) await this.loadScript('js/modules/ratings.js');
                    await window.RatingsModule.init(this);

                    if (!window.NotificationsModule) await this.loadScript('js/modules/notifications.js');
                    await window.NotificationsModule.init(this);

                    if (!window.CartModule) await this.loadScript('js/modules/cart.js');
                    await window.CartModule.init(this);

                    if (!window.ResponsiveModule) await this.loadScript('js/modules/responsive.js');
                    window.ResponsiveModule.init();

                    this.setupPullToRefresh();

                    // Адмін модулі
                    if (this.user?.isAdmin) {
                        await this.preloadAdminModules();
                    }

                    // Навігація
                    const initialPage = window.location.pathname.replace('/', '') || 'home';
                    await this.navigateTo(initialPage, true);

                    // Обробник кнопки "назад"
                    window.onpopstate = (event) => {
                        const page = event.state?.page || 'home';
                        this.loadPage(page);
                        this.updateActiveNav(page);
                    };

                    this.updateCartBadge();
                } else {
                    // Якщо аутентифікація не вдалася
                    console.error('Authentication failed');
                    this.showError('Failed to authenticate');
                }

            } catch (error) {
                console.error('❌ Init error:', error);
                this.showError('Failed to initialize app');
            }
        }


        async navigateTo(page, replace = false) {
            await this.loadPage(page);
            this.updateActiveNav(page);

            // Оновлюємо URL в адресному рядку
            const path = `/${page}`;
            if (replace) {
                history.replaceState({ page: page }, '', path);
            } else {
                history.pushState({ page: page }, '', path);
            }
        }

        // ЗМІНА 2: Логіка тепер слухає і стандартні, і наші власні події
        handleConnectionChange() {
            let indicator = document.getElementById('offline-indicator');
            if (!indicator) {
                indicator = document.createElement('div');
                indicator.id = 'offline-indicator';
                indicator.innerHTML = `<div class="offline-dot"></div> Офлайн`;
                document.body.appendChild(indicator);
            }
            const showIndicator = () => indicator.classList.add('visible');
            const hideIndicator = () => indicator.classList.remove('visible');
            window.addEventListener('online', hideIndicator);
            window.addEventListener('offline', showIndicator);
            window.addEventListener('connection-lost', showIndicator);
            window.addEventListener('connection-restored', hideIndicator);
            if (!navigator.onLine) showIndicator();
        }

        async preloadAdminModules() {
            await this.loadScript('js/modules/admin.js');
            await this.loadScript('js/modules/admin-forms.js'); // Додайте цей рядок
            await this.loadScript('js/modules/admin-promo-codes.js');
        }

        async authenticate() {
            try {
                const initData = this.tg.getInitData();
                const authResult = await this.api.post('/api/auth/telegram', { initData });

                if (authResult.success) {
                    this.storage.set('token', authResult.token);
                    this.storage.set('user', authResult.user);
                    return authResult; // ВАЖЛИВО: повертаємо результат
                }

                return { success: false };
            } catch (error) {
                console.error('Auth error:', error);

                // Спробуємо використати збережені дані
                const savedToken = this.storage.get('token');
                const savedUser = this.storage.get('user');

                if (savedToken && savedUser) {
                    this.api.setToken(savedToken);
                    this.user = savedUser;
                    return { success: true, token: savedToken, user: savedUser };
                }

                return { success: false };
            }
        }

        async loadUserData() {
            try {
                // Запитуємо свіжі дані користувача з сервера
                const userData = await this.api.get('/api/auth/me');
                if (userData) {
                    this.user = { ...this.user, ...userData }; // Оновлюємо, зберігаючи існуючі дані
                    this.storage.set('user', this.user); // Зберігаємо оновлені дані
                    console.log('User data updated:', this.user);

                    // Оновлюємо UI, якщо адмін-панель має бути видимою
                    const adminNav = document.getElementById('admin-nav');
                    if (adminNav) {
                        adminNav.style.display = this.user.isAdmin ? 'flex' : 'none';
                    }
                }
            } catch (error) {
                console.error('Failed to refresh user data:', error);
                // Не критична помилка, можна продовжувати з кешованими даними
            }
        }

        async loadProducts() {
            try {
                // Завантажуємо першу сторінку товарів для кешу
                const response = await this.api.get('/api/archives/paginated/list?page=1&limit=12', { useCache: true });
                if (response && response.items) {
                    this.productsCache = response.items;
                    console.log('Products pre-cached:', this.productsCache.length);
                }
            } catch (error) {
                console.error('Failed to pre-cache products:', error);
            }
        }

        async loadPage(page) {
            this.currentPage = page;
            const content = document.getElementById('app-content');
            content.innerHTML = `<div class="loader-container"><div class="loader"></div></div>`;
            let html = '';
            try {
                switch (page) {
                    case 'home': html = await this.getHomePage(); break;
                    case 'catalog':
                        html = await this.getCatalogPage();
                        setTimeout(() => {
                           if (window.CatalogModule && window.CatalogModule.initInfiniteScroll) {
                               window.CatalogModule.initInfiniteScroll(this);
                           }
                        }, 0);
                        break;
                    case 'cart': html = this.getCartPage(); break;
                    case 'profile': html = await this.getProfilePage(); break;
                    case 'admin': html = await this.getAdminPage(); break;
                    default: html = `<h2>404 Not Found</h2><p>Сторінку '/${page}' не знайдено.</p>`;
                }
            } catch (error) {
                html = this.showError(`Failed to load page: ${page}. ${error.message}`);
            }
            content.innerHTML = html;
        }

        setupPullToRefresh() {
            this.tg.onEvent('viewportChanged', async (event) => {
                if (!event.isStateStable && !this.isRefreshing && window.scrollY === 0) {
                    this.isRefreshing = true;
                    if (this.tg.isAvailable && this.tg.HapticFeedback) this.tg.HapticFeedback.impactOccurred('light');
                    await this.refreshPage();
                    setTimeout(() => { this.isRefreshing = false; }, 500);
                }
            });
        }

        async refreshPage() {
            await this.loadPage(this.currentPage);
             if (this.tg.isAvailable && this.tg.HapticFeedback) this.tg.HapticFeedback.notificationOccurred('success');
        }

        async getHomePage() {
            if (!window.SubscriptionModule) await this.loadScript('js/modules/subscription.js');
            if (!window.DailyBonusModule) await this.loadScript('js/modules/daily-bonus.js');
            const subscriptionBlock = await window.SubscriptionModule.renderSubscriptionBlock(this);
            const dailyBonusBlock = await window.DailyBonusModule.renderDailyBonusBlock(this);
            return `<div class="home-page p-3"><h2>${this.t('app.name')}</h2>${subscriptionBlock}<div id="daily-bonus-block">${dailyBonusBlock}</div></div>`;
        }

        async getCatalogPage() {
            // Завантажуємо всі модулі
            if (!window.CatalogModule) await this.loadScript('js/modules/catalog.js');
            if (!window.ProductDetailsModule) await this.loadScript('js/modules/product-details.js');
            if (!window.RatingsModule) await this.loadScript('js/modules/ratings.js');
            if (!window.FavoritesModule) await this.loadScript('js/modules/favorites.js');
            if (!window.HistoryModule) await this.loadScript('js/modules/history.js');
            if (!window.CommentsModule) await this.loadScript('js/modules/comments.js');

            // Ініціалізуємо модулі які потребують app
            if (window.RatingsModule && !window.RatingsModule.app) {
                await window.RatingsModule.init(this);
            }

            if (window.CommentsModule && !window.CommentsModule.app) {
                await window.CommentsModule.init(this);
            }

            if (window.FavoritesModule && !window.FavoritesModule.app) {
                await window.FavoritesModule.init(this);
            }

            return await window.CatalogModule.getPage(this);
        }

        getCartPage() {
            // Перевіряємо чи завантажений модуль
            if (!window.CartModule) {
                return `<div class="p-3">${this.t('app.loading')}</div>`;
            }

            // Використовуємо модуль кошика
            return window.CartModule.getPage();
        }

        async getProfilePage() {
            if (!this.user) return this.showError('User not authenticated.');

            // Завантажуємо всі необхідні модулі для сторінки профілю
            if (!window.DownloadsModule) await this.loadScript('js/modules/downloads.js');
            if (!window.FavoritesModule) await this.loadScript('js/modules/favorites.js');
            if (!window.HistoryModule) await this.loadScript('js/modules/history.js');
            if (!window.VipModule) await this.loadScript('js/modules/vip.js');
            if (!window.ReferralsModule) await this.loadScript('js/modules/referrals.js');
            if (!window.UserSettingsModule) await this.loadScript('js/modules/user-settings.js');

            const { fullName, username } = this.user;
            const vipBlock = await window.VipModule.renderVipBlock(this);
            const referralsBlock = await window.ReferralsModule.renderReferralBlock(this);

            return `
                <div class="profile-page p-3">
                    <!-- Профіль користувача -->
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 15px; margin-bottom: 25px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 16px; color: white;">
                        <div style="display: flex; align-items: center; gap: 15px;">
                            <div style="width: 64px; height: 64px; background: rgba(255,255,255,0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: bold;">
                                ${fullName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <h2 style="margin: 0 0 5px; color: white;">${fullName}</h2>
                                <p style="margin: 0; color: rgba(255,255,255,0.8);">@${username || 'not_set'}</p>
                            </div>
                        </div>
                    </div>

                    <!-- VIP блок -->
                    ${vipBlock}

                    <!-- Реферальний блок -->
                    ${referralsBlock}

                    <!-- Основні кнопки з емодзі та градієнтами -->
                    <div style="margin-top: 30px;">
                        <h3 style="margin-bottom: 15px; color: var(--tg-theme-text-color);">📱 Мої розділи</h3>
                        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">

                            <!-- Мої завантаження -->
                            <button onclick="DownloadsModule.showDownloads(window.app)"
                                    style="position: relative; overflow: hidden; padding: 20px 15px; background: linear-gradient(135deg, #00C9FF 0%, #92FE9D 100%); border: none; border-radius: 12px; cursor: pointer; transition: transform 0.2s;">
                                <div style="position: relative; z-index: 1;">
                                    <div style="font-size: 32px; margin-bottom: 8px;">📥</div>
                                    <div style="font-size: 14px; font-weight: 600; color: white;">Завантаження</div>
                                </div>
                            </button>

                            <!-- Мої вибрані -->
                            <button onclick="window.FavoritesModule.showFavoritesPage(window.app)"
                                    style="position: relative; overflow: hidden; padding: 20px 15px; background: linear-gradient(135deg, #FC466B 0%, #3F5EFB 100%); border: none; border-radius: 12px; cursor: pointer; transition: transform 0.2s;">
                                <div style="position: relative; z-index: 1;">
                                    <div style="font-size: 32px; margin-bottom: 8px;">❤️</div>
                                    <div style="font-size: 14px; font-weight: 600; color: white;">Вибрані</div>
                                </div>
                            </button>

                            <!-- Історія переглядів -->
                            <button onclick="window.HistoryModule.showHistoryPage(window.app)"
                                    style="position: relative; overflow: hidden; padding: 20px 15px; background: linear-gradient(135deg, #FDBB2D 0%, #22C1C3 100%); border: none; border-radius: 12px; cursor: pointer; transition: transform 0.2s;">
                                <div style="position: relative; z-index: 1;">
                                    <div style="font-size: 32px; margin-bottom: 8px;">🕒</div>
                                    <div style="font-size: 14px; font-weight: 600; color: white;">Історія</div>
                                </div>
                            </button>

                            <!-- Сповіщення -->
                            <button onclick="window.app.loadScript('js/modules/notifications.js').then(() => window.NotificationsModule.showNotifications(window.app))"
                                    style="position: relative; overflow: hidden; padding: 20px 15px; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); border: none; border-radius: 12px; cursor: pointer; transition: transform 0.2s;">
                                <div style="position: relative; z-index: 1;">
                                    <div style="font-size: 32px; margin-bottom: 8px;">🔔</div>
                                    <div style="font-size: 14px; font-weight: 600; color: white;">Сповіщення</div>
                                </div>
                            </button>
                        </div>
                    </div>

                    <!-- Додаткові функції -->
                    <div style="margin-top: 25px;">
                        <h3 style="margin-bottom: 15px; color: var(--tg-theme-text-color);">⚙️ Додатково</h3>
                        <div style="display: flex; flex-direction: column; gap: 10px;">

                            <!-- Мова -->
                            <button onclick="window.app.showLanguageModal()"
                                    style="display: flex; align-items: center; justify-content: space-between; padding: 15px; background: var(--tg-theme-bg-color); border: 1px solid var(--tg-theme-secondary-bg-color); border-radius: 10px; cursor: pointer;">
                                <div style="display: flex; align-items: center; gap: 12px;">
                                    <span style="font-size: 20px;">🌐</span>
                                    <span style="font-size: 14px;">Мова інтерфейсу</span>
                                </div>
                                <span style="color: var(--tg-theme-hint-color); font-size: 12px;">${this.currentLang === 'ua' ? 'Українська' : 'English'}</span>
                            </button>

                            <!-- Підтримка -->
                            <button onclick="window.open('https://t.me/revitbot_support', '_blank')"
                                    style="display: flex; align-items: center; justify-content: space-between; padding: 15px; background: var(--tg-theme-bg-color); border: 1px solid var(--tg-theme-secondary-bg-color); border-radius: 10px; cursor: pointer;">
                                <div style="display: flex; align-items: center; gap: 12px;">
                                    <span style="font-size: 20px;">💬</span>
                                    <span style="font-size: 14px;">Підтримка</span>
                                </div>
                                <span style="color: var(--tg-theme-hint-color);">→</span>
                            </button>

                            <!-- Про додаток -->
                            <button onclick="window.app.showAboutModal()"
                                    style="display: flex; align-items: center; justify-content: space-between; padding: 15px; background: var(--tg-theme-bg-color); border: 1px solid var(--tg-theme-secondary-bg-color); border-radius: 10px; cursor: pointer;">
                                <div style="display: flex; align-items: center; gap: 12px;">
                                    <span style="font-size: 20px;">ℹ️</span>
                                    <span style="font-size: 14px;">Про додаток</span>
                                </div>
                                <span style="color: var(--tg-theme-hint-color); font-size: 12px;">v1.0.0</span>
                            </button>
                        </div>
                    </div>

                    <style>
                        .profile-page button:hover {
                            transform: translateY(-2px);
                            box-shadow: 0 5px 15px rgba(0,0,0,0.2);
                        }
                        .profile-page button:active {
                            transform: translateY(0);
                        }
                    </style>
                </div>
            `;
        }

        async getAdminPage() {
            if (!this.user?.isAdmin) return `<div class="p-3"><h3>Доступ заборонено</h3></div>`;

            // Завантажуємо ОБИДВА скрипти ПЕРЕД тим, як щось робити
            await this.loadScript('js/modules/admin.js');
            await this.loadScript('js/modules/admin-forms.js');

            // Тепер, коли обидва файли завантажені, можна викликати функцію
            return await window.AdminModule.getDashboard(this);
        }

        async loadScript(src) {
            return new Promise((resolve, reject) => {
                if (document.querySelector(`script[src="${src}"]`)) {
                    return resolve();
                }
                const script = document.createElement('script');
                script.src = src;
                script.onload = resolve;
                script.onerror = () => {
                    console.error(`Failed to load: ${src}`);
                    // Fallback для критичних модулів
                    if (src.includes('notifications')) {
                        window.NotificationsModule = {
                            init: () => {},
                            showNotifications: () => {}
                        };
                        resolve();
                    } else {
                        reject(new Error(`Failed to load ${src}`));
                    }
                };
                document.head.appendChild(script);
            });
        }

        addToCart(productId) {
            const product = this.productsCache.find(p => p.id == productId);
            if (!product) return;

            const existingItem = this.cart.find(item => item.id == productId);
            if (existingItem) {
                existingItem.quantity++;
                this.tg.showAlert(`${this.t('cart.quantityUpdated')}`);
            } else {
                const finalPrice = product.discount_percent > 0
                    ? (product.price * (1 - product.discount_percent / 100))
                    : product.price;

                this.cart.push({
                    ...product,
                    quantity: 1,
                    finalPrice: finalPrice
                });

                // Показуємо повідомлення
                this.tg.showAlert(`✅ ${this.t('cart.itemAdded') || 'Додано в кошик'}`);
            }

            this.storage.set('cart', this.cart);
            this.updateCartBadge();
            this.updateProductButton(productId);
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
                button.textContent = this.t('buttons.inCart');
                button.disabled = true;
                button.style.backgroundColor = '#b0b0b0';
                button.style.cursor = 'not-allowed';
            }
        }

        applyTheme() {
            const theme = this.tg.getThemeParams();
            Object.entries(theme).forEach(([key, value]) => document.documentElement.style.setProperty(`--tg-theme-${key.replace(/_/g, '-')}`, value));
            if (this.tg.isAvailable && this.tg.setBackgroundColor) this.tg.setBackgroundColor(theme.secondary_bg_color || '#f1f1f1');
        }

        async loadTranslations(lang) {
            const langToLoad = lang || this.currentLang;
            try {
                const response = await fetch(`js/locales/${langToLoad}.json`);
                this.translations = await response.json();
                this.currentLang = langToLoad;
            } catch (error) { console.warn(`Failed to load translation:`, error); }
        }

        t(key) { return key.split('.').reduce((o, i) => o?.[i], this.translations) || key; }

        setupUI() {
            document.querySelectorAll('.nav-item').forEach(item => item.addEventListener('click', (e) => {
                e.preventDefault(); // Запобігаємо стандартній поведінці посилання
                const page = item.dataset.page;
                this.navigateTo(page); // <-- ЗМІНА: Використовуємо нову функцію
            }));
        }

        // <-- НОВА ДОПОМІЖНА ФУНКЦІЯ
        updateActiveNav(page) {
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            const activeItem = document.querySelector(`.nav-item[data-page="${page}"]`);
            if (activeItem) {
                activeItem.classList.add('active');
            }
        }

        showError(message) {
            return `<div style="text-align: center; padding: 50px;"><h3>Помилка</h3><p>${message}</p></div>`;
        }
    }

    // ============= START APP =============
    window.addEventListener('DOMContentLoaded', () => {
        window.app = new RevitWebApp();
        window.app.init();
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/service-worker.js')
                .then(reg => console.log('Service Worker: Зареєстровано'))
                .catch(err => console.log('Service Worker: Помилка реєстрації', err));
        }
    });
})();