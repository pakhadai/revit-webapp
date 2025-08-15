// frontend/js/modules/onboarding.js - ВИПРАВЛЕНА ВЕРСІЯ

window.OnboardingModule = {
    currentStep: 0,
    referralCode: null,

    // Перевірити чи користувач новий
    async checkIfNewUser(app) {
        const hasCompletedRegistration = app.storage.get('hasCompletedRegistration');
        return !hasCompletedRegistration;
    },

    // --- ОСНОВНІ ФУНКЦІЇ УПРАВЛІННЯ ---

    async showWelcome(app) {
        this.app = app;
        const modalHtml = this._renderOnboardingShell();
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        this._updateContent(this._getWelcomeContent());
        this._updateProgress(1);
        this.currentStep = 1;
    },

    nextStep() {
        this.currentStep++;
        switch (this.currentStep) {
            case 2:
                this.showFeatures();
                break;
            case 3:
                this.showRules();
                break;
            case 4:
                this.showReferralInput();
                break;
            case 5:
                this.completeRegistration();
                break;
        }
    },

    // --- КРОКИ ОНБОРДИНГУ ---

    showFeatures() {
        this._updateContent(this._getFeaturesContent());
        this._updateProgress(2);
        this._updateFooterButton('Далі →', 'OnboardingModule.nextStep()');
    },

    showRules() {
        this._updateContent(this._getRulesContent());
        this._updateProgress(3);
        const footerButton = document.querySelector('#onboarding-footer button');
        if (footerButton) {
            footerButton.disabled = true;
            footerButton.style.opacity = '0.5';
        }

        const checkbox = document.getElementById('accept-rules');
        if (checkbox) {
            checkbox.addEventListener('change', (e) => {
                if (footerButton) {
                    footerButton.disabled = !e.target.checked;
                    footerButton.style.opacity = e.target.checked ? '1' : '0.5';
                }
            });
        }
    },

    showReferralInput() {
        this._updateContent(this._getReferralContent());
        this._updateProgress(4);
        const footer = document.getElementById('onboarding-footer');
        if (footer) {
            footer.style.display = 'none';
        }
    },

    async completeRegistration() {
        try {
            await this.app.api.post('/api/auth/complete-onboarding', {
                language: this.app.currentLang || 'ua',
                referral_code: this.referralCode || null
            });

            this.app.storage.set('hasCompletedRegistration', true);
            this.app.storage.set('registrationDate', new Date().toISOString());

            const modal = document.getElementById('onboarding-modal');
            if (modal) {
                modal.style.animation = 'fadeOut 0.3s forwards';
                setTimeout(() => modal.remove(), 300);
            }

            this.app.tg.showAlert('🎉 Вітаємо! Реєстрація завершена!');

            // Перезавантажуємо сторінку на головну
            await this.app.loadPage('home');

        } catch (error) {
            console.error('Registration error:', error);
            this.app.showError('Помилка завершення реєстрації');
        }
    }, // <-- Ось тут була пропущена кома

    // --- РЕФЕРАЛЬНА СИСТЕМА ---

    async applyReferralCode() {
        const input = document.getElementById('referral-code-input');
        const code = input.value.trim().toUpperCase();
        const errorDiv = document.getElementById('referral-error');
        const button = document.getElementById('apply-referral-btn');

        if (!code) {
            errorDiv.textContent = 'Введіть код або пропустіть цей крок';
            errorDiv.style.display = 'block';
            return;
        }

        button.disabled = true;
        button.textContent = 'Перевірка...';

        try {
            const response = await this.app.api.post('/api/referrals/apply-code', { code });
            if (response.success) {
                this.referralCode = code;
                input.style.borderColor = '#4CAF50';
                errorDiv.style.display = 'none';
                button.textContent = '✓ Код застосовано!';
                button.style.background = '#4CAF50';

                if (response.welcome_bonus > 0) {
                    this.app.tg.showAlert(`🎉 Вітаємо! Ви отримали ${response.welcome_bonus} бонусів!`);
                }
                setTimeout(() => this.completeRegistration(), 1500);
            }
        } catch (error) {
            errorDiv.textContent = error.message || 'Недійсний код';
            errorDiv.style.display = 'block';
            input.style.borderColor = '#f44336';
            button.disabled = false;
            button.textContent = 'Застосувати код';
        }
    },

    skipReferral() {
        this.completeRegistration();
    },

    // --- ДОПОМІЖНІ ФУНКЦІЇ РЕНДЕРУ ---

    _renderOnboardingShell() {
        return `
            <div id="onboarding-modal" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.6); z-index: 10000; display: flex; align-items: center; justify-content: center; padding: 15px;">
                <div class="onboarding-modal-content" style="background: var(--tg-theme-bg-color); max-width: 480px; width: 100%; max-height: 95vh; border-radius: 16px; overflow: hidden; display: flex; flex-direction: column;">
                    <div id="onboarding-progress" style="padding: 20px; background: var(--tg-theme-bg-color);"></div>
                    <div id="onboarding-content" style="flex: 1; padding: 20px 30px; overflow-y: auto; display: flex; flex-direction: column; justify-content: flex-start;"></div>
                    <div id="onboarding-footer" style="padding: 20px; background: var(--tg-theme-bg-color); border-top: 1px solid var(--tg-theme-secondary-bg-color);">
                        <button onclick="OnboardingModule.nextStep()" style="width: 100%; padding: 15px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 12px; font-size: 16px; font-weight: 600; cursor: pointer;">
                            Далі →
                        </button>
                    </div>
                </div>
            </div>
            <style>
                @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
                .onboarding-modal-content { animation: zoomIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
                @keyframes zoomIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
            </style>
        `;
    },

    _updateContent(html) {
        const contentEl = document.getElementById('onboarding-content');
        if (contentEl) {
            contentEl.innerHTML = html;
        }
    },

    _updateProgress(step) {
        const progressEl = document.getElementById('onboarding-progress');
        if (progressEl) {
            let progressHtml = '<div style="display: flex; gap: 8px;">';
            for (let i = 1; i <= 4; i++) {
                const color = i <= step ? 'var(--primary-color)' : '#e0e0e0';
                progressHtml += `<div style="flex: 1; height: 4px; background: ${color}; border-radius: 2px;"></div>`;
            }
            progressHtml += '</div>';
            progressEl.innerHTML = progressHtml;
        }
    },

    _updateFooterButton(text, onclickAction) {
        const footerEl = document.getElementById('onboarding-footer');
        if (footerEl) {
            footerEl.style.display = 'block';
            footerEl.innerHTML = `
                <button onclick="${onclickAction}" style="width: 100%; padding: 15px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 12px; font-size: 16px; font-weight: 600; cursor: pointer;">
                    ${text}
                </button>
            `;
        }
    },

    _getWelcomeContent() {
        return `
            <div style="text-align: center; margin-bottom: 30px;">
                <div style="width: 120px; height: 120px; margin: 0 auto; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 30px; display: flex; align-items: center; justify-content: center;">
                    <span style="font-size: 60px;">🏗️</span>
                </div>
            </div>
            <h1 style="text-align: center; margin: 0 0 15px; font-size: 28px; color: var(--tg-theme-text-color);">Вітаємо в RevitBot!</h1>
            <p style="text-align: center; color: var(--tg-theme-hint-color); font-size: 16px; line-height: 1.5; margin: 0 0 40px;">Найбільша колекція Revit сімейств для архітекторів та дизайнерів</p>
            <div style="margin-bottom: 40px;">
                <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 20px;">
                    <div style="width: 50px; height: 50px; background: rgba(102, 126, 234, 0.1); border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;"><span style="font-size: 24px;">📦</span></div>
                    <div><h4 style="margin: 0 0 5px; font-size: 16px;">1000+ моделей</h4><p style="margin: 0; font-size: 14px; color: var(--tg-theme-hint-color);">Величезна бібліотека готових Revit сімейств</p></div>
                </div>
                <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 20px;">
                    <div style="width: 50px; height: 50px; background: rgba(102, 126, 234, 0.1); border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;"><span style="font-size: 24px;">💎</span></div>
                    <div><h4 style="margin: 0 0 5px; font-size: 16px;">Premium підписка</h4><p style="margin: 0; font-size: 14px; color: var(--tg-theme-hint-color);">Необмежений доступ до всіх архівів</p></div>
                </div>
                <div style="display: flex; align-items: center; gap: 15px;">
                    <div style="width: 50px; height: 50px; background: rgba(102, 126, 234, 0.1); border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;"><span style="font-size: 24px;">🎁</span></div>
                    <div><h4 style="margin: 0 0 5px; font-size: 16px;">Бонусна система</h4><p style="margin: 0; font-size: 14px; color: var(--tg-theme-hint-color);">Отримуйте бонуси щодня та за рефералів</p></div>
                </div>
            </div>
        `;
    },

    _getFeaturesContent() {
        return `
            <h2 style="text-align: center; margin: 0 0 30px; font-size: 24px;">Як це працює? 🤔</h2>
            <div style="margin-bottom: 30px;">
                <div style="display: flex; gap: 15px; margin-bottom: 25px;">
                    <div style="width: 40px; height: 40px; background: var(--primary-color); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-weight: bold;">1</div>
                    <div><h4 style="margin: 0 0 5px;">Обирайте модель</h4><p style="margin: 0; color: var(--tg-theme-hint-color); font-size: 14px;">Переглядайте каталог та додавайте потрібні архіви в кошик</p></div>
                </div>
                <div style="display: flex; gap: 15px; margin-bottom: 25px;">
                    <div style="width: 40px; height: 40px; background: var(--primary-color); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-weight: bold;">2</div>
                    <div><h4 style="margin: 0 0 5px;">Оплачуйте зручно</h4><p style="margin: 0; color: var(--tg-theme-hint-color); font-size: 14px;">Використовуйте криптовалюту або бонуси (до 70% від суми)</p></div>
                </div>
                <div style="display: flex; gap: 15px; margin-bottom: 25px;">
                    <div style="width: 40px; height: 40px; background: var(--primary-color); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-weight: bold;">3</div>
                    <div><h4 style="margin: 0 0 5px;">Завантажуйте миттєво</h4><p style="margin: 0; color: var(--tg-theme-hint-color); font-size: 14px;">Отримуйте посилання на завантаження одразу після оплати</p></div>
                </div>
            </div>
            <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); border-radius: 16px; padding: 20px; color: white; text-align: center;">
                <h3 style="margin: 0 0 10px;">💎 Premium підписка</h3>
                <p style="margin: 0 0 15px; opacity: 0.9;">Необмежений доступ до ВСІХ архівів!</p>
                <div style="display: flex; gap: 10px; justify-content: center;">
                    <div style="background: rgba(255,255,255,0.2); padding: 10px 15px; border-radius: 8px;"><div style="font-size: 20px; font-weight: bold;">$5</div><div style="font-size: 12px; opacity: 0.9;">на місяць</div></div>
                    <div style="background: rgba(255,255,255,0.2); padding: 10px 15px; border-radius: 8px;"><div style="font-size: 20px; font-weight: bold;">$50</div><div style="font-size: 12px; opacity: 0.9;">на рік (-17%)</div></div>
                </div>
            </div>
        `;
    },

    _getRulesContent() {
        return `
            <h2 style="text-align: center; margin: 0 0 30px; font-size: 24px;">Правила користування 📋</h2>
            <div style="background: var(--tg-theme-secondary-bg-color); border-radius: 12px; padding: 20px; margin-bottom: 30px;">
                <div style="margin-bottom: 20px;">
                    <h4 style="margin: 0 0 10px; display: flex; align-items: center; gap: 8px;"><span style="color: #4CAF50;">✓</span> Дозволено</h4>
                    <ul style="margin: 0; padding-left: 25px; color: var(--tg-theme-hint-color); font-size: 14px; line-height: 1.8;">
                        <li>Використовувати моделі у комерційних проектах</li>
                        <li>Модифікувати та адаптувати під свої потреби</li>
                        <li>Ділитися з колегами в межах компанії</li>
                        <li>Запрошувати друзів за реферальною програмою</li>
                    </ul>
                </div>
                <div>
                    <h4 style="margin: 0 0 10px; display: flex; align-items: center; gap: 8px;"><span style="color: #f44336;">✗</span> Заборонено</h4>
                    <ul style="margin: 0; padding-left: 25px; color: var(--tg-theme-hint-color); font-size: 14px; line-height: 1.8;">
                        <li>Перепродавати або розповсюджувати архіви</li>
                        <li>Ділитися обліковим записом з іншими</li>
                        <li>Використовувати автоматизовані засоби завантаження</li>
                        <li>Порушувати авторські права творців моделей</li>
                    </ul>
                </div>
            </div>
            <div style="background: rgba(102, 126, 234, 0.1); border-radius: 12px; padding: 15px; text-align: center;">
                <p style="margin: 0 0 10px; font-size: 14px;">Виникли питання? Ми завжди на зв'язку!</p>
                <a href="https://t.me/revitbot_support" target="_blank" style="display: inline-flex; align-items: center; gap: 8px; color: var(--primary-color); text-decoration: none; font-weight: 600;">💬 Підтримка в Telegram</a>
            </div>
            <div style="margin-top: 30px; padding: 15px; background: var(--tg-theme-bg-color); border: 2px solid var(--tg-theme-secondary-bg-color); border-radius: 12px;">
                <label style="display: flex; align-items: flex-start; gap: 12px; cursor: pointer;">
                    <input type="checkbox" id="accept-rules" style="width: 20px; height: 20px; margin-top: 2px; cursor: pointer;">
                    <span style="font-size: 14px; line-height: 1.5;">Я прочитав та погоджуюсь з правилами користування сервісом RevitBot</span>
                </label>
            </div>
        `;
    },

    _getReferralContent() {
        return `
            <div style="text-align: center; margin-bottom: 30px;">
                <div style="width: 80px; height: 80px; margin: 0 auto 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                    <span style="font-size: 40px;">🎁</span>
                </div>
                <h2 style="margin: 0 0 10px; font-size: 24px;">Є реферальний код?</h2>
                <p style="margin: 0; color: var(--tg-theme-hint-color); font-size: 14px;">Введіть код друга та отримайте бонуси!</p>
            </div>
            <div style="margin-bottom: 20px;">
                <input type="text" id="referral-code-input" placeholder="Введіть код (необов'язково)" style="width: 100%; padding: 15px; border: 2px solid var(--tg-theme-secondary-bg-color); border-radius: 12px; font-size: 16px; text-align: center; text-transform: uppercase;">
                <div id="referral-error" style="color: #f44336; font-size: 12px; margin-top: 5px; text-align: center; display: none;"></div>
            </div>
            <div id="referral-buttons">
                <button onclick="OnboardingModule.applyReferralCode()" id="apply-referral-btn" style="width: 100%; padding: 15px; background: var(--primary-color); color: white; border: none; border-radius: 12px; font-size: 16px; font-weight: 600; cursor: pointer; margin-bottom: 10px;">Застосувати код</button>
                <button onclick="OnboardingModule.skipReferral()" style="width: 100%; padding: 15px; background: transparent; color: var(--tg-theme-hint-color); border: none; font-size: 14px; cursor: pointer;">Пропустити цей крок</button>
            </div>
        `;
    }
};