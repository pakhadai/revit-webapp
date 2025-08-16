// frontend/js/modules/profile.js

window.ProfileModule = {
    async getPage(app) {
        // Переконуємось, що всі необхідні модулі завантажені
        if (!window.VipModule) await app.loadScript('js/modules/vip.js');
        if (!window.ReferralsModule) await app.loadScript('js/modules/referrals.js');

        const t = (key) => app.t(key);
        const user = app.user;

        if (!user) {
            return '<div class="p-3">Користувач не авторизований</div>';
        }

        // --- Зміни з другого файлу ---
        // Ініціалізуємо статистику зі значень за замовчуванням або з об'єкта користувача
        let stats = {
            archives: user.purchased_archives_count || 0,
            spent: user.total_spent || 0,
            bonuses: user.bonus_balance || 0,
            referrals: user.invited_count || 0
        };

        // Намагаємось завантажити актуальну статистику з API
        try {
            const profileData = await app.api.get('/api/profile/statistics');
            if (profileData && profileData.statistics) {
                stats = profileData.statistics;
            }
        } catch (error) {
            console.error('Failed to load profile statistics from API:', error);
            // Якщо сталася помилка, будемо використовувати дані, які вже є в об'єкті user
        }
        // --- Кінець змін ---

        // Отримуємо HTML для вбудованих блоків
        const vipBlockHtml = await window.VipModule.renderVipBlock(app);
        const referralBlockHtml = await window.ReferralsModule.renderReferralBlock(app);

        return `
            <div class="profile-page p-3">
                <div class="profile-header">
                    <div class="profile-avatar">
                        ${user.avatar_url ? `<img src="${user.avatar_url}" alt="Avatar">` : '👤'}
                    </div>
                    <div class="profile-details">
                        <h2>${user.display_name || user.first_name || user.username}</h2>
                        <div class="profile-badges">
                            <span class="badge-vip">${t('vip.levels.' + (user.vip_level || 'bronze'))}</span>
                            ${user.has_subscription ? `<span class="badge-premium">Premium</span>` : ''}
                        </div>
                    </div>
                </div>

                <div class="profile-stats-grid">
                    ${this.renderStatCard('💎', `${stats.bonuses}`, t('profile.stats.bonuses'))}
                    ${this.renderStatCard('📦', `${stats.archives}`, t('profile.stats.archives'))}
                    ${this.renderStatCard('💰', `$${stats.spent.toFixed(2)}`, t('profile.stats.spent'))}
                    ${this.renderStatCard('👥', `${stats.referrals}`, t('profile.stats.referrals'))}
                </div>

                <div class="profile-menu">
                    ${this.renderMenuItem('📥', t('profile.menu.downloads'), "window.app.loadPage('downloads')")}
                    ${this.renderMenuItem('❤️', t('profile.menu.favorites'), "window.app.loadPage('favorites')")}
                    ${this.renderMenuItem('📜', t('profile.menu.history'), "window.app.loadPage('history')")}
                    ${this.renderMenuItem('🚀', t('profile.menu.marketplace'), "window.app.loadPage('marketplace')")}
                    ${this.renderMenuItem('⚙️', t('profile.menu.settings'), "window.app.loadPage('settings')")}
                    ${this.renderMenuItem('💬', t('profile.menu.support'), "window.app.tg.openTelegramLink('https://t.me/revitbot_support')")}
                </div>

                <div class="profile-widgets">
                    ${vipBlockHtml}
                    ${referralBlockHtml}
                </div>
            </div>
        `;
    },

    renderStatCard(icon, value, label) {
        return `
            <div class="stat-card">
                <div class="stat-icon">${icon}</div>
                <div class="stat-value">${value}</div>
                <div class="stat-label">${label}</div>
            </div>
        `;
    },

    renderMenuItem(icon, text, onclickAction) {
        return `
            <button class="menu-item" onclick="${onclickAction}">
                <div class="menu-item-icon">${icon}</div>
                <span class="menu-item-text">${text}</span>
                <div class="menu-item-arrow">›</div>
            </button>
        `;
    }
};