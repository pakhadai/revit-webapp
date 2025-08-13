// Модуль щоденних бонусів зі слот-машиною
window.DailyBonusModule = {
    status: null,
    isSpinning: false,
    slotEmojis: ['🍎', '🍋', '🍒', '🍇', '🍊', '🍉', '⭐'],

    // Звукові ефекти (base64 або URL)
    sounds: {
        spin: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSp9y+7ZjTYGHm7A7OekUxMKQJzd6+mjUxEGOovS8NeFNwkmfdLw3YY3BiFqvu7ssFoUBz+az/DYhzoGMYXU8tiJOAUkd8zx2483ARhtvO7rq1YRCEKd3/DUtFwUBj2V1/LNeSsFKHfH8NyPQAoZbL/v36hVFApGnt/wyHUkBil4y+/di0MLIT+a1e7blT4FLH7H8N+UPwUsdMvv3aVYERRlq+vtr1wbDTuPz+nbpVMRCkGe3/DWs2AYDj6S0/PYgjMELIHQ8+CJMQYTY8Hs66dWEwVHm93t1qNgGwUvg9Hx3ojBAh9yxPDfllAFH2+67eykWBEMRJvd5+OmYh0GPY/R78V2Lh0yfM/u4pVBByp1y/DdjTwKJYLL7+GSRQ',
        click: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2',
        win: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1',
        jackpot: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaL'
    },

    // Ініціалізація
    async init(app) {
        this.app = app;
        await this.loadStatus();
    },

    // Завантажити статус
    async loadStatus() {
        try {
            this.status = await this.app.api.get('/api/bonuses/daily-bonus');
            return this.status;
        } catch (error) {
            console.error('Error loading daily bonus status:', error);
            return null;
        }
    },

    // Рендер блоку щоденних бонусів
    async renderDailyBonusBlock(app) {
        await this.init(app);
        const t = (key) => app.t(key);

        if (!this.status) {
            return '';
        }

        const { can_claim, current_streak, next_reward, streak_broken, can_restore } = this.status;

        return `
            <div class="daily-bonus-block" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); border-radius: 16px; padding: 20px; margin-bottom: 20px; color: white; position: relative; overflow: hidden;">
                <!-- Фоновий патерн -->
                <div style="position: absolute; top: -30px; right: -30px; width: 150px; height: 150px; background: rgba(255,255,255,0.1); border-radius: 50%;"></div>

                <div style="position: relative; z-index: 1;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                        <h3 style="margin: 0; font-size: 20px;">
                            💎 ${t('dailyBonus.title')}
                        </h3>
                        <div style="background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px; font-size: 14px;">
                            🔥 ${t('dailyBonus.streak')}: ${current_streak}
                        </div>
                    </div>

                    <!-- Прогрес стріку -->
                    <div style="margin-bottom: 15px;">
                        <div style="display: flex; gap: 5px; margin-bottom: 10px;">
                            ${this.renderStreakProgress()}
                        </div>
                        <div style="font-size: 12px; opacity: 0.9;">
                            ${t('dailyBonus.nextReward')}: <strong>${next_reward} ${t('bonuses')}</strong>
                        </div>
                    </div>

                    ${streak_broken && can_restore ? `
                        <div style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.3); border-radius: 8px; padding: 10px; margin-bottom: 15px;">
                            <div style="font-size: 14px; margin-bottom: 8px;">
                                ⚠️ ${t('dailyBonus.streakBroken')}
                            </div>
                            <button onclick="DailyBonusModule.restoreStreak()"
                                    style="padding: 8px 16px; background: white; color: #f5576c; border: none; border-radius: 6px; font-weight: 600; cursor: pointer;">
                                🔄 ${t('dailyBonus.restore')} (${this.status.restore_cost} ${t('bonuses')})
                            </button>
                        </div>
                    ` : ''}

                    <!-- Кнопка отримання -->
                    <button
                        id="daily-bonus-btn"
                        onclick="DailyBonusModule.showSlotMachine()"
                        ${!can_claim ? 'disabled' : ''}
                        style="width: 100%; padding: 15px; background: ${can_claim ? 'white' : 'rgba(255,255,255,0.3)'}; color: ${can_claim ? '#f5576c' : 'rgba(255,255,255,0.7)'}; border: none; border-radius: 10px; font-size: 16px; font-weight: bold; cursor: ${can_claim ? 'pointer' : 'not-allowed'}; transition: all 0.3s;">
                        ${can_claim ? '🎰 ' + t('dailyBonus.claim') : '✅ ' + t('dailyBonus.claimed')}
                    </button>
                </div>
            </div>
        `;
    },

    // Рендер прогресу стріку
    renderStreakProgress() {
        const days = [];
        for (let i = 1; i <= 7; i++) {
            const isCompleted = i <= this.status.current_streak;
            const reward = i <= 5 ? i : (i === 6 ? 7 : 10);

            days.push(`
                <div style="flex: 1; text-align: center;">
                    <div style="background: ${isCompleted ? 'white' : 'rgba(255,255,255,0.2)'}; color: ${isCompleted ? '#f5576c' : 'white'}; border-radius: 8px; padding: 8px 4px; margin-bottom: 5px; font-weight: bold; font-size: 12px;">
                        ${reward}
                    </div>
                    <div style="font-size: 10px; opacity: 0.8;">
                        ${this.app.t('dailyBonus.day')} ${i}
                    </div>
                </div>
            `);
        }
        return days.join('');
    },

    // Показати слот-машину
    showSlotMachine() {
        if (!this.status.can_claim || this.isSpinning) return;

        const t = (key) => this.app.t(key);

        const modalHtml = `
            <div id="slot-modal" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 20px;">
                <div style="background: white; border-radius: 20px; max-width: 400px; width: 100%; padding: 30px; text-align: center;">
                    <h2 style="margin: 0 0 20px; color: #f5576c;">🎰 ${t('dailyBonus.slotTitle')}</h2>

                    <!-- Слот машина -->
                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 15px; padding: 20px; margin-bottom: 20px;">
                        <div style="display: flex; gap: 10px; justify-content: center; margin-bottom: 20px;">
                            ${this.renderSlotReels()}
                        </div>

                        <!-- Інформація -->
                        <div style="color: white; font-size: 14px;">
                            <div style="margin-bottom: 5px;">
                                ${t('dailyBonus.guaranteed')}: <strong>${this.status.next_reward} ${t('bonuses')}</strong>
                            </div>
                            <div style="font-size: 12px; opacity: 0.9;">
                                ${t('dailyBonus.jackpotInfo')}
                            </div>
                        </div>
                    </div>

                    <!-- Кнопки -->
                    <div style="display: flex; gap: 10px;">
                        <button
                            id="spin-btn"
                            onclick="DailyBonusModule.spin()"
                            style="flex: 1; padding: 15px; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; border: none; border-radius: 10px; font-size: 18px; font-weight: bold; cursor: pointer;">
                            🎰 ${t('dailyBonus.spin')}
                        </button>
                        <button
                            onclick="DailyBonusModule.closeModal()"
                            style="padding: 15px 20px; background: #e0e0e0; color: #666; border: none; border-radius: 10px; cursor: pointer;">
                            ${t('buttons.cancel')}
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        this.playSound('click');
    },

    // Рендер барабанів слоту
    renderSlotReels() {
        const reels = [];
        for (let i = 0; i < 3; i++) {
            reels.push(`
                <div class="slot-reel" id="reel-${i}" style="background: white; border-radius: 10px; padding: 20px; width: 80px; height: 80px; display: flex; align-items: center; justify-content: center; font-size: 40px; position: relative; overflow: hidden;">
                    <div class="reel-content" id="reel-content-${i}" style="transition: transform 0.5s cubic-bezier(0.17, 0.67, 0.83, 0.67);">
                        ❓
                    </div>
                </div>
            `);
        }
        return reels.join('');
    },

    // Крутити слот
    async spin() {
        if (this.isSpinning) return;

        this.isSpinning = true;
        const spinBtn = document.getElementById('spin-btn');
        spinBtn.disabled = true;
        spinBtn.innerHTML = '⏳ ...';

        // Звук обертання
        this.playSound('spin');

        // Анімація обертання
        for (let i = 0; i < 3; i++) {
            this.animateReel(i);
        }

        // Генеруємо результат
        const result = this.generateSlotResult();

        // Чекаємо 2 секунди для анімації
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Показуємо результат
        for (let i = 0; i < 3; i++) {
            const reelContent = document.getElementById(`reel-content-${i}`);
            reelContent.innerHTML = result[i];
            reelContent.style.transform = 'translateY(0)';
        }

        // Відправляємо результат на сервер
        try {
            const response = await this.app.api.post('/api/bonuses/daily/claim', {
                slot_result: result
           });

           // Звук результату
           if (response.jackpot) {
               this.playSound('jackpot');
               this.showJackpotAnimation();
           } else {
               this.playSound('win');
           }

           // Показуємо результат
           setTimeout(() => {
               this.showResult(response);
           }, 500);

       } catch (error) {
           this.app.tg.showAlert(`❌ ${error.message}`);
           this.closeModal();
       }

       this.isSpinning = false;
   },

   // Анімація барабану
   animateReel(index) {
       const reelContent = document.getElementById(`reel-content-${index}`);
       let position = 0;
       const animationDuration = 1500 + (index * 200); // Різна тривалість для кожного барабану
       const startTime = Date.now();

       const animate = () => {
           const elapsed = Date.now() - startTime;
           if (elapsed < animationDuration) {
               position += 20;
               reelContent.style.transform = `translateY(${position}px)`;

               // Змінюємо емодзі під час обертання
               if (position % 80 === 0) {
                   const randomEmoji = this.slotEmojis[Math.floor(Math.random() * this.slotEmojis.length)];
                   reelContent.innerHTML = randomEmoji;
               }

               requestAnimationFrame(animate);
           }
       };

       animate();
   },

   // Генерація результату слоту
   generateSlotResult() {
       const result = [];

       // Перевіряємо чи буде джекпот (0.5% шанс)
       const isJackpot = Math.random() < 0.005;

       if (isJackpot) {
           // Вибираємо випадковий емодзі для джекпоту
           const jackpotEmoji = this.slotEmojis[Math.floor(Math.random() * this.slotEmojis.length)];
           result.push(jackpotEmoji, jackpotEmoji, jackpotEmoji);
       } else {
           // Звичайний результат - всі різні або 2 однакових
           for (let i = 0; i < 3; i++) {
               result.push(this.slotEmojis[Math.floor(Math.random() * this.slotEmojis.length)]);
           }
       }

       return result;
   },

   // Показати результат
   showResult(response) {
       const t = (key) => this.app.t(key);

       const resultHtml = `
           <div id="result-overlay" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.9); display: flex; align-items: center; justify-content: center; z-index: 10000;">
               <div style="background: white; border-radius: 20px; padding: 30px; text-align: center; max-width: 350px;">
                   ${response.jackpot ? `
                       <div style="font-size: 60px; margin-bottom: 20px;">🎉</div>
                       <h2 style="margin: 0 0 20px; color: #f5576c; font-size: 28px;">JACKPOT!</h2>
                   ` : `
                       <div style="font-size: 50px; margin-bottom: 20px;">✨</div>
                       <h3 style="margin: 0 0 20px; color: #667eea;">${t('dailyBonus.congratulations')}</h3>
                   `}

                   <div style="margin-bottom: 20px;">
                       <div style="font-size: 18px; margin-bottom: 10px;">
                           ${t('dailyBonus.youWon')}:
                       </div>
                       <div style="font-size: 32px; font-weight: bold; color: #f5576c;">
                           +${response.total_reward} ${t('bonuses')}
                       </div>
                       ${response.jackpot ? `
                           <div style="font-size: 14px; color: #666; margin-top: 10px;">
                               ${t('dailyBonus.base')}: ${response.base_reward} + ${t('dailyBonus.jackpotBonus')}: ${response.jackpot_bonus}
                           </div>
                       ` : ''}
                   </div>

                   <div style="background: #f8f9fa; border-radius: 10px; padding: 15px; margin-bottom: 20px;">
                       <div style="font-size: 14px; color: #666; margin-bottom: 5px;">
                           ${t('dailyBonus.newBalance')}:
                       </div>
                       <div style="font-size: 24px; font-weight: bold; color: #667eea;">
                           💎 ${response.new_balance}
                       </div>
                   </div>

                   <div style="background: #fff3cd; border-radius: 10px; padding: 15px; margin-bottom: 20px;">
                       <div style="font-size: 14px; color: #856404;">
                           🔥 ${t('dailyBonus.streakDay')}: <strong>${response.streak_day}</strong>
                       </div>
                   </div>

                   <button
                       onclick="DailyBonusModule.closeAllModals()"
                       style="width: 100%; padding: 15px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 10px; font-size: 16px; font-weight: bold; cursor: pointer;">
                       ${t('buttons.confirm')}
                   </button>
               </div>
           </div>
       `;

       document.body.insertAdjacentHTML('beforeend', resultHtml);
   },

   // Анімація джекпоту
   showJackpotAnimation() {
       const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#f0932b', '#eb4d4b', '#6ab04c'];

       for (let i = 0; i < 20; i++) {
           setTimeout(() => {
               const confetti = document.createElement('div');
               confetti.style.cssText = `
                   position: fixed;
                   top: ${Math.random() * 100}%;
                   left: ${Math.random() * 100}%;
                   width: 10px;
                   height: 10px;
                   background: ${colors[Math.floor(Math.random() * colors.length)]};
                   border-radius: 50%;
                   z-index: 10001;
                   animation: fall 3s ease-out forwards;
               `;
               document.body.appendChild(confetti);

               setTimeout(() => confetti.remove(), 3000);
           }, i * 50);
       }

       // CSS анімація для конфеті
       if (!document.getElementById('confetti-style')) {
           const style = document.createElement('style');
           style.id = 'confetti-style';
           style.innerHTML = `
               @keyframes fall {
                   to {
                       transform: translateY(100vh) rotate(360deg);
                       opacity: 0;
                   }
               }
           `;
           document.head.appendChild(style);
       }
   },

   // Відновити стрік
   async restoreStreak() {
       const t = (key) => this.app.t(key);

       if (confirm(`${t('dailyBonus.confirmRestore')} ${this.status.restore_cost} ${t('bonuses')}?`)) {
           try {
               const response = await this.app.api.post('/api/bonuses/daily/restore-streak');

               if (response.success) {
                   this.app.tg.showAlert(`✅ ${t('dailyBonus.streakRestored')}`);

                   // Оновлюємо баланс
                   this.app.user.bonuses = response.new_balance;

                   // Перезавантажуємо блок
                   await this.loadStatus();
                   const block = await this.renderDailyBonusBlock(this.app);
                   document.getElementById('daily-bonus-block').innerHTML = block;
               }
           } catch (error) {
               this.app.tg.showAlert(`❌ ${error.message}`);
           }
       }
   },

   // Закрити модальне вікно
   closeModal() {
       const modal = document.getElementById('slot-modal');
       if (modal) modal.remove();
   },

   // Закрити всі модальні вікна
   closeAllModals() {
       this.closeModal();
       const overlay = document.getElementById('result-overlay');
       if (overlay) overlay.remove();

       // Оновлюємо головну сторінку
       this.app.loadPage('home');
   },

   // Програти звук
   playSound(type) {
       try {
           // Якщо є API Telegram для звуків
           if (this.app.tg?.HapticFeedback) {
               switch(type) {
                   case 'click':
                       this.app.tg.HapticFeedback.impactOccurred('light');
                       break;
                   case 'spin':
                       this.app.tg.HapticFeedback.impactOccurred('medium');
                       break;
                   case 'win':
                       this.app.tg.HapticFeedback.notificationOccurred('success');
                       break;
                   case 'jackpot':
                       this.app.tg.HapticFeedback.notificationOccurred('success');
                       this.app.tg.HapticFeedback.impactOccurred('heavy');
                       break;
               }
           }

           // Програвання звуку через Audio API (якщо підтримується)
           if (this.sounds[type] && typeof Audio !== 'undefined') {
               const audio = new Audio(this.sounds[type]);
               audio.volume = 0.5;
               audio.play().catch(e => console.log('Sound play failed:', e));
           }
       } catch (error) {
           console.log('Sound error:', error);
       }
   }
};