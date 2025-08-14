// frontend/js/modules/marketplace.js
/**
 * Модуль маркетплейсу для розробників
 */

window.MarketplaceModule = {
    currentTab: 'overview',
    developerProfile: null,
    products: [],
    transactions: [],

    // Ініціалізація модуля
    async init(app) {
        this.app = app;
        await this.checkDeveloperStatus();
    },

    // Перевірка статусу розробника
    async checkDeveloperStatus() {
        try {
            const status = await this.app.api.get('/api/marketplace/application/status');
            this.applicationStatus = status.status;

            if (status.status === 'approved') {
                this.developerProfile = await this.app.api.get('/api/marketplace/profile');
            }

            return status;
        } catch (error) {
            console.error('Error checking developer status:', error);
            return { status: 'none' };
        }
    },

    // Відображення сторінки маркетплейсу
    async showMarketplace(app) {
        const content = document.getElementById('app-content');
        const status = await this.checkDeveloperStatus();

        if (status.status === 'none') {
            this.showApplicationForm(app);
        } else if (status.status === 'pending') {
            this.showPendingStatus(app);
        } else if (status.status === 'rejected') {
            this.showRejectedStatus(app, status);
        } else if (status.status === 'approved') {
            this.showDeveloperDashboard(app);
        }
    },

    // Форма подачі заявки
    showApplicationForm(app) {
        const content = document.getElementById('app-content');

        content.innerHTML = `
            <div class="marketplace-application">
                <div class="application-header">
                    <h1>🚀 Станьте розробником RevitBot</h1>
                    <p>Продавайте свої Revit сімейства мільйонам користувачів</p>
                </div>

                <div class="benefits-grid">
                    <div class="benefit-card">
                        <div class="benefit-icon">💰</div>
                        <h3>70% від продажів</h3>
                        <p>Отримуйте до 70% від кожного продажу</p>
                    </div>
                    <div class="benefit-card">
                        <div class="benefit-icon">🌍</div>
                        <h3>Глобальна аудиторія</h3>
                        <p>Доступ до користувачів з усього світу</p>
                    </div>
                    <div class="benefit-card">
                        <div class="benefit-icon">📊</div>
                        <h3>Аналітика</h3>
                        <p>Детальна статистика продажів</p>
                    </div>
                    <div class="benefit-card">
                        <div class="benefit-icon">🛡️</div>
                        <h3>Захист контенту</h3>
                        <p>Ваші файли під надійним захистом</p>
                    </div>
                </div>

                <form id="developer-application-form" class="application-form">
                    <h2>Заявка на статус розробника</h2>

                    <div class="form-section">
                        <h3>Основна інформація</h3>

                        <div class="form-group">
                            <label>Назва компанії (опціонально)</label>
                            <input type="text" id="company_name" placeholder="Ваша компанія або бренд">
                        </div>

                        <div class="form-group">
                            <label>Портфоліо *</label>
                            <input type="url" id="portfolio_url" required placeholder="https://your-portfolio.com">
                        </div>

                        <div class="form-group">
                            <label>Опис вашого досвіду *</label>
                            <textarea id="description" required rows="5" minlength="100"
                                placeholder="Розкажіть про ваш досвід роботи з Revit, створені проекти, спеціалізацію..."></textarea>
                            <div class="char-count">Мінімум 100 символів</div>
                        </div>
                    </div>

                    <div class="form-section">
                        <h3>Спеціалізація</h3>
                        <div class="specialization-grid">
                            <label class="checkbox-label">
                                <input type="checkbox" name="specialization" value="architecture">
                                <span>🏢 Архітектура</span>
                            </label>
                            <label class="checkbox-label">
                                <input type="checkbox" name="specialization" value="furniture">
                                <span>🪑 Меблі</span>
                            </label>
                            <label class="checkbox-label">
                                <input type="checkbox" name="specialization" value="plumbing">
                                <span>🚿 Сантехніка</span>
                            </label>
                            <label class="checkbox-label">
                                <input type="checkbox" name="specialization" value="electrical">
                                <span>⚡ Електрика</span>
                            </label>
                            <label class="checkbox-label">
                                <input type="checkbox" name="specialization" value="hvac">
                                <span>❄️ Вентиляція</span>
                            </label>
                            <label class="checkbox-label">
                                <input type="checkbox" name="specialization" value="structural">
                                <span>🏗️ Конструкції</span>
                            </label>
                        </div>
                    </div>

                    <div class="form-section">
                        <h3>Контактна інформація</h3>

                        <div class="form-group">
                            <label>Email *</label>
                            <input type="email" id="contact_email" required placeholder="your@email.com">
                        </div>

                        <div class="form-group">
                            <label>Телефон</label>
                            <input type="tel" id="contact_phone" placeholder="+380...">
                        </div>

                        <div class="form-group">
                            <label>Telegram</label>
                            <input type="text" id="contact_telegram" placeholder="@username">
                        </div>
                    </div>

                    <div class="form-section">
                        <label class="checkbox-label">
                            <input type="checkbox" id="accepted_terms" required>
                            <span>Я погоджуюсь з <a href="#" onclick="MarketplaceModule.showTerms()">умовами співпраці</a></span>
                        </label>
                    </div>

                    <button type="submit" class="btn btn-primary btn-large">
                        Подати заявку
                    </button>
                </form>
            </div>
        `;

        // Додаємо обробник форми
        document.getElementById('developer-application-form').addEventListener('submit',
            (e) => this.submitApplication(e));
    },

    // Подача заявки
    async submitApplication(event) {
        event.preventDefault();

        const specializations = Array.from(
            document.querySelectorAll('input[name="specialization"]:checked')
        ).map(cb => cb.value);

        if (specializations.length === 0) {
            this.app.tg.showAlert('Виберіть хоча б одну спеціалізацію');
            return;
        }

        const applicationData = {
            company_name: document.getElementById('company_name').value || null,
            portfolio_url: document.getElementById('portfolio_url').value,
            description: document.getElementById('description').value,
            specialization: specializations,
            contact_email: document.getElementById('contact_email').value,
            contact_phone: document.getElementById('contact_phone').value || null,
            contact_telegram: document.getElementById('contact_telegram').value || null,
            accepted_terms: document.getElementById('accepted_terms').checked
        };

        try {
            const response = await this.app.api.post('/api/marketplace/apply', applicationData);

            if (response.success) {
                this.app.tg.showAlert('✅ Заявку успішно подано! Очікуйте на розгляд.');
                this.showPendingStatus(this.app);
            }
        } catch (error) {
            this.app.tg.showAlert(`❌ Помилка: ${error.message}`);
        }
    },

    // Статус очікування
    showPendingStatus(app) {
        const content = document.getElementById('app-content');

        content.innerHTML = `
            <div class="status-page pending">
                <div class="status-icon">⏳</div>
                <h1>Заявка на розгляді</h1>
                <p>Ваша заявка успішно подана та очікує на розгляд модератора.</p>
                <p>Зазвичай це займає 1-3 робочі дні.</p>
                <button onclick="window.app.loadPage('profile')" class="btn btn-secondary">
                    Повернутись до профілю
                </button>
            </div>
        `;
    },

    // Статус відхилення
    showRejectedStatus(app, status) {
        const content = document.getElementById('app-content');

        content.innerHTML = `
            <div class="status-page rejected">
                <div class="status-icon">❌</div>
                <h1>Заявку відхилено</h1>
                <p>На жаль, ваша заявка була відхилена.</p>
                ${status.rejection_reason ? `<p><strong>Причина:</strong> ${status.rejection_reason}</p>` : ''}
                <p>Ви можете подати нову заявку після усунення зауважень.</p>
                <button onclick="MarketplaceModule.showApplicationForm(window.app)" class="btn btn-primary">
                    Подати нову заявку
                </button>
            </div>
        `;
    },

    // Панель розробника
    showDeveloperDashboard(app) {
        const content = document.getElementById('app-content');

        content.innerHTML = `
            <div class="developer-dashboard">
                <div class="dashboard-header">
                    <h1>👨‍💻 Кабінет розробника</h1>
                    <div class="header-stats">
                        <div class="stat">
                            <span class="stat-value">$${this.developerProfile.balance.toFixed(2)}</span>
                            <span class="stat-label">Баланс</span>
                        </div>
                        <div class="stat">
                            <span class="stat-value">${this.developerProfile.total_sales}</span>
                            <span class="stat-label">Продажів</span>
                        </div>
                        <div class="stat">
                            <span class="stat-value">⭐ ${this.developerProfile.average_rating.toFixed(1)}</span>
                            <span class="stat-label">Рейтинг</span>
                        </div>
                    </div>
                </div>

                <div class="dashboard-tabs">
                    <button class="tab-btn active" onclick="MarketplaceModule.switchTab('overview')">
                        📊 Огляд
                    </button>
                    <button class="tab-btn" onclick="MarketplaceModule.switchTab('products')">
                        📦 Мої товари
                    </button>
                    <button class="tab-btn" onclick="MarketplaceModule.switchTab('sales')">
                        💰 Продажі
                    </button>
                    <button class="tab-btn" onclick="MarketplaceModule.switchTab('analytics')">
                        📈 Аналітика
                    </button>
                    <button class="tab-btn" onclick="MarketplaceModule.switchTab('finance')">
                        💳 Фінанси
                    </button>
                    <button class="tab-btn" onclick="MarketplaceModule.switchTab('settings')">
                        ⚙️ Налаштування
                    </button>
                </div>

                <div class="dashboard-content">
                    <div id="tab-content"></div>
                </div>
            </div>
        `;

        this.switchTab('overview');
    },

    // Перемикання вкладок
    switchTab(tabName) {
        this.currentTab = tabName;

        // Оновлюємо активну кнопку
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        event?.target?.classList.add('active');

        const content = document.getElementById('tab-content');

        switch(tabName) {
            case 'overview':
                this.showOverview(content);
                break;
            case 'products':
                this.showProducts(content);
                break;
            case 'sales':
                this.showSales(content);
                break;
            case 'analytics':
                this.showAnalytics(content);
                break;
            case 'finance':
                this.showFinance(content);
                break;
            case 'settings':
                this.showDeveloperSettings(content);
                break;
        }
    },

    // Вкладка: Огляд
    async showOverview(container) {
        // Завантажуємо останні дані
        const balance = await this.app.api.get('/api/marketplace/balance');

        container.innerHTML = `
            <div class="overview-tab">
                <div class="quick-stats">
                    <div class="stat-card">
                        <h3>💰 Доступно для виплати</h3>
                        <div class="stat-value">${balance.balance.toFixed(2)}</div>
                        <button onclick="MarketplaceModule.requestWithdrawal()"
                                class="btn btn-primary"
                                ${balance.balance < 50 ? 'disabled' : ''}>
                            Запит на виплату
                        </button>
                    </div>

                    <div class="stat-card">
                        <h3>📈 Цього місяця</h3>
                        <div class="stat-value">${(balance.total_earned / 12).toFixed(2)}</div>
                        <div class="stat-change positive">+15% vs минулий</div>
                    </div>

                    <div class="stat-card">
                        <h3>📦 Активних товарів</h3>
                        <div class="stat-value">${this.developerProfile.total_products}</div>
                        <a href="#" onclick="MarketplaceModule.switchTab('products')">Управління</a>
                    </div>
                </div>

                <div class="recent-activity">
                    <h2>Останні транзакції</h2>
                    <div class="transactions-list">
                        ${balance.recent_transactions.map(t => `
                            <div class="transaction-item">
                                <div class="transaction-icon">
                                    ${t.type === 'sale' ? '💵' : t.type === 'withdrawal' ? '💳' : '📊'}
                                </div>
                                <div class="transaction-info">
                                    <div class="transaction-description">${t.description}</div>
                                    <div class="transaction-date">${new Date(t.created_at).toLocaleDateString()}</div>
                                </div>
                                <div class="transaction-amount ${t.type === 'sale' ? 'positive' : 'negative'}">
                                    ${t.type === 'sale' ? '+' : '-'}${Math.abs(t.developer_amount || t.amount).toFixed(2)}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    },

    // Вкладка: Мої товари
    async showProducts(container) {
        const products = await this.app.api.get('/api/marketplace/products');

        container.innerHTML = `
            <div class="products-tab">
                <div class="products-header">
                    <h2>Мої товари</h2>
                    <button onclick="MarketplaceModule.showCreateProduct()" class="btn btn-primary">
                        ➕ Додати товар
                    </button>
                </div>

                <div class="products-grid">
                    ${products.length === 0 ? `
                        <div class="empty-state">
                            <p>У вас ще немає товарів</p>
                            <button onclick="MarketplaceModule.showCreateProduct()" class="btn btn-primary">
                                Створити перший товар
                            </button>
                        </div>
                    ` : products.map(p => `
                        <div class="product-card">
                            <div class="product-status status-${p.status}">
                                ${this.getStatusLabel(p.status)}
                            </div>
                            <h3>${p.title.ua || p.title.en}</h3>
                            <div class="product-meta">
                                <span>💰 ${p.price}</span>
                                <span>👁️ ${p.view_count}</span>
                                <span>💵 ${p.sale_count} продажів</span>
                            </div>
                            <div class="product-revenue">
                                Дохід: ${p.revenue.toFixed(2)}
                            </div>
                            <div class="product-actions">
                                <button onclick="MarketplaceModule.editProduct(${p.id})" class="btn btn-secondary">
                                    ✏️ Редагувати
                                </button>
                                ${p.status === 'draft' || p.status === 'rejected' ? `
                                    <button onclick="MarketplaceModule.submitForReview(${p.id})" class="btn btn-primary">
                                        📤 На модерацію
                                    </button>
                                ` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    },

    // Вкладка: Продажі
    async showSales(container) {
        container.innerHTML = `
            <div class="sales-tab">
                <h2>Історія продажів</h2>

                <div class="sales-filters">
                    <select id="sales-period">
                        <option value="7">Останні 7 днів</option>
                        <option value="30" selected>Останні 30 днів</option>
                        <option value="90">Останні 90 днів</option>
                        <option value="365">Останній рік</option>
                    </select>

                    <button onclick="MarketplaceModule.exportSales()" class="btn btn-secondary">
                        📥 Експорт CSV
                    </button>
                </div>

                <div class="sales-table">
                    <table>
                        <thead>
                            <tr>
                                <th>Дата</th>
                                <th>Товар</th>
                                <th>Покупець</th>
                                <th>Сума</th>
                                <th>Комісія</th>
                                <th>Ваш дохід</th>
                            </tr>
                        </thead>
                        <tbody id="sales-tbody">
                            <!-- Тут будуть продажі -->
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        // Завантажуємо дані продажів
        this.loadSalesData();
    },

    // Вкладка: Аналітика
    showAnalytics(container) {
        container.innerHTML = `
            <div class="analytics-tab">
                <h2>Аналітика продажів</h2>

                <div class="analytics-charts">
                    <div class="chart-container">
                        <h3>Продажі за останні 30 днів</h3>
                        <canvas id="sales-chart"></canvas>
                    </div>

                    <div class="chart-container">
                        <h3>Топ товари</h3>
                        <canvas id="products-chart"></canvas>
                    </div>

                    <div class="chart-container">
                        <h3>Джерела трафіку</h3>
                        <canvas id="traffic-chart"></canvas>
                    </div>

                    <div class="chart-container">
                        <h3>Конверсія</h3>
                        <div class="conversion-funnel">
                            <div class="funnel-step">
                                <div class="funnel-bar" style="width: 100%">
                                    <span>Перегляди: 1,234</span>
                                </div>
                            </div>
                            <div class="funnel-step">
                                <div class="funnel-bar" style="width: 60%">
                                    <span>Додано в кошик: 741</span>
                                </div>
                            </div>
                            <div class="funnel-step">
                                <div class="funnel-bar" style="width: 30%">
                                    <span>Покупки: 370</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    // Вкладка: Фінанси
    async showFinance(container) {
        const balance = await this.app.api.get('/api/marketplace/balance');

        container.innerHTML = `
            <div class="finance-tab">
                <h2>Фінанси та виплати</h2>

                <div class="balance-card">
                    <h3>Поточний баланс</h3>
                    <div class="balance-amount">${balance.balance.toFixed(2)}</div>

                    <div class="balance-details">
                        <div class="detail-item">
                            <span>Загальний дохід:</span>
                            <span>${balance.total_earned.toFixed(2)}</span>
                        </div>
                        <div class="detail-item">
                            <span>Виплачено:</span>
                            <span>${balance.total_withdrawn.toFixed(2)}</span>
                        </div>
                        <div class="detail-item">
                            <span>Комісія платформи:</span>
                            <span>${(balance.commission_rate * 100).toFixed(0)}%</span>
                        </div>
                    </div>

                    <button onclick="MarketplaceModule.showWithdrawalForm()"
                            class="btn btn-primary btn-large"
                            ${balance.balance < 50 ? 'disabled' : ''}>
                        💳 Запит на виплату
                    </button>

                    ${balance.balance < 50 ? `
                        <p class="min-withdrawal-notice">
                            Мінімальна сума для виплати: $50
                        </p>
                    ` : ''}
                </div>

                <div class="withdrawal-history">
                    <h3>Історія виплат</h3>
                    <div id="withdrawals-list">
                        <!-- Тут будуть виплати -->
                    </div>
                </div>
            </div>
        `;
    },

    // Форма створення товару
    showCreateProduct() {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-overlay" onclick="this.parentElement.remove()"></div>
            <div class="modal-content">
                <h2>Створення нового товару</h2>

                <form id="create-product-form">
                    <div class="form-group">
                        <label>Код товару *</label>
                        <input type="text" id="product_code" required placeholder="unique_code_123">
                    </div>

                    <div class="form-group">
                        <label>Назва (UA) *</label>
                        <input type="text" id="title_ua" required placeholder="Назва українською">
                    </div>

                    <div class="form-group">
                        <label>Назва (EN) *</label>
                        <input type="text" id="title_en" required placeholder="Title in English">
                    </div>

                    <div class="form-group">
                        <label>Опис (UA) *</label>
                        <textarea id="description_ua" required rows="4"></textarea>
                    </div>

                    <div class="form-group">
                        <label>Опис (EN) *</label>
                        <textarea id="description_en" required rows="4"></textarea>
                    </div>

                    <div class="form-group">
                        <label>Ціна ($) *</label>
                        <input type="number" id="price" required min="1" step="0.01">
                    </div>

                    <div class="form-group">
                        <label>Категорія *</label>
                        <select id="category" required>
                            <option value="">Виберіть категорію</option>
                            <option value="Architecture">Архітектура</option>
                            <option value="Furniture">Меблі</option>
                            <option value="Plumbing">Сантехніка</option>
                            <option value="Electrical">Електрика</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label>Теги (через кому)</label>
                        <input type="text" id="tags" placeholder="revit, family, furniture">
                    </div>

                    <div class="form-group">
                        <label>Версія</label>
                        <input type="text" id="version" value="1.0.0">
                    </div>

                    <div class="modal-actions">
                        <button type="button" onclick="this.closest('.modal').remove()" class="btn btn-secondary">
                            Скасувати
                        </button>
                        <button type="submit" class="btn btn-primary">
                            Створити товар
                        </button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(modal);

        document.getElementById('create-product-form').addEventListener('submit',
            async (e) => {
                e.preventDefault();
                await this.createProduct();
            });
    },

    // Створення товару
    async createProduct() {
        const productData = {
            code: document.getElementById('product_code').value,
            title: {
                ua: document.getElementById('title_ua').value,
                en: document.getElementById('title_en').value
            },
            description: {
                ua: document.getElementById('description_ua').value,
                en: document.getElementById('description_en').value
            },
            price: parseFloat(document.getElementById('price').value),
            category: document.getElementById('category').value,
            tags: document.getElementById('tags').value.split(',').map(t => t.trim()),
            version: document.getElementById('version').value
        };

        try {
            const response = await this.app.api.post('/api/marketplace/products', productData);

            if (response.success) {
                this.app.tg.showAlert('✅ Товар успішно створено!');
                document.querySelector('.modal').remove();
                this.showProducts(document.getElementById('tab-content'));
            }
        } catch (error) {
            this.app.tg.showAlert(`❌ Помилка: ${error.message}`);
        }
    },

    // Відправка на модерацію
    async submitForReview(productId) {
        if (!confirm('Відправити товар на модерацію?')) return;

        try {
            const response = await this.app.api.post(`/api/marketplace/products/${productId}/submit`);

            if (response.success) {
                this.app.tg.showAlert('✅ Товар відправлено на модерацію');
                this.showProducts(document.getElementById('tab-content'));
            }
        } catch (error) {
            this.app.tg.showAlert(`❌ Помилка: ${error.message}`);
        }
    },

    // Форма запиту на виплату
    showWithdrawalForm() {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-overlay" onclick="this.parentElement.remove()"></div>
            <div class="modal-content">
                <h2>💳 Запит на виплату</h2>

                <form id="withdrawal-form">
                    <div class="form-group">
                        <label>Сума для виплати ($)</label>
                        <input type="number" id="withdrawal_amount" required min="50" step="0.01"
                               max="${this.developerProfile.balance}">
                        <small>Доступно: ${this.developerProfile.balance.toFixed(2)}</small>
                    </div>

                    <div class="form-group">
                        <label>Метод виплати</label>
                        <select id="payment_method" required onchange="MarketplaceModule.updatePaymentFields(this.value)">
                            <option value="">Виберіть метод</option>
                            <option value="crypto">Криптовалюта (USDT)</option>
                            <option value="bank">Банківський переказ</option>
                            <option value="paypal">PayPal</option>
                        </select>
                    </div>

                    <div id="payment-fields"></div>

                    <div class="modal-actions">
                        <button type="button" onclick="this.closest('.modal').remove()" class="btn btn-secondary">
                            Скасувати
                        </button>
                        <button type="submit" class="btn btn-primary">
                            Подати запит
                        </button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(modal);

        document.getElementById('withdrawal-form').addEventListener('submit',
            async (e) => {
                e.preventDefault();
                await this.requestWithdrawal();
            });
    },

    // Оновлення полів платежу
    updatePaymentFields(method) {
        const container = document.getElementById('payment-fields');

        switch(method) {
            case 'crypto':
                container.innerHTML = `
                    <div class="form-group">
                        <label>USDT адреса (TRC20)</label>
                        <input type="text" id="crypto_address" required placeholder="TXxx...">
                    </div>
                `;
                break;
            case 'bank':
                container.innerHTML = `
                    <div class="form-group">
                        <label>IBAN</label>
                        <input type="text" id="iban" required placeholder="UA...">
                    </div>
                    <div class="form-group">
                        <label>Отримувач</label>
                        <input type="text" id="recipient_name" required>
                    </div>
                `;
                break;
            case 'paypal':
                container.innerHTML = `
                    <div class="form-group">
                        <label>PayPal Email</label>
                        <input type="email" id="paypal_email" required>
                    </div>
                `;
                break;
        }
    },

    // Запит на виплату
    async requestWithdrawal() {
        const amount = parseFloat(document.getElementById('withdrawal_amount').value);
        const method = document.getElementById('payment_method').value;

        let paymentDetails = {};

        switch(method) {
            case 'crypto':
                paymentDetails.address = document.getElementById('crypto_address').value;
                break;
            case 'bank':
                paymentDetails.iban = document.getElementById('iban').value;
                paymentDetails.recipient = document.getElementById('recipient_name').value;
                break;
            case 'paypal':
                paymentDetails.email = document.getElementById('paypal_email').value;
                break;
        }

        try {
            const response = await this.app.api.post('/api/marketplace/withdraw', {
                amount: amount,
                payment_method: method,
                payment_details: paymentDetails
            });

            if (response.success) {
                this.app.tg.showAlert('✅ Запит на виплату успішно подано!');
                document.querySelector('.modal').remove();
                this.showFinance(document.getElementById('tab-content'));
            }
        } catch (error) {
            this.app.tg.showAlert(`❌ Помилка: ${error.message}`);
        }
    },

    // Допоміжні функції
    getStatusLabel(status) {
        const labels = {
            'draft': '📝 Чернетка',
            'pending_review': '⏳ На модерації',
            'approved': '✅ Активний',
            'rejected': '❌ Відхилено',
            'suspended': '⚠️ Призупинено'
        };
        return labels[status] || status;
    }
};