// Модуль адаптивності
window.ResponsiveModule = {
    // Брейкпоінти
    breakpoints: {
        mobile: 480,
        tablet: 768,
        desktop: 1024,
        wide: 1440
    },

    // Поточний розмір екрану
    currentBreakpoint: 'mobile',

    // Ініціалізація
    init() {
        console.log('🎨 Initializing responsive module...');

        // Визначаємо початковий розмір
        this.updateBreakpoint();

        // Застосовуємо початкові стилі
        this.applyResponsiveStyles();

        // Слухаємо зміни розміру
        this.attachResizeListener();

        // Налаштовуємо viewport
        this.setupViewport();

        // Оптимізуємо для Telegram WebApp
        this.optimizeForTelegram();
    },

    // Визначення поточного брейкпоінту
    updateBreakpoint() {
        const width = window.innerWidth;
        let newBreakpoint = 'mobile';

        if (width >= this.breakpoints.wide) {
            newBreakpoint = 'wide';
        } else if (width >= this.breakpoints.desktop) {
            newBreakpoint = 'desktop';
        } else if (width >= this.breakpoints.tablet) {
            newBreakpoint = 'tablet';
        } else if (width >= this.breakpoints.mobile) {
            newBreakpoint = 'mobile';
        } else {
            newBreakpoint = 'small';
        }

        if (newBreakpoint !== this.currentBreakpoint) {
            console.log(`📱 Breakpoint changed: ${this.currentBreakpoint} → ${newBreakpoint}`);
            this.currentBreakpoint = newBreakpoint;
            this.onBreakpointChange();
        }
    },

    // Слухач зміни розміру
    attachResizeListener() {
        let resizeTimeout;

        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                this.updateBreakpoint();
                this.applyResponsiveStyles();
            }, 250);
        });

        // Також слухаємо зміну орієнтації
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                this.updateBreakpoint();
                this.applyResponsiveStyles();
            }, 100);
        });
    },

    // Застосування адаптивних стилів
    applyResponsiveStyles() {
        const root = document.documentElement;

        // Очищуємо старі класи
        root.className = root.className.replace(/\bscreen-\S+/g, '');

        // Додаємо новий клас
        root.classList.add(`screen-${this.currentBreakpoint}`);

        // Оновлюємо CSS змінні
        this.updateCSSVariables();

        // Оновлюємо сітку товарів
        this.updateProductGrid();

        // Оновлюємо навігацію
        this.updateNavigation();
    },

    // Оновлення CSS змінних
    updateCSSVariables() {
        const root = document.documentElement;

        switch(this.currentBreakpoint) {
            case 'small':
            case 'mobile':
                root.style.setProperty('--content-max-width', '100%');
                root.style.setProperty('--spacing-md', '12px');
                root.style.setProperty('--spacing-lg', '16px');
                root.style.setProperty('--header-height', '50px');
                root.style.setProperty('--nav-height', '56px');
                break;

            case 'tablet':
                root.style.setProperty('--content-max-width', '720px');
                root.style.setProperty('--spacing-md', '16px');
                root.style.setProperty('--spacing-lg', '24px');
                root.style.setProperty('--header-height', '56px');
                root.style.setProperty('--nav-height', '60px');
                break;

            case 'desktop':
                root.style.setProperty('--content-max-width', '960px');
                root.style.setProperty('--spacing-md', '20px');
                root.style.setProperty('--spacing-lg', '32px');
                root.style.setProperty('--header-height', '60px');
                root.style.setProperty('--nav-height', '64px');
                break;

            case 'wide':
                root.style.setProperty('--content-max-width', '1200px');
                root.style.setProperty('--spacing-md', '24px');
                root.style.setProperty('--spacing-lg', '40px');
                root.style.setProperty('--header-height', '64px');
                root.style.setProperty('--nav-height', '68px');
                break;
        }
    },

    // Оновлення сітки товарів
    updateProductGrid() {
        const grid = document.getElementById('products-grid');
        if (!grid) return;

        let gridColumns;

        switch(this.currentBreakpoint) {
            case 'small':
                gridColumns = 'repeat(1, 1fr)';
                break;
            case 'mobile':
                gridColumns = 'repeat(2, 1fr)';
                break;
            case 'tablet':
                gridColumns = 'repeat(3, 1fr)';
                break;
            case 'desktop':
                gridColumns = 'repeat(4, 1fr)';
                break;
            case 'wide':
                gridColumns = 'repeat(5, 1fr)';
                break;
            default:
                gridColumns = 'repeat(auto-fill, minmax(150px, 1fr))';
        }

        grid.style.gridTemplateColumns = gridColumns;
    },

    // Оновлення навігації
    updateNavigation() {
        const nav = document.getElementById('bottom-nav');
        if (!nav) return;

        const navItems = nav.querySelectorAll('.nav-item');

        if (this.currentBreakpoint === 'small' ||
            (this.currentBreakpoint === 'mobile' && navItems.length > 4)) {
            // Для малих екранів - ховаємо текст, залишаємо тільки іконки
            navItems.forEach(item => {
                const label = item.querySelector('.nav-label');
                if (label) {
                    label.style.display = 'none';
                }
                item.style.padding = '8px';
            });
        } else {
            // Для більших екранів - показуємо текст
            navItems.forEach(item => {
                const label = item.querySelector('.nav-label');
                if (label) {
                    label.style.display = 'block';
                }
                item.style.padding = 'var(--spacing-xs)';
            });
        }
    },

    // Налаштування viewport
    setupViewport() {
        let viewport = document.querySelector('meta[name="viewport"]');

        if (!viewport) {
            viewport = document.createElement('meta');
            viewport.name = 'viewport';
            document.head.appendChild(viewport);
        }

        // Оптимальні налаштування для мобільних
        viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';
    },

    // Оптимізація для Telegram WebApp
    optimizeForTelegram() {
        // Якщо це Telegram WebApp
        if (window.Telegram?.WebApp) {
            const tg = window.Telegram.WebApp;

            // Використовуємо весь доступний простір
            tg.expand();

            // Адаптуємо під висоту Telegram
            const appContainer = document.querySelector('.app-container');
            if (appContainer) {
                // Враховуємо висоту Telegram header
                const tgHeaderHeight = tg.headerColor ? 60 : 0;
                appContainer.style.paddingTop = `${tgHeaderHeight}px`;
            }

            // Адаптуємо кольори під тему Telegram
            this.adaptToTelegramTheme();
        }
    },

    // Адаптація під тему Telegram
    adaptToTelegramTheme() {
        if (!window.Telegram?.WebApp) return;

        const tg = window.Telegram.WebApp;
        const isDark = tg.colorScheme === 'dark';

        document.documentElement.classList.toggle('theme-dark', isDark);

        // Оновлюємо кольори для темної теми
        if (isDark) {
            document.documentElement.style.setProperty('--tg-theme-bg-color', '#212121');
            document.documentElement.style.setProperty('--tg-theme-text-color', '#ffffff');
            document.documentElement.style.setProperty('--tg-theme-secondary-bg-color', '#2c2c2c');
        }
    },

    // Обробка зміни брейкпоінту
    onBreakpointChange() {
        // Відправляємо подію для інших модулів
        window.dispatchEvent(new CustomEvent('breakpointchange', {
            detail: { breakpoint: this.currentBreakpoint }
        }));

        // Оновлюємо компоненти
        this.updateComponents();
    },

    // Оновлення компонентів
    updateComponents() {
        // Оновлюємо модальні вікна
        this.updateModals();

        // Оновлюємо форми
        this.updateForms();

        // Оновлюємо таблиці
        this.updateTables();
    },

    // Оновлення модальних вікон
    updateModals() {
        const modals = document.querySelectorAll('[id$="-modal"]');

        modals.forEach(modal => {
            const content = modal.querySelector('div > div');
            if (!content) return;

            if (this.currentBreakpoint === 'small' || this.currentBreakpoint === 'mobile') {
                content.style.maxWidth = '95%';
                content.style.margin = '10px';
            } else {
                content.style.maxWidth = '600px';
                content.style.margin = '20px';
            }
        });
    },

    // Оновлення форм
    updateForms() {
        const forms = document.querySelectorAll('form');

        forms.forEach(form => {
            const inputs = form.querySelectorAll('input, select, textarea');

            if (this.currentBreakpoint === 'small') {
                // На малих екранах - поля на всю ширину
                inputs.forEach(input => {
                    input.style.width = '100%';
                });
            }
        });
    },

    // Оновлення таблиць
    updateTables() {
        const tables = document.querySelectorAll('table');

        tables.forEach(table => {
            if (this.currentBreakpoint === 'small' || this.currentBreakpoint === 'mobile') {
                // Робимо таблиці адаптивними
                table.style.display = 'block';
                table.style.overflowX = 'auto';
            } else {
                table.style.display = 'table';
                table.style.overflowX = 'visible';
            }
        });
    },

    // Утиліти
    isMobile() {
        return this.currentBreakpoint === 'small' || this.currentBreakpoint === 'mobile';
    },

    isTablet() {
        return this.currentBreakpoint === 'tablet';
    },

    isDesktop() {
        return this.currentBreakpoint === 'desktop' || this.currentBreakpoint === 'wide';
    },

    getOrientation() {
        return window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
    }
};
