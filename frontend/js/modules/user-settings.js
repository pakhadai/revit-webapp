// frontend/js/modules/user-settings.js
/**
 * Модуль налаштувань профілю користувача
 */

window.UserSettingsModule = {
    currentSettings: null,
    hasUnsavedChanges: false,

    // Ініціалізація модуля
    async init(app) {
        this.app = app;
        await this.loadSettings();
    },

    // Завантаження поточних налаштувань
    async loadSettings() {
        try {
            this.currentSettings = await this.app.api.get('/api/users/settings');
            return this.currentSettings;
        } catch (error) {
            console.error('Failed to load settings:', error);
            return null;
        }
    },

    // Відображення сторінки налаштувань
    async showSettings(app) {
        const content = document.getElementById('app-content');
        const t = (key) => app.translations[key] || key;

        // Завантажуємо свіжі налаштування
        await this.loadSettings();

        if (!this.currentSettings) {
            content.innerHTML = `
                <div class="error-message">
                    <p>❌ ${t('settings.loadError')}</p>
                    <button onclick="window.app.loadPage('profile')" class="btn btn-secondary">
                        ${t('buttons.back')}
                    </button>
                </div>
            `;
            return;
        }

        content.innerHTML = `
            <div class="settings-page">
                <div class="settings-header">
                    <button onclick="window.app.loadPage('profile')" class="btn-back">
                        ← ${t('buttons.back')}
                    </button>
                    <h1>⚙️ ${t('settings.title')}</h1>
                    <button onclick="UserSettingsModule.saveSettings()"
                            class="btn btn-primary"
                            id="save-settings-btn"
                            disabled>
                        💾 ${t('buttons.save')}
                    </button>
                </div>

                <div class="settings-tabs">
                    <button class="tab-btn active" onclick="UserSettingsModule.switchTab('general')">
                        🌐 ${t('settings.tabs.general')}
                    </button>
                    <button class="tab-btn" onclick="UserSettingsModule.switchTab('notifications')">
                        🔔 ${t('settings.tabs.notifications')}
                    </button>
                    <button class="tab-btn" onclick="UserSettingsModule.switchTab('interface')">
                        🎨 ${t('settings.tabs.interface')}
                    </button>
                    <button class="tab-btn" onclick="UserSettingsModule.switchTab('privacy')">
                        🔒 ${t('settings.tabs.privacy')}
                    </button>
                    <button class="tab-btn" onclick="UserSettingsModule.switchTab('advanced')">
                        🔧 ${t('settings.tabs.advanced')}
                    </button>
                </div>

                <div class="settings-content">
                    <!-- Основні налаштування -->
                    <div id="general-tab" class="settings-tab active">
                        ${this.renderGeneralSettings()}
                    </div>

                    <!-- Налаштування сповіщень -->
                    <div id="notifications-tab" class="settings-tab" style="display: none;">
                        ${this.renderNotificationSettings()}
                    </div>

                    <!-- Налаштування інтерфейсу -->
                    <div id="interface-tab" class="settings-tab" style="display: none;">
                        ${this.renderInterfaceSettings()}
                    </div>

                    <!-- Налаштування конфіденційності -->
                    <div id="privacy-tab" class="settings-tab" style="display: none;">
                        ${this.renderPrivacySettings()}
                    </div>

                    <!-- Розширені налаштування -->
                    <div id="advanced-tab" class="settings-tab" style="display: none;">
                        ${this.renderAdvancedSettings()}
                    </div>
                </div>
            </div>
        `;

        // Додаємо слухачі подій
        this.attachEventListeners();
    },

    // Рендеринг основних налаштувань
    renderGeneralSettings() {
        const t = (key) => this.app.translations[key] || key;
        const s = this.currentSettings;

        return `
            <div class="settings-section">
                <h2>${t('settings.general.title')}</h2>

                <div class="setting-group">
                    <label for="language">${t('settings.general.language')}</label>
                    <select id="language" class="setting-input" onchange="UserSettingsModule.markAsChanged()">
                        <option value="ua" ${s.language_code === 'ua' ? 'selected' : ''}>🇺🇦 Українська</option>
                        <option value="en" ${s.language_code === 'en' ? 'selected' : ''}>🇬🇧 English</option>
                        <option value="ru" ${s.language_code === 'ru' ? 'selected' : ''}>🇷🇺 Русский</option>
                        <option value="de" ${s.language_code === 'de' ? 'selected' : ''}>🇩🇪 Deutsch</option>
                        <option value="ar" ${s.language_code === 'ar' ? 'selected' : ''}>🇸🇦 العربية</option>
                    </select>
                </div>

                <div class="setting-group">
                    <label for="display_name">${t('settings.general.displayName')}</label>
                    <input type="text"
                           id="display_name"
                           class="setting-input"
                           value="${s.display_name || ''}"
                           placeholder="${t('settings.general.displayNamePlaceholder')}"
                           onchange="UserSettingsModule.markAsChanged()">
                </div>

                <div class="setting-group">
                    <label for="bio">${t('settings.general.bio')}</label>
                    <textarea id="bio"
                              class="setting-input"
                              rows="4"
                              placeholder="${t('settings.general.bioPlaceholder')}"
                              onchange="UserSettingsModule.markAsChanged()">${s.bio || ''}</textarea>
                </div>

                <div class="setting-group">
                    <label for="country">${t('settings.general.country')}</label>
                    <select id="country" class="setting-input" onchange="UserSettingsModule.markAsChanged()">
                        <option value="">${t('settings.general.selectCountry')}</option>
                        <option value="UA" ${s.country === 'UA' ? 'selected' : ''}>🇺🇦 Ukraine</option>
                        <option value="US" ${s.country === 'US' ? 'selected' : ''}>🇺🇸 United States</option>
                        <option value="GB" ${s.country === 'GB' ? 'selected' : ''}>🇬🇧 United Kingdom</option>
                        <option value="DE" ${s.country === 'DE' ? 'selected' : ''}>🇩🇪 Germany</option>
                        <option value="FR" ${s.country === 'FR' ? 'selected' : ''}>🇫🇷 France</option>
                        <option value="PL" ${s.country === 'PL' ? 'selected' : ''}>🇵🇱 Poland</option>
                    </select>
                </div>

                <div class="setting-group">
                    <label for="timezone">${t('settings.general.timezone')}</label>
                    <select id="timezone" class="setting-input" onchange="UserSettingsModule.markAsChanged()">
                        <option value="Europe/Kiev" ${s.timezone === 'Europe/Kiev' ? 'selected' : ''}>Київ (UTC+2)</option>
                        <option value="Europe/London" ${s.timezone === 'Europe/London' ? 'selected' : ''}>London (UTC+0)</option>
                        <option value="Europe/Berlin" ${s.timezone === 'Europe/Berlin' ? 'selected' : ''}>Berlin (UTC+1)</option>
                        <option value="America/New_York" ${s.timezone === 'America/New_York' ? 'selected' : ''}>New York (UTC-5)</option>
                    </select>
                </div>
            </div>
        `;
    },

    // Рендеринг налаштувань сповіщень
    renderNotificationSettings() {
        const t = (key) => this.app.translations[key] || key;
        const s = this.currentSettings;

        return `
            <div class="settings-section">
                <h2>${t('settings.notifications.title')}</h2>

                <div class="settings-info">
                    <p>${t('settings.notifications.description')}</p>
                </div>

                <div class="toggle-group">
                    <label class="toggle-label">
                        <input type="checkbox"
                               id="notify_new_archives"
                               ${s.notify_new_archives ? 'checked' : ''}
                               onchange="UserSettingsModule.markAsChanged()">
                        <span class="toggle-slider"></span>
                        <span class="toggle-text">
                            📦 ${t('settings.notifications.newArchives')}
                        </span>
                    </label>
                </div>

                <div class="toggle-group">
                    <label class="toggle-label">
                        <input type="checkbox"
                               id="notify_promotions"
                               ${s.notify_promotions ? 'checked' : ''}
                               onchange="UserSettingsModule.markAsChanged()">
                        <span class="toggle-slider"></span>
                        <span class="toggle-text">
                            🎁 ${t('settings.notifications.promotions')}
                        </span>
                    </label>
                </div>

                <div class="toggle-group">
                    <label class="toggle-label">
                        <input type="checkbox"
                               id="notify_bonuses"
                               ${s.notify_bonuses ? 'checked' : ''}
                               onchange="UserSettingsModule.markAsChanged()">
                        <span class="toggle-slider"></span>
                        <span class="toggle-text">
                            💎 ${t('settings.notifications.bonuses')}
                        </span>
                    </label>
                </div>

                <div class="toggle-group">
                    <label class="toggle-label">
                        <input type="checkbox"
                               id="notify_order_status"
                               ${s.notify_order_status ? 'checked' : ''}
                               onchange="UserSettingsModule.markAsChanged()">
                        <span class="toggle-slider"></span>
                        <span class="toggle-text">
                            📋 ${t('settings.notifications.orderStatus')}
                        </span>
                    </label>
                </div>

                <div class="toggle-group">
                    <label class="toggle-label">
                        <input type="checkbox"
                               id="notify_subscription_expiry"
                               ${s.notify_subscription_expiry ? 'checked' : ''}
                               onchange="UserSettingsModule.markAsChanged()">
                        <span class="toggle-slider"></span>
                        <span class="toggle-text">
                            ⏰ ${t('settings.notifications.subscriptionExpiry')}
                        </span>
                    </label>
                </div>

                <button onclick="UserSettingsModule.resetCategory('notifications')"
                        class="btn btn-secondary mt-3">
                    🔄 ${t('settings.resetToDefault')}
                </button>
            </div>
        `;
    },

    // Рендеринг налаштувань інтерфейсу
    renderInterfaceSettings() {
        const t = (key) => this.app.translations[key] || key;
        const s = this.currentSettings;

        return `
            <div class="settings-section">
                <h2>${t('settings.interface.title')}</h2>

                <div class="setting-group">
                    <label for="theme">${t('settings.interface.theme')}</label>
                    <select id="theme" class="setting-input" onchange="UserSettingsModule.markAsChanged(); UserSettingsModule.applyTheme(this.value)">
                        <option value="auto" ${s.theme === 'auto' ? 'selected' : ''}>🌓 ${t('settings.interface.themeAuto')}</option>
                        <option value="light" ${s.theme === 'light' ? 'selected' : ''}>☀️ ${t('settings.interface.themeLight')}</option>
                        <option value="dark" ${s.theme === 'dark' ? 'selected' : ''}>🌙 ${t('settings.interface.themeDark')}</option>
                    </select>
                </div>

                <div class="toggle-group">
                    <label class="toggle-label">
                        <input type="checkbox"
                               id="compact_view"
                               ${s.compact_view ? 'checked' : ''}
                               onchange="UserSettingsModule.markAsChanged()">
                        <span class="toggle-slider"></span>
                        <span class="toggle-text">
                            📐 ${t('settings.interface.compactView')}
                        </span>
                    </label>
                </div>

                <div class="toggle-group">
                    <label class="toggle-label">
                        <input type="checkbox"
                               id="show_prices_with_vat"
                               ${s.show_prices_with_vat ? 'checked' : ''}
                               onchange="UserSettingsModule.markAsChanged()">
                        <span class="toggle-slider"></span>
                        <span class="toggle-text">
                            💰 ${t('settings.interface.showPricesWithVAT')}
                        </span>
                    </label>
                </div>

                <button onclick="UserSettingsModule.resetCategory('interface')"
                        class="btn btn-secondary mt-3">
                    🔄 ${t('settings.resetToDefault')}
                </button>
            </div>
        `;
    },

    // Рендеринг налаштувань конфіденційності
    renderPrivacySettings() {
        const t = (key) => this.app.translations[key] || key;
        const s = this.currentSettings;

        return `
            <div class="settings-section">
                <h2>${t('settings.privacy.title')}</h2>

                <div class="setting-group">
                    <label for="profile_visibility">${t('settings.privacy.profileVisibility')}</label>
                    <select id="profile_visibility" class="setting-input" onchange="UserSettingsModule.markAsChanged()">
                        <option value="public" ${s.profile_visibility === 'public' ? 'selected' : ''}>
                            🌍 ${t('settings.privacy.public')}
                        </option>
                        <option value="friends" ${s.profile_visibility === 'friends' ? 'selected' : ''}>
                            👥 ${t('settings.privacy.friendsOnly')}
                        </option>
                        <option value="private" ${s.profile_visibility === 'private' ? 'selected' : ''}>
                            🔒 ${t('settings.privacy.private')}
                        </option>
                    </select>
                </div>

                <div class="toggle-group">
                    <label class="toggle-label">
                        <input type="checkbox"
                               id="show_purchase_history"
                               ${s.show_purchase_history ? 'checked' : ''}
                               onchange="UserSettingsModule.markAsChanged()">
                        <span class="toggle-slider"></span>
                        <span class="toggle-text">
                            📜 ${t('settings.privacy.showPurchaseHistory')}
                        </span>
                    </label>
                </div>

                <div class="toggle-group">
                    <label class="toggle-label">
                        <input type="checkbox"
                               id="allow_friend_requests"
                               ${s.allow_friend_requests ? 'checked' : ''}
                               onchange="UserSettingsModule.markAsChanged()">
                        <span class="toggle-slider"></span>
                        <span class="toggle-text">
                            ➕ ${t('settings.privacy.allowFriendRequests')}
                        </span>
                    </label>
                </div>

                <button onclick="UserSettingsModule.resetCategory('privacy')"
                        class="btn btn-secondary mt-3">
                    🔄 ${t('settings.resetToDefault')}
                </button>
            </div>
        `;
    },

    // Рендеринг розширених налаштувань
    renderAdvancedSettings() {
        const t = (key) => this.app.translations[key] || key;
        const s = this.currentSettings;

        return `
            <div class="settings-section">
                <h2>${t('settings.advanced.title')}</h2>

                <div class="settings-info security-info">
                    <h3>🔐 ${t('settings.advanced.security')}</h3>
                    <div class="security-status">
                        <div class="status-item ${s.email_verified ? 'verified' : 'unverified'}">
                            ${s.email_verified ? '✅' : '⚠️'} ${t('settings.advanced.emailVerified')}
                        </div>
                        <div class="status-item ${s.phone_verified ? 'verified' : 'unverified'}">
                            ${s.phone_verified ? '✅' : '⚠️'} ${t('settings.advanced.phoneVerified')}
                        </div>
                        <div class="status-item ${s.two_factor_enabled ? 'verified' : 'unverified'}">
                            ${s.two_factor_enabled ? '✅' : '⚠️'} ${t('settings.advanced.twoFactor')}
                        </div>
                    </div>
                </div>

                <div class="advanced-actions">
                    <button onclick="UserSettingsModule.exportSettings()" class="btn btn-secondary">
                        📥 ${t('settings.advanced.exportSettings')}
                    </button>

                    <button onclick="UserSettingsModule.importSettings()" class="btn btn-secondary">
                        📤 ${t('settings.advanced.importSettings')}
                    </button>

                    <button onclick="UserSettingsModule.clearCache()" class="btn btn-warning">
                        🗑️ ${t('settings.advanced.clearCache')}
                    </button>

                    <button onclick="UserSettingsModule.deleteAccount()" class="btn btn-danger">
                        ⚠️ ${t('settings.advanced.deleteAccount')}
                    </button>
                </div>

                <input type="file"
                       id="import-file"
                       accept=".json"
                       style="display: none;"
                       onchange="UserSettingsModule.handleImportFile(this.files[0])">
            </div>
        `;
    },

    // Збереження налаштувань
    async saveSettings() {
        const t = (key) => this.app.translations[key] || key;

        try {
            const updates = this.collectChanges();

            if (Object.keys(updates).length === 0) {
                this.app.tg.showAlert(t('settings.noChanges'));
                return;
            }

            const response = await this.app.api.put('/api/users/settings', updates);

            if (response.success) {
                this.app.tg.showAlert(t('settings.saved'));
                this.hasUnsavedChanges = false;
                document.getElementById('save-settings-btn').disabled = true;

                // Оновлюємо мову інтерфейсу якщо змінилась
                if (updates.language_code) {
                    this.app.currentLang = updates.language_code;
                    await this.app.loadTranslations();
                    await this.showSettings(this.app);
                }

                // Оновлюємо тему якщо змінилась
                if (updates.theme) {
                    this.applyTheme(updates.theme);
                }
            }
        } catch (error) {
            this.app.tg.showAlert(`❌ ${t('settings.saveError')}: ${error.message}`);
        }
    },

    // Збір змінених полів
    collectChanges() {
        const changes = {};
        const fields = [
            'language_code', 'display_name', 'bio', 'country', 'timezone',
            'notify_new_archives', 'notify_promotions', 'notify_bonuses',
            'notify_order_status', 'notify_subscription_expiry',
            'theme', 'compact_view', 'show_prices_with_vat',
            'profile_visibility', 'show_purchase_history', 'allow_friend_requests'
        ];

        fields.forEach(field => {
            const element = document.getElementById(field) || document.getElementById(field.replace('_code', ''));
            if (!element) return;

            let value;
            if (element.type === 'checkbox') {
                value = element.checked;
            } else {
                value = element.value;
            }

            // Порівнюємо з поточним значенням
            if (value !== this.currentSettings[field]) {
                changes[field] = value;
            }
        });

        return changes;
    },

    // Позначити як змінено
    markAsChanged() {
        this.hasUnsavedChanges = true;
        const saveBtn = document.getElementById('save-settings-btn');
        if (saveBtn) saveBtn.disabled = false;
    },

    // Перемикання вкладок
    switchTab(tabName) {
        // Приховуємо всі вкладки
        document.querySelectorAll('.settings-tab').forEach(tab => {
            tab.style.display = 'none';
        });

        // Показуємо вибрану
        const selectedTab = document.getElementById(`${tabName}-tab`);
        if (selectedTab) selectedTab.style.display = 'block';

        // Оновлюємо активну кнопку
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        event.target.classList.add('active');
    },

    // Застосування теми
    applyTheme(theme) {
        if (theme === 'dark') {
            document.body.classList.add('dark-theme');
            document.body.classList.remove('light-theme');
        } else if (theme === 'light') {
            document.body.classList.add('light-theme');
            document.body.classList.remove('dark-theme');
        } else {
            // Auto - використовуємо системні налаштування
            document.body.classList.remove('dark-theme', 'light-theme');
        }
    },

    // Скидання категорії налаштувань
    async resetCategory(category) {
        const t = (key) => this.app.translations[key] || key;

        if (!confirm(t('settings.confirmReset'))) return;

        try {
            const response = await this.app.api.post('/api/users/settings/reset', { category });

            if (response.success) {
                this.app.tg.showAlert(t('settings.resetSuccess'));
                await this.loadSettings();
                await this.showSettings(this.app);
            }
        } catch (error) {
            this.app.tg.showAlert(`❌ ${t('settings.resetError')}: ${error.message}`);
        }
    },

    // Експорт налаштувань
    async exportSettings() {
        try {
            const settings = await this.app.api.get('/api/users/settings/export');

            const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `revitbot_settings_${Date.now()}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            this.app.tg.showAlert('✅ Settings exported successfully');
        } catch (error) {
            this.app.tg.showAlert(`❌ Export failed: ${error.message}`);
        }
    },

    // Імпорт налаштувань
    importSettings() {
        document.getElementById('import-file').click();
    },

    // Обробка файлу імпорту
    async handleImportFile(file) {
        if (!file) return;

        try {
            const text = await file.text();
            const settings = JSON.parse(text);

            const response = await this.app.api.post('/api/users/settings/import', settings);

            if (response.success) {
                this.app.tg.showAlert('✅ Settings imported successfully');
                await this.loadSettings();
                await this.showSettings(this.app);
            }
        } catch (error) {
            this.app.tg.showAlert(`❌ Import failed: ${error.message}`);
        }
    },

    // Очищення кешу
    clearCache() {
        const t = (key) => this.app.translations[key] || key;

        if (!confirm(t('settings.confirmClearCache'))) return;

        // Очищуємо localStorage
        const keysToKeep = ['revitbot_token', 'revitbot_user'];
        const allKeys = Object.keys(localStorage);

        allKeys.forEach(key => {
            if (!keysToKeep.includes(key) && key.startsWith('revitbot_')) {
                localStorage.removeItem(key);
            }
        });

        // Очищуємо sessionStorage
        sessionStorage.clear();

        this.app.tg.showAlert(t('settings.cacheCleared'));
    },

    // Видалення акаунту
    deleteAccount() {
        const t = (key) => this.app.translations[key] || key;

        const confirmText = prompt(t('settings.deleteAccountConfirm'));

        if (confirmText !== 'DELETE') {
            return;
        }

        // Тут буде логіка видалення акаунту
        this.app.tg.showAlert('⚠️ Account deletion is not implemented yet');
    },

    // Додавання слухачів подій
    attachEventListeners() {
        // Попередження про незбережені зміни
        window.addEventListener('beforeunload', (e) => {
            if (this.hasUnsavedChanges) {
                e.preventDefault();
                e.returnValue = '';
            }
        });
    }
};