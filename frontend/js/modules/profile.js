// frontend/js/modules/profile.js

window.ProfileModule = {
    async getPage(app) {
        // Переконуємось, що всі необхідні модулі завантажені
        if (!window.VipModule) await app.loadScript('js/modules/vip.js');
        if (!window.ReferralsModule) await app.loadScript('js/modules/referrals.js');

        const t = (key) => app.t(key);
        const user = app.user;

        // Отримуємо HTML для вбудованих блоків
        const vipBlockHtml = await window.VipModule.renderVipBlock(app);
        const referralBlockHtml = await window.ReferralsModule.renderReferralBlock(app);

        // Дані для статистики (тимчасові, можна замінити на реальні з API)
        const stats = {
            archives: user.purchased_archives_count || 0, // Потрібно буде додати це поле в API
            spent: user.total_spent || 0,
            bonuses: user.bonus_balance || 0,
            referrals: user.invited_count || 0 // Потрібно буде додати
        };

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
                    ${this.renderStatCard('💎', `${stats.bonuses}`, t('bonuses'))}
                    ${this.renderStatCard('📦', `${stats.archives}`, 'архівів куплено')}
                    ${this.renderStatCard('💰', `$${stats.spent.toFixed(2)}`, 'всього витрачено')}
                    ${this.renderStatCard('👥', `${stats.referrals}`, 'друзів запрошено')}
                </div>

                <div class="profile-menu">
                    ${this.renderMenuItem('📥', 'Мої завантаження', "window.app.loadPage('downloads')")}
                    ${this.renderMenuItem('❤️', 'Мої обрані', "window.app.loadPage('favorites')")}
                    ${this.renderMenuItem('📜', 'Історія переглядів', "window.app.loadPage('history')")}
                    ${this.renderMenuItem('🚀', 'Кабінет розробника', "window.app.loadPage('marketplace')")}
                    ${this.renderMenuItem('⚙️', 'Налаштування', "window.app.loadPage('settings')")}
                    ${this.renderMenuItem('💬', 'Підтримка', "window.app.tg.openTelegramLink('https://t.me/revitbot_support')")}
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