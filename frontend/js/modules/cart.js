// frontend/js/modules/cart.js
// Модуль кошика з валідацією бонусів та мультимовністю

window.CartModule = {
    app: null,
    checkoutData: null,

    // Ініціалізація модуля
    init(app) {
        this.app = app;
        return this;
    },

    // Отримати сторінку кошика
    getPage() {
        const app = this.app;
        const t = (key) => app.t(key);

        if (app.cart.length === 0) {
            return this.getEmptyCartPage();
        }

        const subtotal = app.cart.reduce((sum, item) => sum + (item.finalPrice * item.quantity), 0);

        // Генеруємо HTML для товарів
        const itemsHtml = app.cart.map(item => this.getCartItemHtml(item)).join('');

        return `
            <div class="cart-page p-3">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2>${t('cart.title')}</h2>
                    <span style="color: var(--tg-theme-hint-color);">
                        ${app.cart.length} ${t('cart.items')}
                    </span>
                </div>

                <div class="cart-items" style="margin-bottom: 20px;">
                    ${itemsHtml}
                </div>

                <!-- Промокод -->
                <div style="background: var(--tg-theme-bg-color); border: 1px solid var(--tg-theme-secondary-bg-color); border-radius: 12px; padding: 15px; margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 500;">
                        ${t('cart.promoCode')}
                    </label>
                    <div style="display: flex; gap: 10px;">
                        <input type="text"
                               id="promo-input"
                               placeholder="${t('cart.promoPlaceholder')}"
                               style="flex: 1; padding: 10px; border: 1px solid var(--tg-theme-secondary-bg-color); border-radius: 8px; background: var(--tg-theme-bg-color);">
                        <button onclick="CartModule.applyPromoCode()"
                                style="padding: 10px 20px; background: var(--primary-color); color: white; border: none; border-radius: 8px; cursor: pointer;">
                            ${t('buttons.apply')}
                        </button>
                    </div>
                    <div id="promo-message" style="margin-top: 8px; font-size: 14px;"></div>
                </div>

                <!-- Підсумок -->
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 20px; color: white;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                        <span>${t('cart.subtotal')}:</span>
                        <span style="font-weight: bold;">$${subtotal.toFixed(2)}</span>
                    </div>

                    <div id="discount-row" style="display: none;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                            <span>${t('cart.discount')}:</span>
                            <span id="discount-amount" style="font-weight: bold;">-$0</span>
                        </div>
                    </div>

                    <div style="border-top: 1px solid rgba(255,255,255,0.3); padding-top: 10px; margin-top: 10px;">
                        <div style="display: flex; justify-content: space-between; font-size: 20px; font-weight: bold;">
                            <span>${t('cart.total')}:</span>
                            <span id="total-amount">$${subtotal.toFixed(2)}</span>
                        </div>
                    </div>

                    <button onclick="CartModule.showCheckoutModal()"
                            style="width: 100%; padding: 15px; background: white; color: var(--primary-color); border: none; border-radius: 10px; font-size: 16px; font-weight: bold; margin-top: 20px; cursor: pointer;">
                        ${t('cart.proceedToCheckout')}
                    </button>
                </div>
            </div>
        `;
    },

    // Порожній кошик
    getEmptyCartPage() {
        const t = (key) => this.app.t(key);

        return `
            <div class="cart-page p-3" style="text-align: center; padding: 50px 20px;">
                <div style="font-size: 80px; margin-bottom: 20px;">🛒</div>
                <h3 style="margin-bottom: 10px;">${t('cart.empty')}</h3>
                <p style="color: var(--tg-theme-hint-color); margin-bottom: 30px;">
                    ${t('cart.emptyDescription')}
                </p>
                <button onclick="window.app.loadPage('catalog')"
                        style="padding: 12px 30px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 10px; font-size: 16px; cursor: pointer;">
                    ${t('cart.goToCatalog')}
                </button>
            </div>
        `;
    },

    // HTML для товару в кошику
    getCartItemHtml(item) {
        const t = (key) => this.app.t(key);
        const lang = this.app.currentLang || 'ua';
        const title = item.title?.[lang] || item.title?.en || item.title || 'No title';

        return `
            <div class="cart-item" style="background: var(--tg-theme-bg-color); border: 1px solid var(--tg-theme-secondary-bg-color); border-radius: 12px; padding: 15px; margin-bottom: 10px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="flex: 1;">
                        <div style="font-weight: bold; margin-bottom: 5px;">${title}</div>
                        <div style="color: var(--tg-theme-hint-color); font-size: 14px;">
                            ${item.code || ''}
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-weight: bold; color: var(--primary-color);">
                            $${item.finalPrice.toFixed(2)}
                        </div>
                        <button onclick="CartModule.removeFromCart(${item.id})"
                                style="margin-top: 5px; padding: 5px 10px; background: #dc3545; color: white; border: none; border-radius: 6px; font-size: 12px; cursor: pointer;">
                            ${t('buttons.delete')}
                        </button>
                    </div>
                </div>
            </div>
        `;
    },

    // Видалити з кошика
    removeFromCart(productId) {
        // Використовуємо app з window, бо це onclick handler
        const app = window.app;
        app.removeFromCart(productId);
        app.loadPage('cart'); // Перезавантажуємо сторінку корзини
    },

    // Застосувати промокод
    async applyPromoCode() {
        const app = this.app;
        const t = (key) => app.t(key);
        const code = document.getElementById('promo-input').value;
        const subtotal = app.cart.reduce((sum, item) => sum + (item.finalPrice * item.quantity), 0);
        const promoMessage = document.getElementById('promo-message');

        if (!code.trim()) {
            promoMessage.style.color = '#dc3545';
            promoMessage.textContent = t('cart.enterPromoCode');
            return;
        }

        try {
            const response = await app.api.post('/api/orders/apply-promo', {
                code: code.trim(),
                subtotal
            });

            if (response.success) {
                promoMessage.style.color = '#28a745';
                promoMessage.textContent = response.message;
                document.getElementById('discount-amount').textContent = `-$${response.discount_amount.toFixed(2)}`;
                document.getElementById('discount-row').style.display = 'block';
                document.getElementById('total-amount').textContent = `$${response.final_total.toFixed(2)}`;
                app.promoCode = code.trim();
            }
        } catch (error) {
            promoMessage.style.color = '#dc3545';
            promoMessage.textContent = error.message || t('cart.invalidPromoCode');
            document.getElementById('discount-row').style.display = 'none';
            document.getElementById('total-amount').textContent = `$${subtotal.toFixed(2)}`;
            app.promoCode = null;
        }
    },

    // Розрахувати максимум бонусів (70%)
    calculateMaxBonuses(subtotal) {
        const BONUS_CAP = 0.7;  // 70%
        const BONUSES_PER_USD = 100;

        const totalInBonuses = Math.floor(subtotal * BONUSES_PER_USD);
        const maxAllowed = Math.floor(totalInBonuses * BONUS_CAP);

        return {
            total: totalInBonuses,
            maxAllowed: maxAllowed,
            minCash: subtotal * (1 - BONUS_CAP)
        };
    },

    // Показати модальне вікно оформлення
    showCheckoutModal() {
        const app = this.app;
        const t = (key) => app.t(key);
        const cart = app.cart || [];

        if (cart.length === 0) {
            app.tg.showAlert(t('cart.emptyError'));
            return;
        }

        // Рахуємо суми
        const subtotal = cart.reduce((sum, item) => sum + (item.finalPrice * item.quantity), 0);
        const userBonuses = app.user.bonuses || 0;

        // ВАЖЛИВО: Максимум 70% бонусами
        const bonusLimits = this.calculateMaxBonuses(subtotal);
        const maxBonusesCanUse = Math.min(bonusLimits.maxAllowed, userBonuses);

        const modalHtml = `
            <div id="checkout-modal" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 20px;">
                <div style="background: var(--tg-theme-bg-color); border-radius: 16px; max-width: 400px; width: 100%; max-height: 90vh; overflow-y: auto;">
                    <div style="padding: 20px; border-bottom: 1px solid var(--tg-theme-secondary-bg-color);">
                        <h3 style="margin: 0; display: flex; justify-content: space-between; align-items: center;">
                            ${t('checkout.title')}
                            <button onclick="CartModule.closeCheckoutModal()"
                                    style="background: none; border: none; font-size: 24px; cursor: pointer; color: var(--tg-theme-hint-color);">
                                ×
                            </button>
                        </h3>
                    </div>

                    <div style="padding: 20px;">
                        <!-- Сума замовлення -->
                        <div style="background: var(--tg-theme-secondary-bg-color); border-radius: 12px; padding: 15px; margin-bottom: 20px;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                                <span>${t('checkout.orderAmount')}:</span>
                                <span style="font-weight: bold; font-size: 18px;">$${subtotal.toFixed(2)}</span>
                            </div>

                            <!-- Попередження про обмеження -->
                            <div style="padding: 10px; background: #fff3cd; border-radius: 8px; margin-top: 10px;">
                                <div style="color: #856404; font-size: 14px; margin-bottom: 5px;">
                                    ⚠️ ${t('checkout.bonusLimit')}
                                </div>
                                <div style="color: #856404; font-size: 13px;">
                                    • ${t('checkout.maxBonuses')}: ${bonusLimits.maxAllowed}<br>
                                    • ${t('checkout.minCash')}: $${bonusLimits.minCash.toFixed(2)}
                                </div>
                            </div>
                        </div>

                        <!-- Промокод (якщо застосований) -->
                        ${app.promoCode ? `
                            <div style="background: #d4edda; border: 1px solid #c3e6cb; border-radius: 8px; padding: 10px; margin-bottom: 15px;">
                                <div style="color: #155724; font-size: 14px;">
                                    ✅ ${t('checkout.promoApplied')}: <strong>${app.promoCode}</strong>
                                </div>
                            </div>
                        ` : ''}

                        <!-- Слайдер бонусів -->
                        <div style="margin-bottom: 20px;">
                            <label style="display: block; margin-bottom: 10px; font-weight: 500;">
                                ${t('checkout.useBonuses')}:
                            </label>

                            <div style="display: flex; align-items: center; gap: 15px;">
                                <input type="range"
                                       id="bonus-slider"
                                       min="0"
                                       max="${maxBonusesCanUse}"
                                       value="0"
                                       style="flex: 1;"
                                       oninput="CartModule.updateBonusAmount()">
                                <span id="bonus-amount" style="min-width: 80px; text-align: right; font-weight: bold; color: var(--primary-color);">
                                    0
                                </span>
                            </div>

                            <div style="display: flex; justify-content: space-between; font-size: 12px; color: var(--tg-theme-hint-color); margin-top: 8px;">
                                <span>${t('checkout.yourBalance')}: ${userBonuses}</span>
                                <span>${t('checkout.max')}: ${bonusLimits.maxAllowed}</span>
                            </div>
                        </div>

                        <!-- Підсумок оплати -->
                        <div id="checkout-summary" style="background: linear-gradient(135deg, #667eea20, #764ba220); border-radius: 12px; padding: 15px; margin-bottom: 20px;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                                <span>${t('checkout.subtotal')}:</span>
                                <span>$${subtotal.toFixed(2)}</span>
                            </div>

                            <div id="checkout-discount-row" style="display: ${app.promoCode ? 'flex' : 'none'}; justify-content: space-between; margin-bottom: 8px; color: #28a745;">
                                <span>${t('checkout.discount')}:</span>
                                <span id="checkout-discount-amount">-$0</span>
                            </div>

                            <div id="checkout-bonus-row" style="display: none; justify-content: space-between; margin-bottom: 8px; color: #6f42c1;">
                                <span>${t('checkout.bonusesUsed')}:</span>
                                <span id="checkout-bonus-discount">-$0</span>
                            </div>

                            <div style="border-top: 1px solid var(--tg-theme-secondary-bg-color); padding-top: 10px; margin-top: 10px;">
                                <div style="display: flex; justify-content: space-between; font-size: 20px; font-weight: bold;">
                                    <span>${t('checkout.toPay')}:</span>
                                    <span id="final-total" style="color: var(--primary-color);">$${subtotal.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>

                        <!-- Кнопки -->
                        <button onclick="CartModule.processCheckout()"
                                id="checkout-btn"
                                style="width: 100%; padding: 15px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 10px; font-size: 16px; font-weight: bold; cursor: pointer; margin-bottom: 10px;">
                            ${t('checkout.confirmOrder')}
                        </button>

                        <button onclick="CartModule.closeCheckoutModal()"
                                style="width: 100%; padding: 15px; background: var(--tg-theme-secondary-bg-color); color: var(--tg-theme-text-color); border: none; border-radius: 10px; cursor: pointer;">
                            ${t('buttons.cancel')}
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Зберігаємо дані
        this.checkoutData = {
            subtotal: subtotal,
            discount: 0,
            bonusesUsed: 0,
            maxBonuses: bonusLimits.maxAllowed,
            total: subtotal
        };

        // Оновлюємо якщо є промокод
        if (app.promoCode) {
            this.applyPromoToCheckout();
        }
    },

    // Оновити суму при зміні бонусів
    updateBonusAmount() {
        const t = (key) => this.app.t(key);
        const slider = document.getElementById('bonus-slider');
        const amountSpan = document.getElementById('bonus-amount');
        const bonusesUsed = parseInt(slider.value);

        amountSpan.textContent = bonusesUsed;
        this.checkoutData.bonusesUsed = bonusesUsed;

        this.updateCheckoutSummary();
    },

    // Оновити підсумок
    updateCheckoutSummary() {
        const data = this.checkoutData;
        const bonusDiscount = data.bonusesUsed / 100; // 100 бонусів = $1
        const total = Math.max(0, data.subtotal - data.discount - bonusDiscount);

        // Оновлюємо відображення
        const bonusRow = document.getElementById('checkout-bonus-row');
        const bonusDiscountEl = document.getElementById('checkout-bonus-discount');
        const finalTotalEl = document.getElementById('final-total');

        if (bonusRow && data.bonusesUsed > 0) {
            bonusRow.style.display = 'flex';
            bonusDiscountEl.textContent = `-$${bonusDiscount.toFixed(2)}`;
        } else if (bonusRow) {
            bonusRow.style.display = 'none';
        }

        if (finalTotalEl) {
            finalTotalEl.textContent = `$${total.toFixed(2)}`;
        }

        data.total = total;
    },

    // Обробити замовлення
    async processCheckout() {
        const app = this.app;
        const t = (key) => app.t(key);
        const data = this.checkoutData;

        const btn = document.getElementById('checkout-btn');
        btn.disabled = true;
        btn.textContent = t('checkout.processing');

        try {
            const response = await app.api.post('/api/orders/create', {
                items: app.cart.map(item => ({ id: item.id })),
                promo_code: app.promoCode || null,
                bonuses: data.bonusesUsed
            });

            if (response.success) {
                // Якщо потрібна оплата
                if (response.payment_required) {
                    this.closeCheckoutModal();

                    // Завантажуємо модуль платежів
                    if (!window.PaymentModule) {
                        await app.loadScript('js/modules/payment.js');
                    }

                    await window.PaymentModule.createPayment('order', {
                        order_id: response.order_id,
                        amount: response.total,
                        method: 'cryptomus'
                    }, app);
                } else {
                    // Повністю оплачено бонусами
                    app.tg.showAlert(t('checkout.orderSuccess', { orderId: response.order_id }));

                    // Очищаємо кошик
                    app.cart = [];
                    app.storage.set('cart', []);
                    app.promoCode = null;

                    // Оновлюємо баланс
                    app.user.bonuses -= data.bonusesUsed;

                    this.closeCheckoutModal();
                    await app.loadPage('downloads');
                }
            }
        } catch (error) {
            app.tg.showAlert(`❌ ${t('errors.orderFailed')}: ${error.message}`);
            btn.disabled = false;
            btn.textContent = t('checkout.confirmOrder');
        }
    },

    // Закрити модальне вікно
    closeCheckoutModal() {
        const modal = document.getElementById('checkout-modal');
        if (modal) modal.remove();
    },

    // Застосувати промокод до checkout
    async applyPromoToCheckout() {
        const app = this.app;
        const subtotal = this.checkoutData.subtotal;

        try {
            const response = await app.api.post('/api/orders/apply-promo', {
                code: app.promoCode,
                subtotal
            });

            if (response.success) {
                this.checkoutData.discount = response.discount_amount;
                document.getElementById('checkout-discount-amount').textContent = `-$${response.discount_amount.toFixed(2)}`;
                this.updateCheckoutSummary();
            }
        } catch (error) {
            console.error('Failed to apply promo in checkout:', error);
        }
    }
};