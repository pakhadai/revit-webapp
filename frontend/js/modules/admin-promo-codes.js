// frontend/js/modules/admin-promo-codes.js
window.AdminPromoCodesModule = {

    async showPage(app) {
        const content = document.getElementById('app-content');
        content.innerHTML = `<div class="loader-container"><div class="loader"></div></div>`;

        try {
            const promoCodes = await app.api.get('/api/promo-codes/');

            content.innerHTML = `
                <div class="admin-promo-codes p-3">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px;">
                        <h2>🎟️ Керування промокодами (${promoCodes.length})</h2>
                        <div>
                            <button onclick="this.style.display='none'; document.getElementById('create-promo-form').style.display='block';" style="padding: 8px 16px; background: var(--primary-color); color: white; border: none; border-radius: 6px; cursor: pointer; margin-right: 10px;">+ Створити промокод</button>
                            <button onclick="window.app.loadPage('admin')" style="padding: 8px 16px; background: var(--tg-theme-secondary-bg-color); border: none; border-radius: 6px; cursor: pointer;">← Назад</button>
                        </div>
                    </div>

                    <form id="create-promo-form" style="display: none; background: var(--tg-theme-secondary-bg-color); padding: 20px; border-radius: 12px; margin-bottom: 25px;">
                        <h3 style="margin-top:0;">Новий промокод</h3>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                            <input type="text" id="promo-code" placeholder="Код (напр. SALE15)" required style="padding: 10px; border-radius: 6px; border: 1px solid #ccc;">
                            <select id="promo-type" style="padding: 10px; border-radius: 6px; border: 1px solid #ccc;">
                                <option value="percentage">Відсоток (%)</option>
                                <option value="fixed_amount">Фіксована сума (USD)</option>
                            </select>
                            <input type="number" id="promo-value" placeholder="Значення (напр. 15)" required style="padding: 10px; border-radius: 6px; border: 1px solid #ccc;">
                            <input type="number" id="promo-max-uses" placeholder="Макс. використань (необов'язково)" style="padding: 10px; border-radius: 6px; border: 1px solid #ccc;">
                            <input type="datetime-local" id="promo-expires" style="padding: 10px; border-radius: 6px; border: 1px solid #ccc;">
                        </div>
                        <div style="margin-top: 15px;">
                            <button type="button" onclick="AdminPromoCodesModule.createCode(window.app)" style="padding: 10px 20px; background: var(--primary-color); color: white; border: none; border-radius: 6px;">Створити</button>
                            <button type="button" onclick="document.getElementById('create-promo-form').style.display='none'; document.querySelector('button[onclick*=\\'create-promo-form\\']').style.display='inline-block';" style="margin-left: 10px; background: none; border: none;">Скасувати</button>
                        </div>
                    </form>

                    <div class="promo-codes-list">
                        ${this.renderPromoCodesList(promoCodes)}
                    </div>
                </div>
            `;
        } catch (error) {
            content.innerHTML = app.showError('Не вдалося завантажити промокоди.');
        }
    },

    renderPromoCodesList(codes) {
        if (codes.length === 0) return '<p>Промокодів ще немає.</p>';
        return `
            <div style="display: flex; flex-direction: column; gap: 10px;">
                ${codes.map(code => `
                    <div style="background: var(--tg-theme-bg-color); border: 1px solid var(--tg-theme-secondary-bg-color); padding: 15px; border-radius: 8px;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <strong style="font-size: 18px; color: var(--primary-color);">${code.code}</strong>
                                <div style="font-size: 14px;">Знижка: ${code.value} ${code.discount_type === 'percentage' ? '%' : 'USD'}</div>
                            </div>
                            <div>
                                <div>Використано: ${code.current_uses} / ${code.max_uses || '∞'}</div>
                                <div style="font-size: 12px; color: ${code.is_active ? 'green' : 'red'};">${code.is_active ? 'Активний' : 'Неактивний'}</div>
                            </div>
                            <label class="switch">
                                <input type="checkbox" ${code.is_active ? 'checked' : ''} onchange="AdminPromoCodesModule.toggleActive(${code.id}, this.checked)">
                                <span class="slider round"></span>
                            </label>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    },

    async createCode(app) {
        const data = {
            code: document.getElementById('promo-code').value,
            discount_type: document.getElementById('promo-type').value,
            value: parseFloat(document.getElementById('promo-value').value),
            max_uses: parseInt(document.getElementById('promo-max-uses').value) || null,
            expires_at: document.getElementById('promo-expires').value || null,
        };

        if (!data.code || !data.value) {
            alert('Код та значення є обов\'язковими');
            return;
        }

        try {
            await app.api.post('/api/promo-codes/', data);
            alert('Промокод створено!');
            this.showPage(app);
        } catch (error) {
            alert('Помилка створення: ' + error.message);
        }
    },

    async toggleActive(codeId, isActive) {
        try {
            await window.app.api.put(`/api/promo-codes/${codeId}`, { is_active: isActive });
        } catch (error) {
            alert('Помилка оновлення статусу');
        }
    }
};