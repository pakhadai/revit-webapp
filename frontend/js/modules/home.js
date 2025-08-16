// frontend/js/modules/home.js
// Модуль головної сторінки з Сімейством тижня та міні-грою

window.HomeModule = {
    weeklyFamily: null,
    gameStats: null,

    async init(app) {
        this.app = app;

        // Завантажуємо дані при ініціалізації
        await Promise.all([
            this.loadWeeklyFamily(),
            this.loadGameStats()
        ]);
    },

    async loadWeeklyFamily() {
        try {
            // Завантажуємо спеціальну пропозицію тижня
            const response = await this.app.api.get('/api/weekly-family');
            this.weeklyFamily = response;
        } catch (error) {
            console.error('Failed to load weekly family:', error);
            // Використовуємо заглушку якщо API ще не готове
            this.weeklyFamily = {
                id: 1,
                title: "Modern Kitchen Set",
                original_price: 99.99,
                discount_price: 49.99,
                discount_percent: 50,
                image_url: "/images/weekly-family.jpg",
                description: "Повний набір сучасної кухні з 50+ моделями",
                ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
            };
        }
    },

    async loadGameStats() {
        try {
            // Завантажуємо статистику гри
            const response = await this.app.api.get('/api/game/stats');
            this.gameStats = response;
        } catch (error) {
            console.error('Failed to load game stats:', error);
            this.gameStats = {
                plays_today: 0,
                best_score: 0,
                total_bonuses_earned: 0
            };
        }
    },

    async render() {
        const t = (key) => this.app.i18n.t(key);

        // Основний контейнер
        const container = document.createElement('div');
        container.className = 'home-page';
        container.innerHTML = `
            <!-- Привітання користувача -->
            <div class="welcome-section">
                <h1 class="welcome-title">
                    ${t('welcome_back')}, ${this.app.user?.first_name || t('guest')}! 👋
                </h1>
                <p class="welcome-subtitle">${t('home_subtitle')}</p>
            </div>

            <!-- Сімейство тижня - ГОЛОВНА ПРОПОЗИЦІЯ -->
            <div class="weekly-family-section">
                <div class="section-header">
                    <h2 class="section-title">🔥 ${t('family_of_week')}</h2>
                    <div class="timer" id="weekly-timer">
                        <span class="timer-icon">⏰</span>
                        <span class="timer-text"></span>
                    </div>
                </div>

                <div class="weekly-family-card" id="weekly-family">
                    <!-- Заповнюється динамічно -->
                </div>
            </div>

            <!-- Кнопка міні-гри -->
            <div class="mini-game-section">
                <div class="game-banner">
                    <div class="game-info">
                        <h3 class="game-title">🎰 ${t('daily_bonus_game')}</h3>
                        <p class="game-description">${t('play_and_win_bonuses')}</p>
                        <div class="game-stats">
                            <span class="stat-item">
                                <i class="icon">🎮</i> ${t('plays_today')}: <strong>${this.gameStats.plays_today}</strong>
                            </span>
                            <span class="stat-item">
                                <i class="icon">🏆</i> ${t('best_score')}: <strong>${this.gameStats.best_score}</strong>
                            </span>
                        </div>
                    </div>
                    <button class="game-play-btn" id="play-game-btn">
                        <span class="btn-icon">🎲</span>
                        <span class="btn-text">${t('play_now')}</span>
                    </button>
                </div>
            </div>

            <!-- Швидкі дії -->
            <div class="quick-actions">
                <h3 class="section-subtitle">${t('quick_actions')}</h3>
                <div class="action-grid">
                    <button class="action-card" data-action="catalog">
                        <span class="action-icon">📦</span>
                        <span class="action-label">${t('catalog')}</span>
                        <span class="action-badge">NEW</span>
                    </button>

                    <button class="action-card" data-action="subscription">
                        <span class="action-icon">⭐</span>
                        <span class="action-label">${t('subscription')}</span>
                    </button>

                    <button class="action-card" data-action="bonuses">
                        <span class="action-icon">🎁</span>
                        <span class="action-label">${t('bonuses')}</span>
                        ${this.app.user?.bonuses > 0 ? `<span class="action-count">${this.app.user.bonuses}</span>` : ''}
                    </button>

                    <button class="action-card" data-action="profile">
                        <span class="action-icon">👤</span>
                        <span class="action-label">${t('profile')}</span>
                    </button>
                </div>
            </div>

            <!-- Статистика та досягнення -->
            <div class="stats-section">
                <h3 class="section-subtitle">${t('your_progress')}</h3>
                <div class="stats-grid">
                    <div class="stat-card">
                        <span class="stat-value">${this.app.user?.purchases_count || 0}</span>
                        <span class="stat-label">${t('purchases')}</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-value">${this.app.user?.bonuses || 0}</span>
                        <span class="stat-label">${t('bonuses')}</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-value">${this.app.user?.referrals_count || 0}</span>
                        <span class="stat-label">${t('referrals')}</span>
                    </div>
                    <div class="stat-card vip-card">
                        <span class="stat-value">${this.getVipIcon(this.app.user?.vip_level)}</span>
                        <span class="stat-label">${this.app.user?.vip_level || 'Bronze'}</span>
                    </div>
                </div>
            </div>

            <!-- Новини та оновлення -->
            <div class="news-section">
                <h3 class="section-subtitle">${t('news_updates')}</h3>
                <div class="news-list">
                    <div class="news-item">
                        <span class="news-date">${new Date().toLocaleDateString()}</span>
                        <span class="news-text">🎉 ${t('new_families_added')}</span>
                    </div>
                    <div class="news-item">
                        <span class="news-date">${new Date(Date.now() - 86400000).toLocaleDateString()}</span>
                        <span class="news-text">🔥 ${t('special_offer_active')}</span>
                    </div>
                </div>
            </div>
        `;

        // Рендеримо Сімейство тижня
        this.renderWeeklyFamily();

        // Додаємо обробники подій
        this.attachEventHandlers(container);

        // Запускаємо таймер
        this.startWeeklyTimer();

        return container;
    },

    renderWeeklyFamily() {
        const container = document.getElementById('weekly-family');
        if (!container || !this.weeklyFamily) return;

        const t = (key) => this.app.i18n.t(key);
        const family = this.weeklyFamily;

        container.innerHTML = `
            <div class="weekly-card-content">
                <div class="weekly-badge">
                    <span class="badge-discount">-${family.discount_percent}%</span>
                    <span class="badge-label">${t('mega_discount')}</span>
                </div>

                <div class="weekly-image">
                    <img src="${family.image_url || '/images/placeholder.jpg'}"
                         alt="${family.title}"
                         onerror="this.src='/images/placeholder.jpg'">
                </div>

                <div class="weekly-details">
                    <h3 class="weekly-title">${family.title}</h3>
                    <p class="weekly-description">${family.description}</p>

                    <div class="weekly-prices">
                        <span class="price-original">${family.original_price}</span>
                        <span class="price-discount">${family.discount_price}</span>
                    </div>

                    <div class="weekly-benefits">
                        <div class="benefit-item">
                            <span class="benefit-icon">✅</span>
                            <span>${t('instant_download')}</span>
                        </div>
                        <div class="benefit-item">
                            <span class="benefit-icon">🎁</span>
                            <span>+${Math.floor(family.discount_price)} ${t('bonus_points')}</span>
                        </div>
                        <div class="benefit-item">
                            <span class="benefit-icon">⭐</span>
                            <span>${t('exclusive_content')}</span>
                        </div>
                    </div>

                    <div class="weekly-actions">
                        <button class="btn-primary weekly-buy-btn" data-id="${family.id}">
                            <span class="btn-icon">🛒</span>
                            ${t('buy_now')} - ${family.discount_price}
                        </button>
                        <button class="btn-secondary weekly-view-btn" data-id="${family.id}">
                            <span class="btn-icon">👁</span>
                            ${t('view_details')}
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Обробники для кнопок
        container.querySelector('.weekly-buy-btn')?.addEventListener('click', (e) => {
            this.handleWeeklyBuy(family.id);
        });

        container.querySelector('.weekly-view-btn')?.addEventListener('click', (e) => {
            this.app.router.navigate(`/catalog/${family.id}`);
        });
    },

    startWeeklyTimer() {
        if (!this.weeklyFamily?.ends_at) return;

        const updateTimer = () => {
            const now = new Date();
            const end = new Date(this.weeklyFamily.ends_at);
            const diff = end - now;

            const timerEl = document.getElementById('weekly-timer');
            if (!timerEl) return;

            if (diff <= 0) {
                timerEl.querySelector('.timer-text').textContent = this.app.i18n.t('offer_ended');
                clearInterval(this.timerInterval);
                return;
            }

            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);

            let timerText = '';
            if (days > 0) timerText += `${days}${this.app.i18n.t('d')} `;
            timerText += `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

            timerEl.querySelector('.timer-text').textContent = timerText;
        };

        updateTimer();
        this.timerInterval = setInterval(updateTimer, 1000);
    },

    attachEventHandlers(container) {
        // Кнопка гри
        container.querySelector('#play-game-btn')?.addEventListener('click', () => {
            this.openMiniGame();
        });

        // Швидкі дії
        container.querySelectorAll('.action-card').forEach(card => {
            card.addEventListener('click', (e) => {
                const action = e.currentTarget.dataset.action;
                this.handleQuickAction(action);
            });
        });
    },

    async openMiniGame() {
        // Зберігаємо стан гри перед відкриттям
        await this.saveGameState();

        // Переходимо на сторінку гри
        this.app.router.navigate('/game');
    },

    async saveGameState() {
        try {
            // Зберігаємо поточний стан гри на сервері
            await this.app.api.post('/api/game/save-state', {
                timestamp: new Date().toISOString(),
                page: 'home'
            });
        } catch (error) {
            console.error('Failed to save game state:', error);
        }
    },

    handleQuickAction(action) {
        const routes = {
            'catalog': '/catalog',
            'subscription': '/subscription',
            'bonuses': '/bonuses',
            'profile': '/profile'
        };

        if (routes[action]) {
            this.app.router.navigate(routes[action]);
        }
    },

    async handleWeeklyBuy(familyId) {
        try {
            // Додаємо в кошик зі спеціальною ціною
            await this.app.api.post('/api/cart/add', {
                archive_id: familyId,
                is_weekly_special: true
            });

            this.app.showToast(this.app.i18n.t('added_to_cart'), 'success');

            // Оновлюємо кошик
            if (window.CartModule) {
                await window.CartModule.loadCart();
                window.CartModule.updateCartBadge();
            }

            // Пропонуємо перейти до оформлення
            setTimeout(() => {
                if (confirm(this.app.i18n.t('go_to_checkout'))) {
                    this.app.router.navigate('/cart');
                }
            }, 500);

        } catch (error) {
            console.error('Failed to add weekly special to cart:', error);
            this.app.showToast(this.app.i18n.t('error_adding_to_cart'), 'error');
        }
    },

    getVipIcon(level) {
        const icons = {
            'Bronze': '🥉',
            'Silver': '🥈',
            'Gold': '🥇',
            'Diamond': '💎'
        };
        return icons[level] || '🥉';
    },

    cleanup() {
        // Очищаємо таймер при виході
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }
    }
};