// Модуль підписки
window.SubscriptionModule = {
    currentStatus: null,

    // Отримати статус підписки
    async getStatus(app) {
        try {
            const status = await app.api.get('/api/subscriptions/status');
            this.currentStatus = status;
            return status;
        } catch (error) {
            console.error('Error getting subscription status:', error);
            return { has_subscription: false };
        }
    },

    // Рендер блоку підписки для головної сторінки
    async renderSubscriptionBlock(app) {
        const status = await this.getStatus(app);
        const t = (key) => app.t(key);

        if (status.has_subscription) {
            // Якщо є активна підписка
            return `
                <div class="subscription-block" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 16px; padding: 20px; margin-bottom: 20px; color: white;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                        <h3 style="margin: 0; font-size: 20px;">
                            ✨ ${t('subscription.active')}
                        </h3>
                        <span style="background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px; font-size: 14px;">
                            ${status.plan === 'yearly' ? t('subscription.yearly') : t('subscription.monthly')}
                        </span>
                    </div>

                    <div style="margin-bottom: 15px;">
                        <div style="font-size: 14px; opacity: 0.9; margin-bottom: 5px;">
                            ${t('subscription.validUntil')}: ${new Date(status.end_date).toLocaleDateString('uk-UA')}
                        </div>
                        <div style="font-size: 14px; opacity: 0.9;">
                            ${t('subscription.daysLeft')}: <strong>${status.days_left}</strong>
                        </div>
                    </div>

                    <div style="display: flex; gap: 10px;">
                        <button onclick="SubscriptionModule.showArchives()"
                                style="flex: 1; padding: 12px; background: white; color: var(--primary-color); border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
                            📚 ${t('subscription.myArchives')} (${status.unlocked_archives})
                        </button>
                        ${status.auto_renew ? `
                            <button onclick="SubscriptionModule.cancelAutoRenew()"
                                    style="padding: 12px 20px; background: rgba(255,255,255,0.2); color: white; border: 1px solid white; border-radius: 8px; cursor: pointer;">
                                🔄 ${t('subscription.cancelAuto')}
                            </button>
                        ` : ''}
                    </div>

                    ${status.show_reminder ? `
                        <div style="margin-top: 15px; padding: 10px; background: rgba(255,255,255,0.1); border-radius: 8px; border: 1px solid rgba(255,255,255,0.3);">
                            ⚠️ ${t('subscription.expiringWarning')}
                        </div>
                    ` : ''}
                </div>
            `;
        } else {
            // Якщо немає підписки - показуємо промо
            return `
                <div class="subscription-promo" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 16px; padding: 25px; margin-bottom: 20px; color: white; position: relative; overflow: hidden;">
                    <!-- Фоновий патерн -->
                    <div style="position: absolute; top: -50px; right: -50px; width: 200px; height: 200px; background: rgba(255,255,255,0.1); border-radius: 50%;"></div>
                    <div style="position: absolute; bottom: -30px; left: -30px; width: 150px; height: 150px; background: rgba(255,255,255,0.05); border-radius: 50%;"></div>

                    <div style="position: relative; z-index: 1;">
                        <div style="text-align: center; margin-bottom: 20px;">
                            <h2 style="margin: 0 0 10px; font-size: 24px; text-shadow: 0 2px 4px rgba(0,0,0,0.2);">
                                🌟 PREMIUM ПІДПИСКА
                            </h2>
                            <p style="margin: 0 0 5px; font-size: 16px; opacity: 0.95;">
                                ${t('subscription.promoText')}
                            </p>
                            <p style="margin: 0; font-size: 14px; opacity: 0.9;">
                                ${t('subscription.newArchivesWeekly')}
                            </p>
                        </div>

                        <!-- Переваги -->
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px;">
                            <div style="display: flex; align-items: center; gap: 8px; font-size: 14px;">
                                <span>✅</span> ${t('subscription.benefit1')}
                            </div>
                            <div style="display: flex; align-items: center; gap: 8px; font-size: 14px;">
                                <span>✅</span> ${t('subscription.benefit2')}
                            </div>
                            <div style="display: flex; align-items: center; gap: 8px; font-size: 14px;">
                                <span>✅</span> ${t('subscription.benefit3')}
                            </div>
                            <div style="display: flex; align-items: center; gap: 8px; font-size: 14px;">
                                <span>✅</span> ${t('subscription.benefit4')}
                            </div>
                        </div>

                        <!-- Ціни -->
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px;">
                            <button onclick="SubscriptionModule.showPurchaseModal('monthly')"
                                    style="padding: 15px; background: white; color: var(--primary-color); border: none; border-radius: 10px; cursor: pointer; transition: transform 0.2s;"
                                    onmouseover="this.style.transform='scale(1.05)'"
                                    onmouseout="this.style.transform='scale(1)'">
                                <div style="font-size: 20px; font-weight: bold;">$5</div>
                                <div style="font-size: 12px; opacity: 0.8;">${t('subscription.perMonth')}</div>
                            </button>

                            <button onclick="SubscriptionModule.showPurchaseModal('yearly')"
                                    style="padding: 15px; background: rgba(255,255,255,0.15); color: white; border: 2px solid white; border-radius: 10px; cursor: pointer; position: relative; transition: all 0.2s;"
                                    onmouseover="this.style.background='rgba(255,255,255,0.25)'"
                                    onmouseout="this.style.background='rgba(255,255,255,0.15)'">
                                <div style="position: absolute; top: -10px; right: -10px; background: #ff4757; color: white; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: bold;">
                                    -17%
                                </div>
                                <div style="font-size: 20px; font-weight: bold;">$50</div>
                                <div style="font-size: 12px; opacity: 0.9;">${t('subscription.perYear')}</div>
                                <div style="font-size: 10px; opacity: 0.8; text-decoration: line-through;">$60</div>
                            </button>
                        </div>

                        <!-- Оплата бонусами -->
                        <div style="text-align: center; padding: 10px; background: rgba(255,255,255,0.1); border-radius: 8px;">
                            <div style="font-size: 14px; margin-bottom: 5px;">
                                💎 ${t('subscription.orPayWithBonuses')}
                            </div>
                            <div style="font-size: 12px; opacity: 0.9;">
                                ${t('subscription.monthly')}: 500 ${t('bonuses')} | ${t('subscription.yearly')}: 5000 ${t('bonuses')}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
    },

    // Показати модальне вікно покупки
    showPurchaseModal(plan) {
        const app = window.app;
        const t = (key) => app.t(key);

        const price = plan === 'yearly' ? 50 : 5;
        const totalInBonuses = price * 100;
        const maxBonusesAllowed = Math.floor(totalInBonuses * 0.7); // Максимум 70%
        const minCashRequired = price * 0.3; // Мінімум 30% готівкою
        const userBonuses = app.user.bonuses || 0;
        const canPayWithBonuses = userBonuses >= maxBonusesAllowed;

        const modalHtml = `
            <div id="subscription-modal" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 20px;">
                <div style="background: var(--tg-theme-bg-color); border-radius: 16px; max-width: 400px; width: 100%; max-height: 90vh; overflow-y: auto;">
                    <div style="padding: 20px; border-bottom: 1px solid var(--tg-theme-secondary-bg-color);">
                        <h3 style="margin: 0; display: flex; justify-content: space-between; align-items: center;">
                            ${t('subscription.purchase')} - ${plan === 'yearly' ? t('subscription.yearly') : t('subscription.monthly')}
                            <button onclick="SubscriptionModule.closeModal()"
                                    style="background: none; border: none; font-size: 24px; cursor: pointer; color: var(--tg-theme-hint-color);">
                                ×
                            </button>
                        </h3>
                    </div>

                    <div style="padding: 20px;">
                        <!-- План підписки -->
                        <div style="background: linear-gradient(135deg, #667eea20, #764ba220); border-radius: 12px; padding: 15px; margin-bottom: 20px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                                <span style="font-size: 18px; font-weight: 600;">
                                    📅 ${plan === 'yearly' ? '12 ' + t('subscription.months') : '1 ' + t('subscription.month')}
                                </span>
                                <span style="font-size: 24px; font-weight: bold; color: var(--primary-color);">
                                    $${price}
                                </span>
                            </div>
                            ${plan === 'yearly' ? `
                                <div style="color: #27ae60; font-size: 14px;">
                                    💰 ${t('subscription.saveYearly')}
                                </div>
                            ` : ''}
                        </div>

                        <!-- ВАЖЛИВЕ ПОПЕРЕДЖЕННЯ -->
                        <div style="padding: 12px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; margin-bottom: 20px;">
                            <div style="color: #856404; font-size: 14px; font-weight: bold; margin-bottom: 5px;">
                                ⚠️ ${t('subscription.bonusLimitTitle')}
                            </div>
                            <div style="color: #856404; font-size: 13px; line-height: 1.5;">
                                • ${t('subscription.maxBonusPercent')}<br>
                                • ${t('subscription.forThisPlan')}: ${maxBonusesAllowed} ${t('bonuses')}<br>
                                • ${t('subscription.restInCrypto')}: $${minCashRequired.toFixed(2)}
                            </div>
                        </div>

                        <!-- Способи оплати -->
                        <h4 style="margin: 0 0 15px; font-size: 16px;">
                            ${t('subscription.paymentMethod')}
                        </h4>

                        <!-- Комбінована оплата (70% бонуси + 30% крипта) -->
                        ${canPayWithBonuses ? `
                            <button onclick="SubscriptionModule.purchaseWithMixed('${plan}')"
                                    style="width: 100%; padding: 15px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 10px; margin-bottom: 10px; cursor: pointer; position: relative;">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <span>
                                        💎 ${maxBonusesAllowed} + 💳 $${minCashRequired.toFixed(2)}
                                    </span>
                                </div>
                                <div style="font-size: 12px; margin-top: 5px; opacity: 0.9;">
                                    ${t('subscription.combinedPayment')}
                                </div>
                            </button>
                        ` : `
                            <button disabled
                                    style="width: 100%; padding: 15px; background: #ccc; color: white; border: none; border-radius: 10px; margin-bottom: 10px; cursor: not-allowed;">
                                <div>
                                    💎 ${t('subscription.notEnoughBonuses')}
                                </div>
                                <div style="font-size: 12px; margin-top: 5px;">
                                    ${t('subscription.need')}: ${maxBonusesAllowed}, ${t('subscription.have')}: ${userBonuses}
                                </div>
                            </button>
                        `}

                        <!-- Повна оплата криптою -->
                        <button onclick="SubscriptionModule.purchaseWithCrypto('${plan}')"
                                style="width: 100%; padding: 15px; background: #2c3e50; color: white; border: none; border-radius: 10px; margin-bottom: 10px; cursor: pointer;">
                            <div>🪙 ${t('subscription.payWithCrypto')}</div>
                            <div style="font-size: 14px; margin-top: 5px; opacity: 0.9;">
                                ${t('subscription.fullAmount')}: $${price}
                            </div>
                        </button>

                        <!-- Переваги підписки -->
                        <div style="padding: 15px; background: #f0f8ff; border-radius: 10px; margin-top: 20px;">
                            <div style="font-size: 14px; color: #2c3e50; line-height: 1.6;">
                                <div style="font-weight: bold; margin-bottom: 8px;">
                                    ✨ ${t('subscription.benefits')}:
                                </div>
                                • ${t('subscription.benefit1')}<br>
                                • ${t('subscription.benefit2')}<br>
                                • ${t('subscription.benefit3')}<br>
                                ${plan === 'yearly' ? `• ${t('subscription.benefit4')}` : ''}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
    },

    // Закрити модальне вікно
    closeModal() {
        const modal = document.getElementById('subscription-modal');
        if (modal) modal.remove();
    },
    // Комбінована оплата (70% бонуси + 30% крипта)
    async purchaseWithMixed(plan) {
        const app = window.app;
        const t = (key) => app.t(key);
        const price = plan === 'yearly' ? 50 : 5;
        const maxBonuses = Math.floor(price * 100 * 0.7);
        const remainingUsd = price * 0.3;

        try {
            // Створюємо підписку з частковою оплатою бонусами
            const response = await app.api.post('/api/subscriptions/create', {
                plan: plan,
                payment_method: 'mixed',
                bonuses_amount: maxBonuses,
                auto_renew: false
            });

            if (response.payment_required) {
                // Показуємо повідомлення
                app.tg.showAlert(
                    t('subscription.bonusesDeducted', {
                        bonuses: maxBonuses,
                        remaining: remainingUsd.toFixed(2)
                    })
                );

                // Закриваємо модальне вікно
                this.closeModal();

                // Переходимо до оплати решти через Cryptomus
                if (!window.PaymentModule) {
                    await app.loadScript('js/modules/payment.js');
                }

                await window.PaymentModule.createPayment('subscription', {
                    subscription_id: response.subscription_id,
                    amount: remainingUsd,
                    plan: plan,
                    method: 'cryptomus'
                }, app);
            }
        } catch (error) {
            app.tg.showAlert(`❌ ${t('errors.purchaseFailed')}: ${error.message}`);
        }
    },

    // Повна оплата криптою
    async purchaseWithCrypto(plan) {
        const app = window.app;
        const t = (key) => app.t(key);

        this.closeModal();

        // Створюємо платіж
        if (!window.PaymentModule) {
            await app.loadScript('js/modules/payment.js');
        }

        await window.PaymentModule.createPayment('subscription', {
            plan: plan,
            method: 'cryptomus'
        }, app);
    },

   // Показати архіви користувача
   async showArchives() {
       const app = window.app;
       const t = (key) => app.t(key);

       try {
           const data = await app.api.get('/api/subscriptions/available-archives');

           const content = document.getElementById('app-content');
           content.innerHTML = `
               <div class="subscription-archives p-3">
                   <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                       <h2>${t('subscription.myArchives')}</h2>
                       <button onclick="window.app.loadPage('home')"
                               style="padding: 8px 16px; background: var(--tg-theme-secondary-bg-color); border: none; border-radius: 6px; cursor: pointer;">
                           ← ${t('buttons.back')}
                       </button>
                   </div>

                   ${data.has_subscription ? `
                       <div style="background: #f0f8ff; border-radius: 12px; padding: 15px; margin-bottom: 20px;">
                           <div style="display: flex; justify-content: space-between; align-items: center;">
                               <div>
                                   <div style="font-size: 14px; color: var(--tg-theme-hint-color); margin-bottom: 5px;">
                                       ${t('subscription.activeUntil')}
                                   </div>
                                   <div style="font-weight: 600;">
                                       ${new Date(data.subscription_end).toLocaleDateString('uk-UA')}
                                   </div>
                               </div>
                               <div style="text-align: right;">
                                   <div style="font-size: 24px; font-weight: bold; color: var(--primary-color);">
                                       ${data.unlocked_count}/${data.total_archives}
                                   </div>
                                   <div style="font-size: 12px; color: var(--tg-theme-hint-color);">
                                       ${t('subscription.archivesUnlocked')}
                                   </div>
                               </div>
                           </div>
                       </div>

                       <div class="archives-grid" style="display: grid; gap: 15px;">
                           ${data.archives.map(archive => this.renderArchiveCard(archive, app)).join('')}
                       </div>
                   ` : `
                       <div style="text-align: center; padding: 50px;">
                           <h3>${t('subscription.noActiveSubscription')}</h3>
                           <button onclick="window.app.loadPage('home')"
                                   style="margin-top: 20px; padding: 12px 24px; background: var(--primary-color); color: white; border: none; border-radius: 8px; cursor: pointer;">
                               ${t('subscription.getSubscription')}
                           </button>
                       </div>
                   `}
               </div>
           `;
       } catch (error) {
           app.tg.showAlert(`❌ ${t('errors.loadingArchives')}: ${error.message}`);
       }
   },

   // Рендер картки архіву
   renderArchiveCard(archive, app) {
       const t = (key) => app.t(key);
       const lang = app.currentLang || 'ua';
       const title = archive.title[lang] || archive.title['en'] || archive.title['ua'];
       const description = archive.description[lang] || archive.description['en'] || '';

       return `
           <div style="background: var(--tg-theme-bg-color); border: 1px solid var(--tg-theme-secondary-bg-color); border-radius: 12px; padding: 15px;">
               <div style="display: flex; justify-content: space-between; align-items: start;">
                   <div style="flex: 1;">
                       <h4 style="margin: 0 0 5px; display: flex; align-items: center; gap: 10px;">
                           ${archive.is_unlocked ? '🔓' : '🔒'} ${title}
                       </h4>
                       <div style="font-size: 12px; color: var(--tg-theme-hint-color); margin-bottom: 10px;">
                           ${archive.code} • ${new Date(archive.created_at).toLocaleDateString('uk-UA')}
                       </div>
                       ${description ? `
                           <p style="font-size: 14px; color: var(--tg-theme-text-color); margin: 10px 0;">
                               ${description}
                           </p>
                       ` : ''}
                       ${archive.from_previous_subscription ? `
                           <div style="font-size: 12px; color: #27ae60; margin-top: 10px;">
                               ✅ ${t('subscription.fromPreviousSub')}
                           </div>
                       ` : ''}
                   </div>
                   <div>
                       ${archive.is_unlocked ? `
                           <button onclick="SubscriptionModule.downloadArchive(${archive.id})"
                                   style="padding: 8px 16px; background: var(--primary-color); color: white; border: none; border-radius: 6px; cursor: pointer;">
                               📥 ${t('buttons.download')}
                           </button>
                       ` : archive.can_unlock ? `
                           <button onclick="SubscriptionModule.unlockArchive(${archive.id})"
                                   style="padding: 8px 16px; background: #27ae60; color: white; border: none; border-radius: 6px; cursor: pointer;">
                               🔓 ${t('buttons.unlock')}
                           </button>
                       ` : `
                           <button disabled
                                   style="padding: 8px 16px; background: #ccc; color: white; border: none; border-radius: 6px; cursor: not-allowed;">
                               🔒 ${t('subscription.notAvailable')}
                           </button>
                       `}
                   </div>
               </div>
           </div>
       `;
   },

   // Розблокувати архів
   async unlockArchive(archiveId) {
       const app = window.app;

       try {
           const response = await app.api.post(`/api/subscriptions/unlock-archive/${archiveId}`);

           if (response.success) {
               app.tg.showAlert(`✅ ${app.t('subscription.archiveUnlocked')}: ${response.archive.title[app.currentLang || 'ua']}`);
               await this.showArchives();
           }
       } catch (error) {
           app.tg.showAlert(`❌ ${error.message}`);
       }
   },

   // Завантажити архів
   async downloadArchive(archiveId) {
       const app = window.app;

       // Тут буде логіка завантаження файлу
       app.tg.showAlert(`📥 ${app.t('subscription.downloadStarted')}`);

       // Відкриваємо посилання на завантаження
       window.open(`/api/archives/download/${archiveId}`, '_blank');
   },

   // Скасувати автопродовження
   async cancelAutoRenew() {
       const app = window.app;

       if (confirm(app.t('subscription.confirmCancel'))) {
           try {
               const response = await app.api.post('/api/subscriptions/cancel');

               if (response.success) {
                   app.tg.showAlert(`✅ ${app.t('subscription.autoRenewCancelled')}`);
                   await app.loadPage('home');
               }
           } catch (error) {
               app.tg.showAlert(`❌ ${error.message}`);
           }
       }
   }
};