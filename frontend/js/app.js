// RevitBot Web App - All in One
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
        constructor(baseURL) { this.baseURL = baseURL || 'http://localhost:8001'; this.token = null; }
        setToken(token) { this.token = token; }
        async request(endpoint, options = {}) {
            const config = { ...options, headers: { 'Content-Type': 'application/json', ...options.headers } };
            if (this.token) { config.headers['Authorization'] = `Bearer ${this.token}`; }
            try {
                const response = await fetch(this.baseURL + endpoint, config);
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ detail: response.statusText }));
                    throw new Error(errorData.detail || `HTTP error! Status: ${response.status}`);
                }
                return await response.json();
            } catch (error) {
                console.error('API request error:', error);
                throw error;
            }
        }
        get(endpoint) { return this.request(endpoint, { method: 'GET' }); }
        post(endpoint, data) { return this.request(endpoint, { method: 'POST', body: JSON.stringify(data) }); }
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

        // --- ОНОВЛЕНІ МЕТОДИ З ПЕРЕВІРКОЮ ---
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
        }

        async init() {
            console.log('🚀 Initializing app...');
            try {
                this.tg.init();
                this.applyTheme();
                await this.loadTranslations();
                await this.authenticate();
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
            console.log('Proceeding to checkout with cart:', this.cart);

            this.api.post('/api/orders/create', { items: this.cart })
                .then(response => {
                    console.log('Order creation response:', response);

                    if (response.success) {
                        // Використовуємо showAlert, який ми зробили надійним
                        this.tg.showAlert(`Ваше замовлення #${response.order_id} успішно створено! (Імітація)`);

                        this.cart = [];
                        this.storage.set('cart', this.cart);
                        this.updateCartBadge();
                        this.loadPage('catalog');
                    } else {
                        this.tg.showAlert(`Помилка: ${response.detail || 'Не вдалося створити замовлення.'}`);
                    }
                })
                .catch(error => {
                    console.error('Checkout error:', error);
                    this.tg.showAlert(`Сталася серйозна помилка при оформленні. Спробуйте пізніше.`);
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

        // --- РОУТИНГ І ВІДОБРАЖЕННЯ СТОРІНОК ---
        async loadPage(page) {
            this.currentPage = page;
            const content = document.getElementById('app-content');
            content.innerHTML = `<div class="loader-container"><div class="loader"></div></div>`;
            let html = '';
            try {
                switch (page) {
                    case 'home': html = await this.getHomePage(); break;
                    case 'catalog': html = await this.getCatalogPage(); break;
                    case 'cart': html = this.getCartPage(); break;
                    case 'profile': html = this.getProfilePage(); break;
                    default: html = `<h2>404 Not Found</h2>`;
                }
            } catch (error) {
                html = this.showError(`Failed to load page: ${page}. ${error.message}`);
            }
            content.innerHTML = html;
        }

        async getCatalogPage() {
            try {
                const archives = await this.api.get('/api/archives/');
                this.productsCache = archives;
                if (!archives || archives.length === 0) return `<div class="p-3"><h3>Каталог порожній</h3></div>`;
                const productCards = archives.map(archive => this.getProductCard(archive)).join('');
                return `<div class="catalog-page p-3">
                            <h2 style="margin-bottom: 20px;">Каталог</h2>
                            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 15px;">
                                ${productCards}
                            </div>
                        </div>`;
            } catch (error) {
                return this.showError(`Не вдалося завантажити каталог: ${error.message}`);
            }
        }

        // --- ВІДОБРАЖЕННЯ КОМПОНЕНТІВ ---
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

        getCartPage() {
            if (this.cart.length === 0) {
                return `<div class="cart-page p-3" style="text-align: center; padding: 50px 20px;"><div style="font-size: 60px; margin-bottom: 20px;">🛒</div><h3>Кошик порожній</h3><p style="color: var(--tg-theme-hint-color);">Додайте товари з каталогу</p></div>`;
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

        // --- ІНШІ МЕТОДИ ---
        async getHomePage() { return `<div class="p-4"><h2>${this.t('app.name')}</h2></div>`; }
        getProfilePage() { return `<div class="p-4"><h2>Профіль</h2></div>`; }
        applyTheme() { const theme = this.tg.getThemeParams(); Object.entries(theme).forEach(([key, value]) => document.documentElement.style.setProperty(`--tg-theme-${key.replace(/_/g, '-')}`, value)); }

        async loadTranslations(lang) {
            // Використовуємо мову, яку передали, або поточну мову додатку
            const langToLoad = lang || this.currentLang;
            // Формуємо правильний та динамічний шлях до файлу
            const path = `/js/locales/${langToLoad}.json`;

            try {
                const response = await fetch(path);
                if (response.ok) {
                    this.translations = await response.json();
                    this.currentLang = langToLoad; // Оновлюємо поточну мову
                    console.log(`Переклад для '${langToLoad}' успішно завантажено.`);
                } else {
                    console.error(`Не вдалося завантажити переклад для ${langToLoad}.`);
                    // В майбутньому тут можна буде завантажувати англійську як резервну
                }
            } catch (error) {
                console.warn(`Помилка при завантаженні файлу перекладу:`, error);
            }
        }

        t(key) { return key.split('.').reduce((o, i) => o?.[i], this.translations) || key; }
        async authenticate() { try { const r = await this.api.post('/api/auth/telegram', { initData: this.tg.getInitData() }); if (r.success) { this.user = r.user; this.storage.set('user', r.user); this.storage.set('token', r.token); this.api.setToken(r.token); }} catch(e){ console.error(e);}}
        setupUI() { document.querySelectorAll('.nav-item').forEach(item => item.addEventListener('click', (e) => { e.preventDefault(); document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active')); item.classList.add('active'); this.loadPage(item.dataset.page); })); }
        showError(message) { return `<div style="text-align: center; padding: 50px;"><h3>Помилка</h3><p>${message}</p></div>`; }
    }

    // ============= START APP =============
    window.addEventListener('DOMContentLoaded', () => {
        window.app = new RevitWebApp();
        window.app.init();
    });
})();