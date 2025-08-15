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
        this.productsCache = [];
    }

    async addToCart(productId) {
        try {
            // Отримуємо інформацію про товар
            let product;
            if (this.productsCache && this.productsCache.length > 0) {
                product = this.productsCache.find(p => p.id === productId);
            }

            if (!product) {
                // Якщо товару немає в кеші, завантажуємо з сервера
                product = await this.api.get(`/api/archives/${productId}`);
            }

            if (!product) {
                this.tg.showAlert('Товар не знайдено');
                return;
            }

            // Перевіряємо чи вже є в корзині
            const existingItem = this.cart.find(item => item.id === productId);

            if (existingItem) {
                this.tg.showAlert('Товар вже в корзині!');
                return;
            }

            // Додаємо в корзину
            const cartItem = {
                id: product.id,
                title: product.title,
                code: product.code,
                price: product.price,
                finalPrice: product.discount_percent > 0
                    ? product.price * (1 - product.discount_percent / 100)
                    : product.price,
                quantity: 1,
                image: product.image_paths?.[0] || null
            };

            this.cart.push(cartItem);
            this.storage.set('cart', this.cart);
            this.updateCartBadge();

            // Оновлюємо кнопку товару
            const btn = document.getElementById(`product-btn-${productId}`);
            if (btn) {
                btn.textContent = this.t('buttons.inCart');
                btn.disabled = true;
                btn.style.backgroundColor = '#b0b0b0';
                btn.style.cursor = 'not-allowed';
            }

            this.tg.showAlert('✅ Додано в корзину!');
        } catch (error) {
            console.error('Add to cart error:', error);
            this.tg.showAlert('Помилка додавання в корзину');
        }
    }

    // Видалити з корзини
    removeFromCart(productId) {
        this.cart = this.cart.filter(item => item.id !== productId);
        this.storage.set('cart', this.cart);
        this.updateCartBadge();

        // Оновлюємо кнопку товару якщо вона є на сторінці
        const btn = document.getElementById(`product-btn-${productId}`);
        if (btn) {
            btn.textContent = this.t('buttons.buy');
            btn.disabled = false;
            btn.style.backgroundColor = 'var(--primary-color)';
            btn.style.cursor = 'pointer';
            btn.onclick = () => this.addToCart(productId);
        }
    }

    // Оновити бейдж корзини
    updateCartBadge() {
        const badge = document.getElementById('cart-badge');
        if (badge) {
            const count = this.cart.length;
            if (count > 0) {
                badge.textContent = count;
                badge.style.display = 'block';
            } else {
                badge.style.display = 'none';
            }
        }
    }

    // Очистити корзину
    clearCart() {
        this.cart = [];
        this.storage.set('cart', []);
        this.updateCartBadge();
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

        // Видаляємо попередню інформацію користувача якщо є
        const existingUserInfo = headerActions.querySelector('.user-info');
        if (existingUserInfo) {
            existingUserInfo.remove();
        }

        const userInfo = document.createElement('div');
        userInfo.className = 'user-info';

        // Використовуємо реальні дані користувача
        const displayName = this.user.first_name || this.user.username || 'User';
        const isAdmin = this.user.is_admin || this.user.role === 'admin' || this.user.role === 'super_admin';

        userInfo.innerHTML = `
            ${this.user.avatar_url ?
                `<img src="${this.user.avatar_url}" alt="Avatar" class="user-avatar">` :
                '<div class="user-avatar-placeholder">👤</div>'
            }
            <span class="user-name">${displayName}</span>
            ${isAdmin ? '<span class="admin-badge">Admin</span>' : ''}
        `;

        headerActions.insertBefore(userInfo, headerActions.firstChild);
        this.updateCartBadge();

        // Вмикаємо адмін функції тільки якщо користувач адмін
        if (isAdmin) {
            this.enableAdminFeatures();
        }
    }

    enableAdminFeatures() {
        // Перевірка прав адміна
        const isAdmin = this.user?.is_admin || this.user?.role === 'admin' || this.user?.role === 'super_admin';

        if (!isAdmin) {
            console.log('User is not admin, skipping admin features');
            return;
        }

        const nav = document.getElementById('bottom-nav');
        if (!nav) return;

        // Перевіряємо чи вже є кнопка адміна
        if (nav.querySelector('[data-page="admin"]')) return;

        // Створюємо кнопку адміна
        const adminBtn = document.createElement('a');
        adminBtn.href = '#admin';
        adminBtn.className = 'nav-item';
        adminBtn.setAttribute('data-page', 'admin');
        adminBtn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
        adminBtn.style.color = 'white';

        adminBtn.innerHTML = `
            <svg class="nav-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M12 15l-2 5 9-11h-4l2-5-9 11h4z"/>
            </svg>
            <span class="nav-label">Адмін</span>
        `;

        // Додаємо обробник кліку
        adminBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.loadPage('admin');
        });

        // Додаємо кнопку в навігацію
        nav.appendChild(adminBtn);

        console.log('Admin features enabled for user:', this.user.first_name || this.user.username);
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
                e.preventDefault();

                // Отримуємо сторінку з data-page або href
                let page = item.dataset.page;
                if (!page) {
                    const href = item.getAttribute('href');
                    if (href && href.startsWith('#')) {
                        page = href.substring(1);
                    }
                }

                if (page) {
                    this.loadPage(page);
                }
            });
        });

        // Оновлюємо бейдж корзини при ініціалізації
        this.updateCartBadge();
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
                case 'cart':
                    await this.loadCartPage();
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

        try {
            // Завантажуємо товари для головної сторінки
            let featuredProducts = [];

            try {
                const response = await this.api.get('/api/archives?limit=6');
                featuredProducts = response.items || response || [];

                // Зберігаємо в кеш
                if (featuredProducts.length > 0) {
                    this.productsCache = [...featuredProducts];
                }
            } catch (error) {
                console.log('Failed to load products:', error);
                featuredProducts = [];
            }

            content.innerHTML = `
                <div class="home-page">
                    <!-- Банер привітання -->
                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 16px; padding: 30px; margin: 20px; text-align: center; color: white;">
                        <h1 style="font-size: 28px; margin-bottom: 10px;">
                            👋 ${this.t('home.welcome') || `Вітаємо, ${this.user?.first_name || 'друже'}!`}
                        </h1>
                        <p style="font-size: 16px; opacity: 0.9;">
                            ${this.t('home.subtitle') || 'Найбільша колекція Revit сімейств для ваших проектів'}
                        </p>
                    </div>

                    <!-- Швидкі дії -->
                    <div style="padding: 0 20px;">
                        <h3 style="margin-bottom: 15px;">${this.t('home.quickActions') || '⚡ Швидкі дії'}</h3>
                        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 25px;">
                            <button onclick="window.app.loadPage('catalog')"
                                    style="padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 12px; font-size: 16px; font-weight: bold; display: flex; flex-direction: column; align-items: center; gap: 8px; cursor: pointer;">
                                <span style="font-size: 24px;">📦</span>
                                ${this.t('navigation.catalog') || 'Каталог'}
                            </button>
                            <button onclick="window.app.loadPage('bonuses')"
                                    style="padding: 20px; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; border: none; border-radius: 12px; font-size: 16px; font-weight: bold; display: flex; flex-direction: column; align-items: center; gap: 8px; cursor: pointer;">
                                <span style="font-size: 24px;">💎</span>
                                ${this.t('home.bonuses') || 'Бонуси'}
                            </button>
                        </div>

                        <!-- Статистика користувача -->
                        ${this.user ? `
                            <div style="background: var(--tg-theme-secondary-bg-color); border-radius: 12px; padding: 15px; margin-bottom: 25px;">
                                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; text-align: center;">
                                    <div>
                                        <div style="font-size: 24px; font-weight: bold; color: var(--primary-color);">${this.user.bonuses || 0}</div>
                                        <div style="font-size: 12px; color: var(--tg-theme-hint-color);">Бонусів</div>
                                    </div>
                                    <div>
                                        <div style="font-size: 24px; font-weight: bold; color: var(--primary-color);">${this.cart.length}</div>
                                        <div style="font-size: 12px; color: var(--tg-theme-hint-color);">В корзині</div>
                                    </div>
                                    <div>
                                        <div style="font-size: 24px; font-weight: bold; color: var(--primary-color);">${this.user.vip_level || 'Bronze'}</div>
                                        <div style="font-size: 12px; color: var(--tg-theme-hint-color);">VIP рівень</div>
                                    </div>
                                </div>
                            </div>
                        ` : ''}

                        <!-- Рекомендовані товари -->
                        <h3 style="margin-bottom: 15px;">${this.t('home.featured') || '🔥 Рекомендовані товари'}</h3>

                        ${featuredProducts.length > 0 ? `
                            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-bottom: 20px;">
                                ${featuredProducts.slice(0, 6).map(product => this.getHomeProductCard(product)).join('')}
                            </div>

                            <button onclick="window.app.loadPage('catalog')"
                                    style="width: 100%; padding: 15px; background: var(--tg-theme-secondary-bg-color); border: none; border-radius: 10px; font-size: 16px; cursor: pointer;">
                                Переглянути всі товари →
                            </button>
                        ` : `
                            <div style="text-align: center; padding: 40px; background: var(--tg-theme-secondary-bg-color); border-radius: 12px;">
                                <div style="font-size: 48px; margin-bottom: 10px;">📦</div>
                                <p style="color: var(--tg-theme-hint-color);">Товари завантажуються...</p>
                                <button onclick="window.app.loadPage('catalog')"
                                        style="margin-top: 15px; padding: 10px 20px; background: var(--primary-color); color: white; border: none; border-radius: 8px; cursor: pointer;">
                                    Перейти в каталог
                                </button>
                            </div>
                        `}
                    </div>
                </div>
            `;

        } catch (error) {
            console.error('Home page error:', error);
            content.innerHTML = `
                <div style="text-align: center; padding: 50px;">
                    <h2>Помилка завантаження</h2>
                    <p>${error.message}</p>
                    <button onclick="location.reload()" style="padding: 10px 20px; background: var(--primary-color); color: white; border: none; border-radius: 8px; cursor: pointer;">
                        Перезавантажити
                    </button>
                </div>
            `;
        }
    }

    // Допоміжний метод для картки товару на головній
    getHomeProductCard(product) {
        const lang = this.currentLang || 'ua';
        const title = product.title?.[lang] || product.title?.en || 'No title';
        const isInCart = this.cart.some(item => item.id === product.id);
        const finalPrice = product.discount_percent > 0
            ? (product.price * (1 - product.discount_percent / 100)).toFixed(2)
            : product.price;

        // Перевіряємо наявність зображення
        const imagePath = product.image_paths?.[0];
        const fullImagePath = imagePath && !imagePath.startsWith('http')
            ? `${this.api.baseURL}/${imagePath}`
            : imagePath;

        return `
            <div style="background: var(--tg-theme-bg-color); border: 1px solid var(--tg-theme-secondary-bg-color); border-radius: 12px; padding: 12px; cursor: pointer;"
                 onclick="window.ProductDetailsModule?.show(${product.id})">
                <div style="height: 120px; background: ${fullImagePath ? `url('${fullImagePath}')` : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'}; background-size: cover; background-position: center; border-radius: 8px; display: flex; align-items: center; justify-content: center; margin-bottom: 10px;">
                    ${!fullImagePath ? `<span style="font-size: 40px;">${product.archive_type === 'premium' ? '💎' : '📦'}</span>` : ''}
                </div>
                <div style="font-weight: 500; margin-bottom: 5px; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${title}</div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-weight: bold; color: var(--primary-color);">$${finalPrice}</span>
                    ${product.discount_percent > 0 ? `
                        <span style="background: #ff4444; color: white; padding: 2px 6px; border-radius: 4px; font-size: 11px;">
                            -${product.discount_percent}%
                        </span>
                    ` : ''}
                </div>
                <button id="home-product-btn-${product.id}"
                        onclick="event.stopPropagation(); window.app.addToCart(${product.id})"
                        style="width: 100%; margin-top: 8px; padding: 8px; background: ${isInCart ? '#b0b0b0' : 'var(--primary-color)'}; color: white; border: none; border-radius: 6px; font-size: 14px; cursor: ${isInCart ? 'not-allowed' : 'pointer'};"
                        ${isInCart ? 'disabled' : ''}>
                    ${isInCart ? this.t('buttons.inCart') : this.t('buttons.buy')}
                </button>
            </div>
        `;
    }

    async loadCatalogPage() {
        const content = document.getElementById('app-content');

        try {
            // Завантажуємо модуль каталогу
            if (!window.CatalogModule) {
                await this.loadScript('js/modules/catalog.js');
            }

            const catalogHtml = await window.CatalogModule.getPage(this);
            content.innerHTML = catalogHtml;

            // Ініціалізуємо infinite scroll
            await window.CatalogModule.initInfiniteScroll(this);

        } catch (error) {
            console.error('Catalog page error:', error);
            content.innerHTML = '<div class="error">Помилка завантаження каталогу</div>';
        }
    }

    async loadCartPage() {
        const content = document.getElementById('app-content');

        try {
            // Завантажуємо модуль корзини
            if (!window.CartModule) {
                await this.loadScript('js/modules/cart.js');
            }

            // Ініціалізуємо модуль з app
            window.CartModule.init(this);

            const cartHtml = window.CartModule.getPage();
            content.innerHTML = cartHtml;

        } catch (error) {
            console.error('Cart page error:', error);
            content.innerHTML = '<div class="error">Помилка завантаження корзини</div>';
        }
    }

    async loadBonusesPage() {
        const content = document.getElementById('app-content');

        try {
            // Завантажуємо модуль щоденних бонусів
            if (!window.DailyBonusModule) {
                await this.loadScript('js/modules/daily-bonus.js');
            }

            content.innerHTML = `
                <div class="bonuses-page p-3">
                    <h2 style="margin-bottom: 20px;">💎 Бонуси</h2>

                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 16px; padding: 20px; margin-bottom: 20px; color: white;">
                        <div style="font-size: 14px; opacity: 0.9;">Ваш баланс:</div>
                        <div style="font-size: 32px; font-weight: bold;">
                            ${this.user?.bonuses || 0} бонусів
                        </div>
                        <div style="font-size: 12px; opacity: 0.8; margin-top: 5px;">
                            100 бонусів = $1 USD
                        </div>
                    </div>

                    <button onclick="window.DailyBonusModule?.showModal(window.app)"
                            style="width: 100%; padding: 15px; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; border: none; border-radius: 10px; font-size: 16px; font-weight: bold; cursor: pointer;">
                        🎰 Щоденний бонус
                    </button>
                </div>
            `;
        } catch (error) {
            console.error('Bonuses page error:', error);
            content.innerHTML = '<div class="error">Помилка завантаження сторінки бонусів</div>';
        }
    }

    // Допоміжний метод для генерації картки товару
    getProductCard(archive) {
        const lang = this.currentLang || 'ua';
        const title = archive.title?.[lang] || archive.title?.en || 'No title';
        const isInCart = this.cart.some(item => item.id === archive.id);
        const finalPrice = archive.discount_percent > 0
            ? (archive.price * (1 - archive.discount_percent / 100)).toFixed(2)
            : archive.price;

        return `
            <div style="background: var(--tg-theme-secondary-bg-color); border-radius: 12px; padding: 10px;">
                <div style="height: 100px; background: #f0f0f0; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 40px; margin-bottom: 10px;">
                    ${archive.archive_type === 'premium' ? '💎' : '📦'}
                </div>
                <div style="font-weight: 500; margin-bottom: 5px; font-size: 14px;">${title}</div>
                <div style="font-weight: bold; color: var(--primary-color); margin-bottom: 10px;">$${finalPrice}</div>
                <button id="product-btn-${archive.id}"
                        onclick="window.app.addToCart(${archive.id})"
                        style="width: 100%; padding: 8px; background: ${isInCart ? '#b0b0b0' : 'var(--primary-color)'}; color: white; border: none; border-radius: 6px; cursor: ${isInCart ? 'not-allowed' : 'pointer'};"
                        ${isInCart ? 'disabled' : ''}>
                    ${isInCart ? this.t('buttons.inCart') : this.t('buttons.buy')}
                </button>
            </div>
        `;
    }

    async loadAdminPage() {
        const content = document.getElementById('app-content');

        // Перевірка прав адміна
        if (!this.user?.is_admin) {
            content.innerHTML = `
                <div style="text-align: center; padding: 50px;">
                    <h2>🚫 Доступ заборонено</h2>
                    <p>Ця сторінка доступна тільки адміністраторам</p>
                    <button onclick="window.app.loadPage('home')" style="padding: 10px 20px; background: var(--primary-color); color: white; border: none; border-radius: 8px; cursor: pointer;">
                        На головну
                    </button>
                </div>
            `;
            return;
        }

        try {
            // Завантажуємо модуль адміна
            if (!window.AdminModule) {
                await this.loadScript('js/modules/admin.js');
            }

            // Отримуємо та відображаємо dashboard
            const adminHtml = await window.AdminModule.getDashboard(this);
            content.innerHTML = adminHtml;

        } catch (error) {
            console.error('Admin page error:', error);
            content.innerHTML = `
                <div style="text-align: center; padding: 50px;">
                    <h2>⚠️ Помилка завантаження</h2>
                    <p>${error.message}</p>
                    <button onclick="location.reload()" style="padding: 10px 20px; background: var(--primary-color); color: white; border: none; border-radius: 8px; cursor: pointer;">
                        Перезавантажити
                    </button>
                </div>
            `;
        }
    }
}

// ============= ЗАПУСК ДОДАТКУ =============
window.addEventListener('DOMContentLoaded', () => {
    const app = new RevitWebApp();
    window.app = app; // Робимо app глобальним для доступу з модулів
    app.init();
});