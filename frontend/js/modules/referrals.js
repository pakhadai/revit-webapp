// Модуль реферальної системи
window.ReferralsModule = {
    myCode: null,
    myReferrals: [],
    leaderboard: [],

    // Ініціалізація
    async init(app) {
        this.app = app;
        await this.loadMyCode();
    },

    // Завантажити мій реферальний код
    async loadMyCode() {
        try {
            const data = await this.app.api.get('/api/referrals/my-code');
            this.myCode = data;
            return data;
        } catch (error) {
            console.error('Error loading referral code:', error);
            return null;
        }
    },

    // Рендер блоку реферальної програми для профілю
    async renderReferralBlock(app) {
        await this.init(app);
        const t = (key) => app.t(key);

        if (!this.myCode) {
            return '';
        }

        const { referral_code, referral_link, statistics } = this.myCode;

        return `
            <div class="referral-block" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 16px; padding: 20px; margin-bottom: 20px; color: white;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h3 style="margin: 0; font-size: 20px;">
                        🎁 ${t('referrals.title')}
                    </h3>
                    <button onclick="ReferralsModule.showDetails()"
                            style="padding: 8px 16px; background: rgba(255,255,255,0.2); color: white; border: 1px solid white; border-radius: 6px; cursor: pointer;">
                        ${t('buttons.details')}
                    </button>
                </div>

                <div style="background: rgba(255,255,255,0.1); border-radius: 12px; padding: 15px; margin-bottom: 20px;">
                    <div style="font-size: 12px; opacity: 0.9; margin-bottom: 5px;">
                        ${t('referrals.yourCode')}:
                    </div>
                    <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 15px;">
                        <div style="font-size: 24px; font-weight: bold; letter-spacing: 2px;">
                            ${referral_code}
                        </div>
                        <button onclick="ReferralsModule.copyCode('${referral_code}')"
                                style="padding: 6px 12px; background: white; color: var(--primary-color); border: none; border-radius: 6px; cursor: pointer; font-size: 12px;">
                            📋 ${t('buttons.copy')}
                        </button>
                    </div>

                    <div style="display: flex; gap: 10px;">
                        <button onclick="ReferralsModule.shareToTelegram()"
                                style="flex: 1; padding: 12px; background: white; color: var(--primary-color); border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
                            ✈️ ${t('referrals.shareToTelegram')}
                        </button>
                        <button onclick="ReferralsModule.copyLink('${referral_link}')"
                                style="padding: 12px 20px; background: rgba(255,255,255,0.2); color: white; border: 1px solid white; border-radius: 8px; cursor: pointer;">
                            🔗 ${t('buttons.copyLink')}
                        </button>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
                    <div style="background: rgba(255,255,255,0.1); border-radius: 10px; padding: 12px; text-align: center;">
                        <div style="font-size: 24px; font-weight: bold;">
                            ${statistics.total_invited}
                        </div>
                        <div style="font-size: 12px; opacity: 0.9;">
                            ${t('referrals.invited')}
                        </div>
                    </div>
                    <div style="background: rgba(255,255,255,0.1); border-radius: 10px; padding: 12px; text-align: center;">
                        <div style="font-size: 24px; font-weight: bold;">
                            ${statistics.active_referrals}
                        </div>
                        <div style="font-size: 12px; opacity: 0.9;">
                            ${t('referrals.active')}
                        </div>
                    </div>
                    <div style="background: rgba(255,255,255,0.1); border-radius: 10px; padding: 12px; text-align: center;">
                        <div style="font-size: 24px; font-weight: bold;">
                            💎 ${statistics.total_earned}
                        </div>
                        <div style="font-size: 12px; opacity: 0.9;">
                            ${t('referrals.earned')}
                        </div>
                    </div>
                    <div style="background: rgba(255,255,255,0.1); border-radius: 10px; padding: 12px; text-align: center;">
                        <div style="font-size: 24px; font-weight: bold;">
                            💰 ${statistics.potential_earnings}
                        </div>
                        <div style="font-size: 12px; opacity: 0.9;">
                            ${t('referrals.potential')}
                        </div>
                    </div>
                </div>

                <div style="margin-top: 20px; padding: 15px; background: rgba(255,255,255,0.1); border-radius: 10px;">
                    <div style="font-size: 14px; line-height: 1.6;">
                        📌 ${t('referrals.info')}
                    </div>
                </div>
            </div>
        `;
    },

    // Показати детальну інформацію
    async showDetails() {
        const app = this.app;
        const t = (key) => app.t(key);

        try {
            // Завантажуємо список рефералів
            const data = await app.api.get('/api/referrals/my-referrals');

            // Завантажуємо лідерборд
            const leaderboard = await app.api.get('/api/referrals/leaderboard?period=month&limit=10');

            const content = document.getElementById('app-content');
            content.innerHTML = `
                <div class="referrals-page p-3">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px;">
                        <h2>${t('referrals.myReferrals')}</h2>
                        <button onclick="window.app.loadPage('profile')"
                                style="padding: 8px 16px; background: var(--tg-theme-secondary-bg-color); border: none; border-radius: 6px; cursor: pointer;">
                            ← ${t('buttons.back')}
                        </button>
                    </div>

                    <div style="display: flex; gap: 10px; margin-bottom: 20px; border-bottom: 1px solid var(--tg-theme-secondary-bg-color);">
                        <button id="tab-referrals"
                                onclick="ReferralsModule.switchTab('referrals')"
                                style="padding: 10px 20px; background: none; border: none; border-bottom: 2px solid var(--primary-color); color: var(--primary-color); cursor: pointer; font-weight: 600;">
                            ${t('referrals.myReferralsTab')} (${data.statistics.total})
                        </button>
                        <button id="tab-leaderboard"
                                onclick="ReferralsModule.switchTab('leaderboard')"
                                style="padding: 10px 20px; background: none; border: none; color: var(--tg-theme-text-color); cursor: pointer;">
                            ${t('referrals.leaderboard')}
                        </button>
                    </div>

                    <div id="tab-content">
                        ${this.renderReferralsList(data, app)}
                    </div>
                </div>
            `;

            // Зберігаємо дані для табів
            this.myReferrals = data;
            this.leaderboard = leaderboard;

        } catch (error) {
            app.tg.showAlert(`❌ ${t('errors.loadingReferrals')}: ${error.message}`);
        }
    },

    // Рендер списку рефералів
    renderReferralsList(data, app) {
        const t = (key) => app.t(key);

        if (!data.referrals || data.referrals.length === 0) {
            return `
                <div style="text-align: center; padding: 50px;">
                    <div style="font-size: 60px; margin-bottom: 20px;">👥</div>
                    <h3>${t('referrals.noReferrals')}</h3>
                    <p style="color: var(--tg-theme-hint-color); margin-bottom: 20px;">
                        ${t('referrals.inviteFriends')}
                    </p>
                    <button onclick="ReferralsModule.shareToTelegram()"
                            style="padding: 12px 24px; background: var(--primary-color); color: white; border: none; border-radius: 8px; cursor: pointer;">
                        ✈️ ${t('referrals.inviteNow')}
                    </button>
                </div>
            `;
        }

        return `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 25px;">
                <div style="background: #e8f5e9; border-radius: 12px; padding: 15px; text-align: center;">
                    <div style="color: #4caf50; font-size: 24px; font-weight: bold;">
                        ${data.statistics.active}
                    </div>
                    <div style="font-size: 12px; color: #666;">
                        ${t('referrals.activeUsers')}
                    </div>
                </div>
                <div style="background: #fff3e0; border-radius: 12px; padding: 15px; text-align: center;">
                    <div style="color: #ff9800; font-size: 24px; font-weight: bold;">
                        ${data.statistics.pending}
                    </div>
                    <div style="font-size: 12px; color: #666;">
                        ${t('referrals.pendingUsers')}
                    </div>
                </div>
                <div style="background: #f3e5f5; border-radius: 12px; padding: 15px; text-align: center;">
                    <div style="color: #9c27b0; font-size: 24px; font-weight: bold;">
                        💎 ${data.statistics.total_earned}
                    </div>
                    <div style="font-size: 12px; color: #666;">
                        ${t('referrals.totalEarned')}
                    </div>
                </div>
            </div>

            <div style="display: flex; flex-direction: column; gap: 15px;">
                ${data.referrals.map(referral => `
                    <div style="background: var(--tg-theme-bg-color); border: 1px solid var(--tg-theme-secondary-bg-color); border-radius: 12px; padding: 15px;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div style="display: flex; align-items: center; gap: 15px;">
                                <img src="${referral.user.avatar}"
                                     style="width: 40px; height: 40px; border-radius: 50%;">
                                <div>
                                    <div style="font-weight: 600;">
                                        ${referral.user.full_name}
                                    </div>
                                    <div style="font-size: 12px; color: var(--tg-theme-hint-color);">
                                        @${referral.user.username || 'user'} • ${new Date(referral.registered_at).toLocaleDateString('uk-UA')}
                                    </div>
                                </div>
                            </div>
                            <div style="text-align: right;">
                                <div style="font-weight: bold; color: ${referral.status === 'active' ? '#4caf50' : '#ff9800'};">
                                    💎 ${referral.your_earnings}
                                </div>
                                <div style="font-size: 12px; color: ${referral.status === 'active' ? '#4caf50' : '#ff9800'};">
                                    ${t('referrals.status.' + referral.status)}
                                </div>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    },

    // Рендер лідерборду
    renderLeaderboard(data, app) {
        const t = (key) => app.t(key);

        return `
            <div style="display: flex; flex-direction: column; gap: 15px;">
                ${data.leaderboard.map(leader => `
                    <div style="background: var(--tg-theme-bg-color); border: 1px solid var(--tg-theme-secondary-bg-color); border-radius: 12px; padding: 15px; display: flex; align-items: center; justify-content: space-between;">
                        <div style="display: flex; align-items: center; gap: 15px;">
                            <div style="font-size: 20px; font-weight: bold; width: 30px; text-align: center;">${leader.position}</div>
                            <img src="${leader.user.avatar}" style="width: 40px; height: 40px; border-radius: 50%;">
                            <div>
                                <div style="font-weight: 600;">${leader.user.full_name}</div>
                                <div style="font-size: 12px; color: var(--tg-theme-hint-color);">${leader.badge.emoji} ${leader.badge.name}</div>
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-weight: bold; color: var(--primary-color);">${leader.referrals_count} ${t('referrals.friends')}</div>
                            <div style="font-size: 12px; color: var(--tg-theme-hint-color);">💎 ${leader.total_earned} ${t('referrals.earned')}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    },

    // Перемикання табів
    switchTab(tabName) {
        const t = (key) => this.app.t(key);
        const tabContent = document.getElementById('tab-content');
        const tabReferrals = document.getElementById('tab-referrals');
        const tabLeaderboard = document.getElementById('tab-leaderboard');

        if (tabName === 'referrals') {
            tabContent.innerHTML = this.renderReferralsList(this.myReferrals, this.app);
            tabReferrals.style.borderBottom = '2px solid var(--primary-color)';
            tabReferrals.style.color = 'var(--primary-color)';
            tabLeaderboard.style.borderBottom = 'none';
            tabLeaderboard.style.color = 'var(--tg-theme-text-color)';
        } else {
            tabContent.innerHTML = this.renderLeaderboard(this.leaderboard, this.app);
            tabLeaderboard.style.borderBottom = '2px solid var(--primary-color)';
            tabLeaderboard.style.color = 'var(--primary-color)';
            tabReferrals.style.borderBottom = 'none';
            tabReferrals.style.color = 'var(--tg-theme-text-color)';
        }
    },

    // Копіювання коду
    copyCode(code) {
        navigator.clipboard.writeText(code).then(() => {
            this.app.tg.showAlert('✅ ' + this.app.t('referrals.codeCopied'));
        });
    },

    // Копіювання посилання
    copyLink(link) {
        navigator.clipboard.writeText(link).then(() => {
            this.app.tg.showAlert('✅ ' + this.app.t('referrals.linkCopied'));
        });
    },

    // Поділитися в Telegram
    shareToTelegram() {
        const t = (key) => this.app.t(key);
        if (this.myCode) {
            const url = `https://t.me/share/url?url=${encodeURIComponent(this.myCode.referral_link)}&text=${encodeURIComponent(this.myCode.share_text)}`;
            this.app.tg.openTelegramLink(url);
        }
    }
};