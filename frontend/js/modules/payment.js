// Модуль платежів
window.PaymentModule = {
    currentPayment: null,
    checkInterval: null,

    // Створити платіж
    async createPayment(type, data, app) {
        const t = (key) => app.t(key);

        try {
            const paymentData = {
                type: type, // order або subscription
                method: data.method || 'cryptomus',
                currency: data.currency || 'USD',
                ...data
            };

            const response = await app.api.post('/api/payments/create', paymentData);

            if (response.success) {
                this.currentPayment = response;

                // Показуємо модальне вікно оплати
                this.showPaymentModal(response, app);

                // Запускаємо перевірку статусу
                this.startStatusCheck(response.payment_id, app);

                return response;
            } else {
                throw new Error(response.error || 'Payment creation failed');
            }
        } catch (error) {
            app.tg.showAlert(`❌ ${t('payment.error')}: ${error.message}`);
            return null;
        }
    },

    // Показати модальне вікно оплати
    showPaymentModal(payment, app) {
        const t = (key) => app.t(key);

        const modalHtml = `
            <div id="payment-modal" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 20px;">
                <div style="background: white; border-radius: 20px; max-width: 400px; width: 100%; max-height: 90vh; overflow-y: auto;">
                    <!-- Заголовок -->
                    <div style="padding: 20px; border-bottom: 1px solid #eee;">
                        <h3 style="margin: 0; display: flex; justify-content: space-between; align-items: center;">
                            💳 ${t('payment.title')}
                            <button onclick="PaymentModule.closeModal()"
                                    style="background: none; border: none; font-size: 24px; cursor: pointer; color: #999;">
                                ×
                            </button>
                        </h3>
                    </div>

                    <!-- Контент -->
                    <div style="padding: 20px;">
                        <!-- Сума -->
                        <div style="text-align: center; margin-bottom: 25px;">
                            <div style="font-size: 14px; color: var(--tg-theme-hint-color); margin-bottom: 5px;">
                                ${t('payment.amount')}:
                            </div>
                            <div style="font-size: 36px; font-weight: bold; color: var(--primary-color);">
                                ${payment.currency} ${payment.amount}
                            </div>
                        </div>

                        <!-- QR код (заглушка) -->
                        <div style="text-align: center; margin-bottom: 20px;">
                            <div style="width: 200px; height: 200px; margin: 0 auto; background: #f5f5f5; border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                                <div style="text-align: center;">
                                    <div style="font-size: 48px; margin-bottom: 10px;">🪙</div>
                                    <div style="font-size: 14px; color: #666;">
                                        ${t('payment.scanQR')}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Кнопки оплати -->
                        ${window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? `
                            <!-- ТЕСТОВИЙ РЕЖИМ - симуляція оплати -->
                            <button onclick="PaymentModule.simulatePayment(true)"
                                    style="width: 100%; padding: 15px; background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); color: white; border: none; border-radius: 10px; font-size: 16px; font-weight: bold; margin-bottom: 10px; cursor: pointer;">
                                ✅ ТЕСТ: Успішна оплата
                            </button>
                            <button onclick="PaymentModule.simulatePayment(false)"
                                    style="width: 100%; padding: 15px; background: linear-gradient(135deg, #f44336 0%, #da190b 100%); color: white; border: none; border-radius: 10px; font-size: 16px; font-weight: bold; margin-bottom: 10px; cursor: pointer;">
                                ❌ ТЕСТ: Невдала оплата
                            </button>
                        ` : `
                            <!-- РЕАЛЬНА ОПЛАТА -->
                            <a href="${payment.payment_url}"
                               target="_blank"
                               style="display: block; width: 100%; padding: 15px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-align: center; text-decoration: none; border-radius: 10px; font-size: 16px; font-weight: bold; margin-bottom: 15px;">
                                🔗 ${t('payment.openPaymentPage')}
                            </a>
                        `}

                        <!-- Статус -->
                        <div id="payment-status" style="background: #f8f9fa; border-radius: 10px; padding: 15px; margin-bottom: 15px;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <div style="font-size: 12px; color: #666; margin-bottom: 5px;">
                                        ${t('payment.status')}:
                                    </div>
                                    <div id="status-text" style="font-weight: 600; color: #ff9800;">
                                        ⏳ ${t('payment.waiting')}
                                    </div>
                                </div>
                                <div class="spinner" style="width: 24px; height: 24px; border: 3px solid #f3f3f3; border-top: 3px solid #667eea; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                            </div>
                        </div>

                        <!-- Таймер -->
                        <div style="text-align: center; margin-bottom: 15px;">
                            <div style="font-size: 12px; color: #666;">
                                ${t('payment.expiresIn')}:
                            </div>
                            <div id="payment-timer" style="font-size: 20px; font-weight: bold; color: #333;">
                                60:00
                            </div>
                        </div>

                        <!-- Інструкції -->
                        <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 12px; margin-bottom: 15px;">
                            <div style="font-size: 14px; color: #856404;">
                                📌 ${t('payment.instructions')}
                            </div>
                        </div>

                        <!-- Підтримувані криптовалюти -->
                        <div style="margin-bottom: 15px;">
                            <div style="font-size: 12px; color: #666; margin-bottom: 10px;">
                                ${t('payment.supportedCrypto')}:
                            </div>
                            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                                ${this.getCryptoIcons()}
                            </div>
                        </div>

                        <!-- Кнопки -->
                        <div style="display: flex; gap: 10px;">
                            <button onclick="PaymentModule.checkStatus('${payment.payment_id}')"
                                    style="flex: 1; padding: 12px; background: #28a745; color: white; border: none; border-radius: 8px; cursor: pointer;">
                                🔄 ${t('payment.checkStatus')}
                            </button>
                            <button onclick="PaymentModule.cancelPayment()"
                                    style="flex: 1; padding: 12px; background: #dc3545; color: white; border: none; border-radius: 8px; cursor: pointer;">
                                ❌ ${t('buttons.cancel')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <style>
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Запускаємо таймер
        this.startTimer(payment.expires_at);
    },

    // Іконки криптовалют
    getCryptoIcons() {
        const cryptos = [
            { name: 'BTC', color: '#f7931a' },
            { name: 'ETH', color: '#627eea' },
            { name: 'USDT', color: '#26a17b' },
            { name: 'BNB', color: '#f3ba2f' },
            { name: 'SOL', color: '#00ffa3' },
            { name: 'TRX', color: '#ff0013' }
        ];

        return cryptos.map(crypto => `
            <div style="background: ${crypto.color}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">
                ${crypto.name}
            </div>
        `).join('');
    },

    // Таймер оплати
    startTimer(expiresAt) {
        const timerElement = document.getElementById('payment-timer');
        if (!timerElement) return;

        const updateTimer = () => {
            const now = new Date();
            const expires = new Date(expiresAt);
            const diff = expires - now;

            if (diff <= 0) {
                timerElement.textContent = '00:00';
                timerElement.style.color = '#dc3545';
                this.handleExpired();
                return;
            }

            const minutes = Math.floor(diff / 60000);
            const seconds = Math.floor((diff % 60000) / 1000);

            timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

            if (minutes < 5) {
                timerElement.style.color = '#dc3545';
            } else if (minutes < 10) {
                timerElement.style.color = '#ff9800';
            }
        };

        updateTimer();
        this.timerInterval = setInterval(updateTimer, 1000);
    },

    // Перевірка статусу
    startStatusCheck(paymentId, app) {
        // Перевіряємо кожні 5 секунд
        this.checkInterval = setInterval(async () => {
            await this.checkStatus(paymentId, app, true);
        }, 5000);
    },

    // Перевірити статус платежу
    async checkStatus(paymentId, app, silent = false) {
        if (!app) app = window.app;

        try {
            const response = await app.api.get(`/api/payments/status/${paymentId}`);

            // Оновлюємо UI
            const statusElement = document.getElementById('status-text');
            const spinnerElement = document.querySelector('.spinner');

            if (statusElement) {
                switch (response.status) {
                    case 'completed':
                        statusElement.innerHTML = '✅ ' + app.t('payment.completed');
                        statusElement.style.color = '#28a745';
                        if (spinnerElement) spinnerElement.style.display = 'none';

                        // Зупиняємо перевірку
                        this.stopChecking();

                        // Показуємо успіх
                        setTimeout(() => {
                            this.handleSuccess(response, app);
                        }, 1000);
                        break;

                    case 'failed':
                    case 'cancelled':
                        statusElement.innerHTML = '❌ ' + app.t('payment.failed');
                        statusElement.style.color = '#dc3545';
                        if (spinnerElement) spinnerElement.style.display = 'none';

                        this.stopChecking();
                        this.handleFailed(response, app);
                        break;

                    case 'pending':
                        if (response.address) {
                            statusElement.innerHTML = '⏳ ' + app.t('payment.waitingConfirmation');
                        }
                        break;
                }
            }

            return response;

        } catch (error) {
            console.error('Status check error:', error);
            if (!silent) {
                app.tg.showAlert(`❌ ${app.t('payment.statusCheckError')}`);
            }
        }
    },

    // Обробка успішної оплати
    handleSuccess(payment, app) {
        const t = (key) => app.t(key);

        // Закриваємо модальне вікно
        this.closeModal();

        // Показуємо повідомлення про успіх
        const successHtml = `
            <div id="payment-success" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.9); z-index: 10000; display: flex; align-items: center; justify-content: center;">
                <div style="background: white; border-radius: 20px; padding: 40px; text-align: center; max-width: 350px;">
                    <div style="font-size: 80px; margin-bottom: 20px;">🎉</div>
                    <h2 style="margin: 0 0 20px; color: #28a745;">
                        ${t('payment.successTitle')}
                    </h2>
                    <p style="margin: 0 0 30px; color: #666;">
                        ${t('payment.successMessage')}
                    </p>
                    <button onclick="PaymentModule.closeSuccess()"
                            style="padding: 15px 30px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 10px; font-size: 16px; font-weight: bold; cursor: pointer;">
                        ${t('buttons.continue')}
                    </button>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', successHtml);

        // Конфеті анімація
        this.showConfetti();

        // Оновлюємо сторінку через 3 секунди
        setTimeout(() => {
            this.closeSuccess();
            app.loadPage('home');
        }, 3000);
    },

    // Обробка невдалої оплати
    handleFailed(payment, app) {
        const t = (key) => app.t(key);

        this.closeModal();

        app.tg.showAlert(`❌ ${t('payment.failedMessage')}`);
    },

    // Обробка закінчення часу
    handleExpired() {
        const app = window.app;
        const t = (key) => app.t(key);

        this.stopChecking();

        const statusElement = document.getElementById('status-text');
        if (statusElement) {
            statusElement.innerHTML = '⏰ ' + t('payment.expired');
            statusElement.style.color = '#dc3545';
        }

        setTimeout(() => {
            this.closeModal();
            app.tg.showAlert(`⏰ ${t('payment.expiredMessage')}`);
        }, 2000);
    },

    // Конфеті анімація
    showConfetti() {
        const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#f0932b', '#eb4d4b', '#6ab04c'];
        const confettiCount = 30;

        for (let i = 0; i < confettiCount; i++) {
            setTimeout(() => {
                const confetti = document.createElement('div');
                confetti.style.cssText = `
                    position: fixed;
                    top: -10px;
                    left: ${Math.random() * 100}%;
                    width: ${Math.random() * 10 + 5}px;
                    height: ${Math.random() * 10 + 5}px;
                    background: ${colors[Math.floor(Math.random() * colors.length)]};
                    border-radius: ${Math.random() > 0.5 ? '50%' : '0'};
                    z-index: 10001;
                    animation: confettiFall 3s ease-out forwards;
                    transform: rotate(${Math.random() * 360}deg);
                `;
                document.body.appendChild(confetti);

                setTimeout(() => confetti.remove(), 3000);
            }, i * 30);
        }

        // Додаємо CSS анімацію якщо її ще немає
        if (!document.getElementById('confetti-animation')) {
            const style = document.createElement('style');
            style.id = 'confetti-animation';
            style.innerHTML = `
                @keyframes confettiFall {
                    to {
                        transform: translateY(100vh) rotate(720deg);
                        opacity: 0;
                    }
                }
            `;
            document.head.appendChild(style);
        }
    },

    // Зупинити перевірку
    stopChecking() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    },

    // Скасувати платіж
    cancelPayment() {
        const app = window.app;
        const t = (key) => app.t(key);

        if (confirm(t('payment.confirmCancel'))) {
            this.stopChecking();
            this.closeModal();
        }
    },

    // Закрити модальне вікно
    closeModal() {
        this.stopChecking();
        const modal = document.getElementById('payment-modal');
        if (modal) modal.remove();
    },

    // Закрити вікно успіху
    closeSuccess() {
        const success = document.getElementById('payment-success');
        if (success) success.remove();
    },

    // Симуляція оплати для тестування
    async simulatePayment(success) {
        const app = window.app;
        const t = (key) => app.t(key);

        if (!this.currentPayment) return;

        // Показуємо процес оплати
        const statusEl = document.getElementById('status-text');
        if (statusEl) {
            statusEl.innerHTML = '⏳ Симуляція оплати...';
            statusEl.style.color = '#ff9800';
        }

        // Затримка для реалістичності
        await new Promise(resolve => setTimeout(resolve, 2000));

        try {
            // Відправляємо на бекенд симуляцію
            const response = await app.api.post('/api/payments/simulate', {
                payment_id: this.currentPayment.payment_id,
                status: success ? 'completed' : 'failed'
            });

            if (response.success) {
                if (success) {
                    // Успішна оплата
                    if (statusEl) {
                        statusEl.innerHTML = '✅ ' + t('payment.completed');
                        statusEl.style.color = '#4CAF50';
                    }

                    await new Promise(resolve => setTimeout(resolve, 1500));

                    app.tg.showAlert(t('payment.successMessage'));

                    // Очищаємо кошик якщо це замовлення
                    if (this.currentPayment.type === 'order') {
                        app.cart = [];
                        app.storage.set('cart', []);
                        app.promoCode = null;
                    }

                    this.closeModal();

                    // Переходимо на сторінку завантажень
                    await app.loadPage('downloads');

                } else {
                    // Невдала оплата
                    if (statusEl) {
                        statusEl.innerHTML = '❌ ' + t('payment.failed');
                        statusEl.style.color = '#f44336';
                    }

                    app.tg.showAlert(t('payment.failedMessage'));
                }
            }
        } catch (error) {
            app.tg.showAlert(`❌ Помилка симуляції: ${error.message}`);
        }
    }
};