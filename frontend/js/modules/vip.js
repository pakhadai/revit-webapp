// Модуль VIP системи
window.VipModule = {
    status: null,

    async init(app) {
        this.app = app;
        try {
            this.status = await this.app.api.get('/api/vip/status');
        } catch (error) {
            console.error('Error loading VIP status:', error);
            this.status = null;
        }
    },

    async renderVipBlock(app) {
        await this.init(app);
        const t = (key) => app.t(key);

        if (!this.status) {
            return ''; // Не показувати блок, якщо не вдалося завантажити статус
        }

        const { level, cashback_rate, total_spent, next_level_info } = this.status;

        const levelColors = {
            bronze: { bg: '#cd7f32', text: 'white' },
            silver: { bg: '#c0c0c0', text: '#2c3e50' },
            gold: { bg: '#ffd700', text: '#2c3e50' },
            diamond: { bg: '#b9f2ff', text: '#2c3e50' }
        };

        const currentColor = levelColors[level] || levelColors.bronze;

        let progressHtml = '';
        if (next_level_info) {
            progressHtml = `
                <div style="margin-top: 15px;">
                    <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 5px; color: var(--tg-theme-hint-color);">
                        <span>${t('vip.progressTo')} ${t('vip.levels.'+next_level_info.level)}</span>
                        <span>$${total_spent.toFixed(2)} / $${next_level_info.required.toFixed(2)}</span>
                    </div>
                    <div style="background: var(--tg-theme-secondary-bg-color); border-radius: 5px; height: 10px; overflow: hidden;">
                        <div style="width: ${next_level_info.progress.toFixed(2)}%; height: 100%; background: var(--primary-color); border-radius: 5px; transition: width 0.5s;"></div>
                    </div>
                    <div style="font-size: 12px; text-align: center; margin-top: 5px; color: var(--tg-theme-hint-color);">
                        ${t('vip.needed')}: $${next_level_info.needed.toFixed(2)}
                    </div>
                </div>
            `;
        } else {
             progressHtml = `
                <div style="margin-top: 15px; text-align: center; font-size: 14px; color: ${currentColor.bg};">
                    <strong>${t('vip.maxLevelReached')}</strong>
                </div>
             `;
        }


        return `
            <div class="vip-block" style="background: var(--tg-theme-bg-color); border: 1px solid var(--tg-theme-secondary-bg-color); border-radius: 16px; padding: 20px; margin-top: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <h3 style="margin: 0; font-size: 20px;">${t('vip.title')}</h3>
                    <div style="padding: 4px 12px; border-radius: 20px; font-size: 14px; font-weight: bold; background-color: ${currentColor.bg}; color: ${currentColor.text};">
                        ${t('vip.levels.'+level)}
                    </div>
                </div>
                <div style="font-size: 14px; color: var(--tg-theme-hint-color);">
                   ${t('vip.yourCashback')}: <strong style="color: var(--primary-color);">${cashback_rate.toFixed(0)}%</strong>
                </div>

                ${progressHtml}
            </div>
        `;
    }
};