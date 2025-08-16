// frontend/js/modules/registration.js
window.RegistrationModule = {
    translations: {
        ua: {
            welcome: "Ласкаво просимо!",
            welcomeText: "Раді вітати вас у нашому маркетплейсі Revit сімейств",
            features: "Можливості",
            featuresText: "• Понад 10,000 моделей\n• Щоденні оновлення\n• Підтримка 24/7\n• Бонусна система",
            rules: "Правила користування",
            rulesText: "Використовуючи наш сервіс, ви погоджуєтесь з правилами:",
            rule1: "Заборонено перепродавати моделі",
            rule2: "Один аккаунт - один користувач",
            rule3: "Підписка дає доступ до всіх моделей",
            acceptRules: "Я приймаю правила",
            referralCode: "Реферальний код",
            referralHint: "Якщо у вас є код від друга",
            enterCode: "Введіть код",
            applyCode: "Застосувати",
            skipCode: "Пропустити",
            complete: "Завершити реєстрацію",
            loading: "Завантаження...",
            error: "Помилка реєстрації",
            success: "Реєстрація успішна!"
        },
        en: {
            welcome: "Welcome!",
            welcomeText: "Welcome to our Revit families marketplace",
            features: "Features",
            featuresText: "• Over 10,000 models\n• Daily updates\n• 24/7 support\n• Bonus system",
            rules: "Terms of Use",
            rulesText: "By using our service, you agree to the rules:",
            rule1: "Reselling models is prohibited",
            rule2: "One account - one user",
            rule3: "Subscription gives access to all models",
            acceptRules: "I accept the rules",
            referralCode: "Referral Code",
            referralHint: "If you have a code from a friend",
            enterCode: "Enter code",
            applyCode: "Apply",
            skipCode: "Skip",
            complete: "Complete Registration",
            loading: "Loading...",
            error: "Registration error",
            success: "Registration successful!"
        }
    },

    currentStep: 1,
    totalSteps: 4,
    referralCode: null,
    lang: 'ua',

    async init(app) {
        this.app = app;
        this.lang = app.currentLang || 'ua';

        // Перевіряємо чи користувач новий
        const user = await this.checkUser();
        if (user && !user.is_onboarded) {
            this.show();
        }
    },

    async checkUser() {
        try {
            const response = await fetch('/api/auth/me', {
                headers: {
                    'Authorization': `Bearer ${this.app.storage.get('auth_token')}`
                }
            });
            if (response.ok) {
                return await response.json();
            }
        } catch (error) {
            console.error('Check user error:', error);
        }
        return null;
    },

    t(key) {
        return this.translations[this.lang][key] || this.translations['en'][key];
    },

    show() {
        const modal = document.createElement('div');
        modal.id = 'registration-modal';
        modal.className = 'registration-modal';
        modal.innerHTML = `
            <style>
                .registration-modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: var(--tg-theme-bg-color, #fff);
                    z-index: 9999;
                    display: flex;
                    flex-direction: column;
                    animation: slideIn 0.3s ease;
                }

                @keyframes slideIn {
                    from { transform: translateY(100%); }
                    to { transform: translateY(0); }
                }

                .registration-header {
                    padding: 20px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    text-align: center;
                    position: relative;
                }

                .registration-progress {
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    width: 100%;
                    height: 4px;
                    background: rgba(255,255,255,0.3);
                }

                .registration-progress-bar {
                    height: 100%;
                    background: white;
                    transition: width 0.3s ease;
                }

                .registration-lang {
                    position: absolute;
                    top: 20px;
                    right: 20px;
                    display: flex;
                    gap: 10px;
                }

                .lang-btn {
                    padding: 5px 10px;
                    background: rgba(255,255,255,0.2);
                    border: 1px solid white;
                    color: white;
                    border-radius: 5px;
                    cursor: pointer;
                    transition: background 0.3s;
                }

                .lang-btn.active {
                    background: white;
                    color: #667eea;
                }

                .registration-content {
                    flex: 1;
                    padding: 30px 20px;
                    overflow-y: auto;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                }

                .registration-title {
                    font-size: 28px;
                    font-weight: bold;
                    margin-bottom: 20px;
                    color: var(--tg-theme-text-color, #000);
                    text-align: center;
                }

                .registration-text {
                    font-size: 16px;
                    line-height: 1.6;
                    color: var(--tg-theme-hint-color, #666);
                    text-align: center;
                    max-width: 400px;
                    margin-bottom: 30px;
                    white-space: pre-line;
                }

                .registration-features {
                    background: var(--tg-theme-secondary-bg-color, #f4f4f4);
                    border-radius: 15px;
                    padding: 20px;
                    margin-bottom: 30px;
                    max-width: 400px;
                    width: 100%;
                }

                .registration-rules {
                    max-width: 400px;
                    width: 100%;
                }

                .rule-item {
                    padding: 15px;
                    background: var(--tg-theme-secondary-bg-color, #f4f4f4);
                    border-radius: 10px;
                    margin-bottom: 10px;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }

                .rule-item::before {
                    content: "✓";
                    color: #4CAF50;
                    font-size: 20px;
                    font-weight: bold;
                }

                .registration-checkbox {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    margin-top: 20px;
                    cursor: pointer;
                }

                .registration-checkbox input {
                    width: 20px;
                    height: 20px;
                    cursor: pointer;
                }

                .registration-input {
                    width: 100%;
                    max-width: 400px;
                    padding: 15px;
                    border: 2px solid var(--tg-theme-hint-color, #ddd);
                    border-radius: 10px;
                    font-size: 16px;
                    margin-bottom: 15px;
                    transition: border-color 0.3s;
                }

                .registration-input:focus {
                    border-color: #667eea;
                    outline: none;
                }

                .registration-footer {
                    padding: 20px;
                    background: var(--tg-theme-bg-color, #fff);
                    border-top: 1px solid var(--tg-theme-hint-color, #ddd);
                    display: flex;
                    gap: 10px;
                }

                .registration-btn {
                    flex: 1;
                    padding: 15px;
                    border: none;
                    border-radius: 10px;
                    font-size: 16px;
                    font-weight: bold;
                    cursor: pointer;
                    transition: all 0.3s;
                }

                .registration-btn-primary {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                }

                .registration-btn-secondary {
                    background: var(--tg-theme-secondary-bg-color, #f4f4f4);
                    color: var(--tg-theme-text-color, #000);
                }

                .registration-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .registration-btn:not(:disabled):hover {
                    transform: scale(1.02);
                }

                .registration-btn:not(:disabled):active {
                    transform: scale(0.98);
                }

                .success-icon {
                    font-size: 80px;
                    margin-bottom: 20px;
                    animation: bounce 0.5s ease;
                }

                @keyframes bounce {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.2); }
                }
            </style>

            <div class="registration-header">
                <div class="registration-lang">
                    <button class="lang-btn ${this.lang === 'ua' ? 'active' : ''}" onclick="RegistrationModule.switchLang('ua')">UA</button>
                    <button class="lang-btn ${this.lang === 'en' ? 'active' : ''}" onclick="RegistrationModule.switchLang('en')">EN</button>
                </div>
                <h2 style="margin: 0; font-size: 20px;">Revit Families Store</h2>
                <div class="registration-progress">
                    <div class="registration-progress-bar" style="width: ${(this.currentStep / this.totalSteps) * 100}%"></div>
                </div>
            </div>

            <div class="registration-content" id="registration-content">
                ${this.getStepContent()}
            </div>

            <div class="registration-footer" id="registration-footer">
                ${this.getFooterButtons()}
            </div>
        `;

        document.body.appendChild(modal);
    },

    switchLang(lang) {
        this.lang = lang;
        this.app.currentLang = lang;
        this.app.storage.set('language', lang);

        // Оновлюємо кнопки мови
        document.querySelectorAll('.lang-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        event.target.classList.add('active');

        // Оновлюємо контент
        this.updateContent();
    },

    getStepContent() {
        switch (this.currentStep) {
            case 1:
                return `
                    <div class="success-icon">🏗️</div>
                    <h1 class="registration-title">${this.t('welcome')}</h1>
                    <p class="registration-text">${this.t('welcomeText')}</p>
                `;

            case 2:
                return `
                    <div class="success-icon">✨</div>
                    <h1 class="registration-title">${this.t('features')}</h1>
                    <div class="registration-features">
                        <p class="registration-text">${this.t('featuresText')}</p>
                    </div>
                `;

            case 3:
                return `
                    <h1 class="registration-title">${this.t('rules')}</h1>
                    <div class="registration-rules">
                        <div class="rule-item">${this.t('rule1')}</div>
                        <div class="rule-item">${this.t('rule2')}</div>
                        <div class="rule-item">${this.t('rule3')}</div>
                        <label class="registration-checkbox">
                            <input type="checkbox" id="accept-rules" onchange="RegistrationModule.onAcceptRules()">
                            <span>${this.t('acceptRules')}</span>
                        </label>
                    </div>
                `;

            case 4:
                return `
                    <h1 class="registration-title">${this.t('referralCode')}</h1>
                    <p class="registration-text">${this.t('referralHint')}</p>
                    <input type="text"
                           class="registration-input"
                           id="referral-input"
                           placeholder="${this.t('enterCode')}"
                           maxlength="8">
                    <button class="registration-btn registration-btn-primary"
                            onclick="RegistrationModule.applyReferral()"
                            style="max-width: 400px;">
                        ${this.t('applyCode')}
                    </button>
                `;

            case 5:
                return `
                    <div class="success-icon">🎉</div>
                    <h1 class="registration-title">${this.t('success')}</h1>
                    <p class="registration-text">${this.t('welcome')}</p>
                `;
        }
    },

    getFooterButtons() {
        switch (this.currentStep) {
            case 1:
            case 2:
                return `
                    <button class="registration-btn registration-btn-primary"
                            onclick="RegistrationModule.nextStep()">
                        ${this.currentStep === 1 ? this.t('features') : this.t('rules')} →
                    </button>
                `;

            case 3:
                return `
                    <button class="registration-btn registration-btn-primary"
                            id="rules-next-btn"
                            onclick="RegistrationModule.nextStep()"
                            disabled>
                        ${this.t('referralCode')} →
                    </button>
                `;

            case 4:
                return `
                    <button class="registration-btn registration-btn-secondary"
                            onclick="RegistrationModule.skipReferral()">
                        ${this.t('skipCode')}
                    </button>
                `;

            default:
                return '';
        }
    },

    updateContent() {
        const content = document.getElementById('registration-content');
        const footer = document.getElementById('registration-footer');
        const progressBar = document.querySelector('.registration-progress-bar');

        if (content) {
            content.innerHTML = this.getStepContent();
        }

        if (footer) {
            footer.innerHTML = this.getFooterButtons();
        }

        if (progressBar) {
            progressBar.style.width = `${(this.currentStep / this.totalSteps) * 100}%`;
        }
    },

    nextStep() {
        if (this.currentStep < this.totalSteps) {
            this.currentStep++;
            this.updateContent();
        }
    },

    onAcceptRules() {
        const checkbox = document.getElementById('accept-rules');
        const nextBtn = document.getElementById('rules-next-btn');
        if (nextBtn) {
            nextBtn.disabled = !checkbox.checked;
        }
    },

    async applyReferral() {
        const input = document.getElementById('referral-input');
        const code = input.value.trim().toUpperCase();

        if (code) {
            this.referralCode = code;
            // Тут можна додати перевірку коду через API
        }

        await this.completeRegistration();
    },

    async skipReferral() {
        await this.completeRegistration();
    },

    async completeRegistration() {
    try {
        // Показуємо індикатор завантаження
        const content = document.getElementById('registration-content');
        content.innerHTML = `
            <div class="success-icon">⏳</div>
            <h1 class="registration-title">${this.t('loading')}</h1>
        `;

        // Отримуємо токен
        const token = this.app.storage.get('auth_token');
        if (!token) {
            throw new Error('No auth token found');
        }

        // Відправляємо запит з токеном
        const response = await fetch('http://localhost:8001/api/auth/complete-onboarding', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                language: this.lang,
                referral_code: this.referralCode
            })
        });

        if (response.ok) {
            const data = await response.json();

            // Оновлюємо користувача в storage
            const user = this.app.storage.get('user');
            if (user) {
                user.is_onboarded = true;
                user.bonus_balance = data.bonus_balance || 0;
                this.app.storage.set('user', user);
            }

            // Показуємо успіх
            this.currentStep = 5;
            this.updateContent();

            // Закриваємо модалку через 2 секунди
            setTimeout(() => {
                const modal = document.getElementById('registration-modal');
                if (modal) {
                    modal.style.animation = 'slideOut 0.3s ease forwards';
                    setTimeout(() => {
                        modal.remove();
                        // Оновлюємо інтерфейс
                        if (this.app.currentPage === 'home' && window.HomeModule) {
                            window.HomeModule.init(this.app);
                        }
                    }, 300);
                }
            }, 2000);
        } else {
            const error = await response.text();
            throw new Error(error || 'Registration failed');
        }
    } catch (error) {
        console.error('Registration error:', error);

        // Показуємо помилку
        const content = document.getElementById('registration-content');
        content.innerHTML = `
            <div class="success-icon">❌</div>
            <h1 class="registration-title">${this.t('error')}</h1>
            <p class="registration-text">${error.message}</p>
            <button class="registration-btn registration-btn-primary"
                    onclick="window.RegistrationModule.currentStep = 4; window.RegistrationModule.updateContent();">
                Спробувати ще раз
            </button>
        `;
    }
};

// Додаємо анімацію виходу
const style = document.createElement('style');
style.textContent = `
    @keyframes slideOut {
        from { transform: translateY(0); }
        to { transform: translateY(100%); }
    }
`;
document.head.appendChild(style);