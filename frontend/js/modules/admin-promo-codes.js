// frontend/js/modules/admin-promo-codes.js
window.AdminPromoCodesModule = {

    async showPage(app) {
        const t = (key) => app.t(key);
        const content = document.getElementById('app-content');
        content.innerHTML = `<div class="loader-container"><div class="loader"></div></div>`;

        try {
            const promoCodes = await app.api.get('/api/promo-codes/');

            content.innerHTML = `
                <div class="admin-promo-codes p-3">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px;">
                        <h2>🎟️ ${t('admin.promoCodes.title')} (${promoCodes.length})</h2>
                        <div>
                            <button onclick="this.style.display='none'; document.getElementById('create-promo-form').style.display='block';"
                                style="padding: 8px 16px; background: var(--primary-color); color: white; border: none; border-radius: 6px; cursor: pointer; margin-right: 10px;">
                                + ${t('admin.promoCodes.createButton')}
                            </button>
                            <button onclick="window.app.loadPage('admin')"
                                style="padding: 8px 16px; background: var(--tg-theme-secondary-bg-color); border: none; border-radius: 6px; cursor: pointer;">
                                ← ${t('buttons.back')}
                            </button>
                        </div>
                    </div>

                    <form id="create-promo-form" style="display: none; background: var(--tg-theme-secondary-bg-color); padding: 20px; border-radius: 12px; margin-bottom: 25px;">
                        <h3 style="margin-top:0;">${t('admin.promoCodes.newPromoCode')}</h3>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                            <input type="text" id="promo-code"
                                placeholder="${t('admin.promoCodes.codePlaceholder')}"
                                required
                                style="padding: 10px; border-radius: 6px; border: 1px solid #ccc;">

                            <select id="promo-type" style="padding: 10px; border-radius: 6px; border: 1px solid #ccc;">
                                <option value="percentage">${t('admin.promoCodes.typePercentage')}</option>
                                <option value="fixed_amount">${t('admin.promoCodes.typeFixed')}</option>
                            </select>

                            <input type="number" id="promo-value"
                                placeholder="${t('admin.promoCodes.valuePlaceholder')}"
                                required
                                style="padding: 10px; border-radius: 6px; border: 1px solid #ccc;">

                            <input type="number" id="promo-max-uses"
                                placeholder="${t('admin.promoCodes.maxUsesPlaceholder')}"
                                style="padding: 10px; border-radius: 6px; border: 1px solid #ccc;">

                            <input type="datetime-local" id="promo-expires"
                                title="${t('admin.promoCodes.expiresTitle')}"
                                style="padding: 10px; border-radius: 6px; border: 1px solid #ccc;">
                        </div>
                        <div style="margin-top: 15px;">
                            <button type="button" onclick="AdminPromoCodesModule.createCode(window.app)"
                                style="padding: 10px 20px; background: var(--primary-color); color: white; border: none; border-radius: 6px;">
                                ${t('buttons.create')}
                            </button>
                            <button type="button"
                                onclick="document.getElementById('create-promo-form').style.display='none'; document.querySelector('button[onclick*=\\'create-promo-form\\']').style.display='inline-block';"
                                style="margin-left: 10px; background: none; border: none; cursor: pointer;">
                                ${t('buttons.cancel')}
                            </button>
                        </div>
                    </form>

                    <div class="promo-codes-list">
                        ${this.renderPromoCodesList(promoCodes, app)}
                    </div>
                </div>
            `;
        } catch (error) {
            content.innerHTML = app.showError(t('admin.promoCodes.loadError'));
        }
    },

    renderPromoCodesList(codes, app) {
        const t = (key) => app.t(key);

        if (codes.length === 0) {
            return `<p style="text-align: center; color: var(--tg-theme-hint-color);">${t('admin.promoCodes.noPromoCodes')}</p>`;
        }

        return `
            <div style="display: flex; flex-direction: column; gap: 10px;">
                ${codes.map(code => {
                    const expiresText = code.expires_at
                        ? new Date(code.expires_at).toLocaleDateString(app.currentLang === 'ua' ? 'uk-UA' : 'en-US')
                        : t('admin.promoCodes.noExpiry');

                    const statusColor = code.is_active ? '#4CAF50' : '#F44336';
                    const statusText = code.is_active
                        ? t('admin.promoCodes.statusActive')
                        : t('admin.promoCodes.statusInactive');

                    return `
                        <div style="background: var(--tg-theme-bg-color); border: 1px solid var(--tg-theme-secondary-bg-color); padding: 15px; border-radius: 8px;">
                            <div style="display: grid; grid-template-columns: 1fr auto auto; gap: 15px; align-items: center;">
                                <div>
                                    <strong style="font-size: 18px; color: var(--primary-color);">${code.code}</strong>
                                    <div style="font-size: 14px; margin-top: 5px;">
                                        ${t('admin.promoCodes.discount')}: ${code.value} ${code.discount_type === 'percentage' ? '%' : 'USD'}
                                    </div>
                                    <div style="font-size: 12px; color: var(--tg-theme-hint-color); margin-top: 3px;">
                                        ${t('admin.promoCodes.expires')}: ${expiresText}
                                    </div>
                                </div>

                                <div style="text-align: center;">
                                    <div style="font-size: 14px;">
                                        ${t('admin.promoCodes.used')}: ${code.current_uses} / ${code.max_uses || '∞'}
                                    </div>
                                    <div style="font-size: 12px; color: ${statusColor}; margin-top: 5px;">
                                        ${statusText}
                                    </div>
                                </div>

                                <div style="display: flex; gap: 10px; align-items: center;">
                                    <label class="switch" title="${t('admin.promoCodes.toggleStatus')}">
                                        <input type="checkbox"
                                            ${code.is_active ? 'checked' : ''}
                                            onchange="AdminPromoCodesModule.toggleActive(${code.id}, this.checked)">
                                        <span class="slider round"></span>
                                    </label>

                                    <button onclick="AdminPromoCodesModule.deleteCode(${code.id}, '${code.code}')"
                                        style="background: #F44336; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer;"
                                        title="${t('buttons.delete')}">
                                        🗑️
                                    </button>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    },

    async createCode(app) {
        const t = (key) => app.t(key);

        const data = {
            code: document.getElementById('promo-code').value,
            discount_type: document.getElementById('promo-type').value,
            value: parseFloat(document.getElementById('promo-value').value),
            max_uses: parseInt(document.getElementById('promo-max-uses').value) || null,
            expires_at: document.getElementById('promo-expires').value || null,
        };

        if (!data.code || !data.value) {
            app.tg.showAlert(t('admin.promoCodes.requiredFields'));
            return;
        }

        try {
            await app.api.post('/api/promo-codes/', data);
            app.tg.showAlert(t('admin.promoCodes.createSuccess'));
            this.showPage(app);
        } catch (error) {
            app.tg.showAlert(t('admin.promoCodes.createError') + ': ' + error.message);
        }
    },

    async toggleActive(codeId, isActive) {
        const t = (key) => window.app.t(key);

        try {
            await window.app.api.put(`/api/promo-codes/${codeId}`, { is_active: isActive });
            window.app.tg.showAlert(t('admin.promoCodes.updateSuccess'));
        } catch (error) {
            window.app.tg.showAlert(t('admin.promoCodes.updateError'));
            // Повертаємо перемикач назад
            const checkbox = event.target;
            checkbox.checked = !isActive;
        }
    },

    async deleteCode(codeId, codeText) {
        const t = (key) => window.app.t(key);

        if (confirm(t('admin.promoCodes.confirmDelete').replace('{code}', codeText))) {
            try {
                await window.app.api.delete(`/api/promo-codes/${codeId}`);
                window.app.tg.showAlert(t('admin.promoCodes.deleteSuccess'));
                this.showPage(window.app);
            } catch (error) {
                window.app.tg.showAlert(t('admin.promoCodes.deleteError'));
            }
        }
    }
};