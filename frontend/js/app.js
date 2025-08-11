// RevitBot Web App - Основний файл (Виправлення помилки ініціалізації)
(function() {
    'use strict';

    // ============= CORE CLASSES (без змін) =============
    class Storage { constructor() { this.prefix = 'revitbot_'; } set(key, value) { try { localStorage.setItem(this.prefix + key, JSON.stringify(value)); } catch (e) { console.error('Storage error:', e); } } get(key, defaultValue = null) { try { const item = localStorage.getItem(this.prefix + key); return item ? JSON.parse(item) : defaultValue; } catch (e) { return defaultValue; } } remove(key) { localStorage.removeItem(this.prefix + key); } }
    class Api { constructor(storage, baseURL) { this.storage = storage; this.baseURL = baseURL || 'http://localhost:8001'; this.token = null; } setToken(token) { this.token = token; } async request(endpoint, options = {}) { const config = { ...options, headers: { 'Content-Type': 'application/json', ...options.headers } }; if (this.token) config.headers['Authorization'] = `Bearer ${this.token}`; try { const response = await fetch(`${this.baseURL}${endpoint}`, config); window.dispatchEvent(new Event('connection-restored')); if (!response.ok) { const errorText = await response.text(); throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`); } return await response.json(); } catch (error) { if (error instanceof TypeError && error.message.includes('Failed to fetch')) { window.dispatchEvent(new Event('connection-lost')); } console.error('API request failed:', error); throw error; } } async get(endpoint, options = {}) { const { useCache = false, ttl = 300 } = options; if (!useCache) return this.request(endpoint); const cacheKey = `cache_${endpoint}`; const cachedItem = this.storage.get(cacheKey); if (cachedItem && (Date.now() - cachedItem.timestamp) / 1000 < ttl) { return cachedItem.data; } const data = await this.request(endpoint); this.storage.set(cacheKey, { data: data, timestamp: Date.now() }); return data; } post(endpoint, data) { return this.request(endpoint, { method: 'POST', body: JSON.stringify(data) }); } put(endpoint, data) { return this.request(endpoint, { method: 'PUT', body: JSON.stringify(data) }); } delete(endpoint) { return this.request(endpoint, { method: 'DELETE' }); } }
    class TelegramWebApp { constructor() { this.tg = window.Telegram?.WebApp; this.isAvailable = !!this.tg; } init() { if (this.isAvailable) { this.tg.ready(); this.tg.expand(); if (this.tg.enableClosingConfirmation) this.tg.enableClosingConfirmation(); } } onEvent(eventType, callback) { if (this.isAvailable) this.tg.onEvent(eventType, callback); } getInitData() { return this.isAvailable ? (this.tg.initData || '') : 'dev_mode=true'; } getThemeParams() { return this.isAvailable ? this.tg.themeParams : { bg_color: '#ffffff', text_color: '#000000', hint_color: '#999999' }; } showAlert(message) { try { if (this.isAvailable && this.tg.showAlert) this.tg.showAlert(message); else alert(message); } catch (e) { alert(message); } } }

    // ============= MAIN APP =============
    class RevitWebApp {
        constructor() {
            this.storage = new Storage();
            this.api = new Api(this.storage);
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
            try {
                this.tg.init();
                this.applyTheme();
                this.handleConnectionChange();
                this.setupUI();
                await this.loadTranslations();
                await this.authenticate();

                // Завантажуємо модулі, що залежать від користувача
                if (!window.FavoritesModule) await this.loadScript('js/modules/favorites.js');
                await window.FavoritesModule.init(this);
                if (!window.RatingsModule) await this.loadScript('js/modules/ratings.js');
                await window.RatingsModule.init(this);
                if (!window.NotificationsModule) await this.loadScript('js/modules/notifications.js'); // <-- ДОДАЄМО
                await window.NotificationsModule.init(this); // <-- ДОДАЄМО

                if (!window.ResponsiveModule) await this.loadScript('js/modules/responsive.js');
                window.ResponsiveModule.init();
                this.setupPullToRefresh();

                if (this.user?.isAdmin) await this.preloadAdminModules();

                await this.loadPage('home');
                this.updateCartBadge();
            } catch (error) {
                console.error('❌ Init error:', error);
                this.showError('Failed to initialize app');
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

            // Слухаємо стандартні події браузера (для миттєвої реакції)
            window.addEventListener('online', hideIndicator);
            window.addEventListener('offline', showIndicator);

            // Слухаємо наші власні, надійніші події з Api
            window.addEventListener('connection-lost', showIndicator);
            window.addEventListener('connection-restored', hideIndicator);

            // Початкова перевірка
            if (!navigator.onLine) {
                showIndicator();
            }
        }

        async preloadAdminModules() {
            await this.loadScript('js/modules/admin.js');
            await this.loadScript('js/modules/admin-forms.js');
            await this.loadScript('js/modules/admin-promo-codes.js');
        }

        async authenticate() {
            try {
                const initData = this.tg.getInitData();
                const response = await this.api.post('/api/auth/telegram', { initData });
                if (response.success && response.token) {
                    this.user = response.user;
                    this.storage.set('user', this.user);
                    this.storage.set('token', response.token);
                    this.api.setToken(response.token);
                    if (this.user.isAdmin) document.getElementById('admin-nav').style.display = 'flex';
                }
            } catch (error) {
                const savedToken = this.storage.get('token');
                const savedUser = this.storage.get('user');
                if (savedToken && savedUser) {
                    this.api.setToken(savedToken);
                    this.user = savedUser;
                    if (this.user.isAdmin) document.getElementById('admin-nav').style.display = 'flex';
                }
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
                    default: html = `<h2>404 Not Found</h2>`;
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
            if (this.cart.length === 0) {
                return `<div class="cart-page p-3" style="text-align: center; padding: 50px 20px;"><div style="font-size: 60px; margin-bottom: 20px;">🛒</div><h3>Кошик порожній</h3></div>`;
            }
            const itemsHtml = this.cart.map(item => `...`).join(''); // Ця частина залишається без змін
            const subtotal = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

            // ✅ ЗАМІНІТЬ СТАРИЙ HTML КОШИКА НА ЦЕЙ
            return `
                <div class="cart-page p-3">
                    <h2 style="margin-bottom: 20px;">Ваш кошик</h2>
                    <div>${itemsHtml}</div>

                    <div style="padding: 15px 10px;">
                        <label for="promo-input" style="display: block; margin-bottom: 5px;">Промокод</label>
                        <div style="display: flex; gap: 10px;">
                            <input type="text" id="promo-input" placeholder="Введіть код" style="flex: 1; padding: 12px; border-radius: 8px; border: 1px solid #ccc;">
                            <button onclick="window.app.applyPromoCode()" style="padding: 12px 20px; background: var(--tg-theme-secondary-bg-color); border: none; border-radius: 8px; cursor: pointer;">Застосувати</button>
                        </div>
                        <div id="promo-message" style="font-size: 14px; margin-top: 10px;"></div>
                    </div>

                    <div style="padding: 20px 10px; border-top: 1px solid #ddd; margin-top: 10px;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 10px;"><span>Проміжна сума:</span><span>$${subtotal.toFixed(2)}</span></div>
                        <div id="discount-row" style="display: none; justify-content: space-between; color: green; margin-bottom: 10px;"><span>Знижка:</span><span id="discount-amount"></span></div>
                        <div style="display: flex; justify-content: space-between; font-size: 18px; font-weight: bold;"><span>Всього:</span><span id="total-amount">$${subtotal.toFixed(2)}</span></div>
                    </div>

                    <div style="padding: 10px;">
                        <button onclick="window.app.proceedToCheckout()" style="width: 100%; padding: 15px; font-size: 16px; font-weight: bold; border: none; border-radius: 8px; background-color: var(--tg-theme-button-color); color: var(--tg-theme-button-text-color); cursor: pointer;">${this.t('buttons.checkout')}</button>
                    </div>
                </div>
            `;
        }

        async getProfilePage() {
            if (!this.user) return this.showError('User not authenticated.');
            // Завантажуємо всі необхідні модулі для сторінки профілю
            if (!window.DownloadsModule) await this.loadScript('js/modules/downloads.js');
            if (!window.FavoritesModule) await this.loadScript('js/modules/favorites.js');
            if (!window.HistoryModule) await this.loadScript('js/modules/history.js');
            if (!window.VipModule) await this.loadScript('js/modules/vip.js');
            if (!window.ReferralsModule) await this.loadScript('js/modules/referrals.js');

            const { fullName, username } = this.user;
            const vipBlock = await window.VipModule.renderVipBlock(this);
            const referralsBlock = await window.ReferralsModule.renderReferralBlock(this);
            return `<div class="profile-page p-3">
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 15px; margin-bottom: 25px; background: var(--tg-theme-secondary-bg-color); padding: 15px; border-radius: 12px;">
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=667eea&color=fff&size=64" style="width: 64px; height: 64px; border-radius: 50%;">
                        <div>
                            <h2 style="margin: 0 0 5px;">${fullName}</h2>
                            <p style="margin: 0; color: var(--tg-theme-hint-color);">@${username || 'not_set'}</p>
                        </div>
                    </div>
                </div>
                ${vipBlock}
                ${referralsBlock}
                <div style="margin-top: 30px; display: flex; flex-direction: column; gap: 15px;">
                    <button onclick="window.HistoryModule.showHistoryPage(window.app)" ...>🕒 Історія переглядів</button>
                    <button onclick="window.FavoritesModule.showFavoritesPage(window.app)" ...>❤️ Мої вибрані</button>
                    <button onclick="DownloadsModule.showDownloads(window.app)" ...>📥 Мої завантаження</button>
                </div>
            </div>`;
        }

        async getAdminPage() {
            if (!this.user?.isAdmin) return `<div class="p-3"><h3>Доступ заборонено</h3></div>`;
            if (!window.AdminModule) await this.loadScript('js/modules/admin.js');
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
            if (existingItem) existingItem.quantity++;
            else this.cart.push({ ...product, quantity: 1 });
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

        this.promoCode = null; // Зберігатимемо застосований промокод

        async applyPromoCode() {
            const code = document.getElementById('promo-input').value;
            const subtotal = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            const promoMessage = document.getElementById('promo-message');

            try {
                const response = await this.api.post('/api/orders/apply-promo', { code, subtotal });
                if (response.success) {
                    promoMessage.style.color = 'green';
                    promoMessage.innerText = response.message;
                    document.getElementById('discount-amount').innerText = `- $${response.discount_amount.toFixed(2)}`;
                    document.getElementById('discount-row').style.display = 'flex';
                    document.getElementById('total-amount').innerText = `$${response.final_total.toFixed(2)}`;
                    this.promoCode = code; // Зберігаємо код
                }
            } catch (error) {
                promoMessage.style.color = 'red';
                promoMessage.innerText = error.message || 'Недійсний промокод';
                document.getElementById('discount-row').style.display = 'none';
                document.getElementById('total-amount').innerText = `$${subtotal.toFixed(2)}`;
                this.promoCode = null;
            }
        }

        // Оновіть цю функцію
        proceedToCheckout() {
            if (this.cart.length === 0) return this.tg.showAlert('Кошик порожній!');

            const orderData = {
                items: this.cart,
                promo_code: this.promoCode // Надсилаємо код на сервер
            };

            this.api.post('/api/orders/create', orderData)
                .then(response => {
                    if (response.success) {
                        this.tg.showAlert(`Ваше замовлення #${response.order_id} успішно створено!`);
                        this.cart = [];
                        this.storage.set('cart', []);
                        this.promoCode = null; // Очищаємо промокод
                        this.updateCartBadge();
                        this.loadPage('catalog');
                    }
                })
                .catch(error => this.tg.showAlert(`Помилка: ${error.message}`));
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
                button.style.backgroundColor = '#b0b0b0';
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
                e.preventDefault();
                document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
                item.classList.add('active');
                this.loadPage(item.dataset.page);
            }));
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