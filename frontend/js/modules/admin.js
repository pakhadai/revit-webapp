// Адмін модуль для RevitBot
window.AdminModule = {
    // --- DASHBOARD ---
    async getDashboard(app) {
        try {
            const dashboard = await app.api.get('/api/admin/dashboard');

            return `
                <div class="admin-page p-3">
                    <h2 style="margin-bottom: 25px; color: var(--primary-color);">📊 Адмін панель</h2>

                    <!-- Швидкі дії -->
                    <div class="admin-actions" style="margin-bottom: 30px;">
                        <h3 style="margin-bottom: 15px;">⚡ Швидкі дії</h3>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                            ${this.getActionButton('👥 Користувачі', 'Переглянути всіх користувачів', 'AdminModule.showUsers(window.app)')}
                            ${this.getActionButton('🛒 Замовлення', 'Управління замовленнями', 'AdminModule.showOrders(window.app)')}
                            ${this.getActionButton('📦 Товари', 'Управління каталогом', 'AdminModule.showArchives(window.app)')}
                            ${this.getActionButton('📊 Статистика', 'Детальна аналітика', 'AdminModule.showStats(window.app)')}
                            ${this.getActionButton('🎟️ Промокоди', 'Створити та керувати знижками', 'AdminPromoCodesModule.showPage(window.app)')}
                        </div>
                    </div>

                    <!-- Загальна статистика -->
                    <div class="stats-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 30px;">
                        ${this.getStatCard('👥 Користувачі', dashboard.total_stats.users, dashboard.recent_stats.new_users + ' нових')}
                        ${this.getStatCard('📦 Архіви', dashboard.total_stats.archives, 'товарів')}
                        ${this.getStatCard('🛒 Замовлення', dashboard.total_stats.orders, dashboard.recent_stats.new_orders + ' нових')}
                        ${this.getStatCard('💰 Дохід', '$' + dashboard.total_stats.revenue.toFixed(2), '$' + dashboard.recent_stats.revenue.toFixed(2) + ' за місяць')}
                    </div>

                    <!-- Топ товари -->
                    <div class="top-archives" style="margin-bottom: 30px;">
                        <h3 style="margin-bottom: 15px;">🔥 Популярні товари</h3>
                        <div style="background: var(--tg-theme-secondary-bg-color); border-radius: 12px; padding: 15px;">
                            ${dashboard.top_archives.map(archive => `
                                <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--tg-theme-bg-color);">
                                    <div>
                                        <strong>${archive.title}</strong>
                                        <div style="font-size: 12px; color: var(--tg-theme-hint-color);">${archive.code}</div>
                                    </div>
                                    <span style="color: var(--primary-color); font-weight: bold;">${archive.sales} продажів</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>

                <style>
                    .stats-grid .stat-card {
                        background: var(--tg-theme-bg-color);
                        border: 1px solid var(--tg-theme-secondary-bg-color);
                        border-radius: 12px;
                        padding: 20px;
                        text-align: center;
                    }
                    .stat-card h4 {
                        margin: 0 0 10px;
                        color: var(--tg-theme-hint-color);
                        font-size: 14px;
                    }
                    .stat-card .value {
                        font-size: 28px;
                        font-weight: bold;
                        color: var(--primary-color);
                        margin-bottom: 5px;
                    }
                    .stat-card .subtitle {
                        font-size: 12px;
                        color: var(--tg-theme-hint-color);
                    }
                    .action-button {
                        background: var(--tg-theme-bg-color);
                        border: 1px solid var(--tg-theme-secondary-bg-color);
                        border-radius: 12px;
                        padding: 20px;
                        cursor: pointer;
                        transition: all 0.2s;
                        text-align: center;
                    }
                    .action-button:hover {
                        background: var(--tg-theme-secondary-bg-color);
                        transform: translateY(-2px);
                    }
                </style>
            `;
        } catch (error) {
            return `<div style="text-align: center; padding: 50px;"><h3>Помилка</h3><p>Не вдалося завантажити адмін панель: ${error.message}</p></div>`;
        }
    },

    // --- СТОРІНКА КОРИСТУВАЧІВ ---
    async showUsers(app) {
        try {
            const users = await app.api.get('/api/admin/users?page=1&limit=50');

            const content = document.getElementById('app-content');
            content.innerHTML = `
                <div class="admin-users p-3">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                        <h2>👥 Користувачі (${users.pagination.total})</h2>
                        <button onclick="window.app.loadPage('admin')" style="padding: 8px 16px; background: var(--tg-theme-secondary-bg-color); border: none; border-radius: 6px; cursor: pointer;">← Назад</button>
                    </div>

                    <div class="users-list">
                        ${users.users.map(user => `
                            <div class="user-card" style="background: var(--tg-theme-bg-color); border: 1px solid var(--tg-theme-secondary-bg-color); border-radius: 12px; padding: 15px; margin-bottom: 15px;">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <div>
                                        <strong>${user.full_name}</strong>
                                        <div style="font-size: 14px; color: var(--tg-theme-hint-color);">@${user.username || 'немає'} • ID: ${user.user_id}</div>
                                        <div style="font-size: 12px; color: var(--tg-theme-hint-color);">Реєстрація: ${new Date(user.created_at).toLocaleDateString('uk-UA')}</div>
                                    </div>
                                    <div style="text-align: right;">
                                        <div style="color: var(--primary-color); font-weight: bold;">${user.bonuses} 💎</div>
                                        <div style="font-size: 12px; color: ${user.is_admin ? 'red' : 'green'};">${user.role}</div>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        } catch (error) {
            app.showError(`Помилка завантаження користувачів: ${error.message}`);
        }
    },

    // --- СТОРІНКА ЗАМОВЛЕНЬ ---
    async showOrders(app) {
        try {
            const orders = await app.api.get('/api/admin/orders?page=1&limit=20');

            const content = document.getElementById('app-content');
            content.innerHTML = `
                <div class="admin-orders p-3">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                        <h2>🛒 Замовлення (${orders.pagination.total})</h2>
                        <button onclick="window.app.loadPage('admin')" style="padding: 8px 16px; background: var(--tg-theme-secondary-bg-color); border: none; border-radius: 6px; cursor: pointer;">← Назад</button>
                    </div>

                    <div class="orders-list">
                        ${orders.orders.map(order => `
                            <div class="order-card" style="background: var(--tg-theme-bg-color); border: 1px solid var(--tg-theme-secondary-bg-color); border-radius: 12px; padding: 15px; margin-bottom: 15px;">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                                    <div>
                                        <strong>Замовлення #${order.order_id.slice(0, 8)}</strong>
                                        <div style="font-size: 14px; color: var(--tg-theme-hint-color);">Користувач: ${order.user.full_name} (@${order.user.username})</div>
                                        <div style="font-size: 12px; color: var(--tg-theme-hint-color);">${new Date(order.created_at).toLocaleDateString('uk-UA')} ${new Date(order.created_at).toLocaleTimeString('uk-UA')}</div>
                                    </div>
                                    <div style="text-align: right;">
                                        <div style="color: var(--primary-color); font-weight: bold; font-size: 18px;">$${order.total}</div>
                                        <div style="font-size: 14px; color: ${order.status === 'completed' ? 'green' : 'orange'};">${order.status}</div>
                                    </div>
                                </div>

                                <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--tg-theme-secondary-bg-color);">
                                    <strong>Товари:</strong>
                                    ${order.items.map(item => `
                                        <div style="font-size: 14px; margin: 5px 0;">
                                            • ${item.archive_title} (${item.quantity}x) - $${item.price}
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        } catch (error) {
            app.showError(`Помилка завантаження замовлень: ${error.message}`);
        }
    },

    // --- СТОРІНКА УПРАВЛІННЯ ТОВАРАМИ ---
    async showArchives(app) {
        const content = document.getElementById('app-content');
        content.innerHTML = `<div class="loader-container"><div class="loader"></div></div>`;

        try {
            const archives = await app.api.get('/api/admin/archives');

            if (!Array.isArray(archives)) {
                console.error('Неправильний формат даних:', archives);
                content.innerHTML = `
                    <div class="admin-section p-3">
                        <h2>❌ Помилка завантаження</h2>
                        <p>Отримано неправильний формат даних</p>
                        <button onclick="window.app.loadPage('admin')" class="btn btn-secondary">
                            Повернутись
                        </button>
                    </div>
                `;
                return;
            }

            content.innerHTML = `
                <div class="admin-section p-3">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                        <h2>📦 Товари (${archives.length})</h2>
                        <div>
                            <button onclick="window.AdminModule.showCreateForm(window.app)"
                                    style="padding: 10px 20px; background: var(--primary-color); color: white; border: none; border-radius: 8px; cursor: pointer;">
                                ➕ Додати товар
                            </button>
                            <button onclick="window.app.loadPage('admin')"
                                    style="padding: 10px 20px; background: var(--tg-theme-secondary-bg-color); border: none; border-radius: 8px; cursor: pointer; margin-left: 10px;">
                                ← Назад
                            </button>
                        </div>
                    </div>

                    ${archives.length === 0 ? `
                        <div style="text-align: center; padding: 40px; background: var(--tg-theme-secondary-bg-color); border-radius: 12px;">
                            <p style="font-size: 18px; margin-bottom: 20px;">Товарів поки немає</p>
                            <button onclick="window.AdminModule.showCreateForm(window.app)"
                                    style="padding: 12px 24px; background: var(--primary-color); color: white; border: none; border-radius: 8px; cursor: pointer;">
                                Додати перший товар
                            </button>
                        </div>
                    ` : `
                        <div class="archives-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 15px;">
                            ${archives.map(archive => {
                                const title = archive.title?.ua || archive.title?.en || archive.code;
                                const price = archive.price || 0;

                                // ВИПРАВЛЕННЯ: image_paths замість image_path (це масив!)
                                const hasImage = archive.image_paths && archive.image_paths.length > 0;
                                const imagePath = hasImage ? `${window.app.api.baseURL}/${archive.image_paths[0]}` : null;

                                return `
                                    <div class="archive-card" style="background: var(--tg-theme-bg-color); border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                                        ${imagePath
                                            ? `<img src="${imagePath}" alt="${title}" style="width: 100%; height: 120px; object-fit: cover;">`
                                            : `<div style="width: 100%; height: 120px; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); font-size: 40px;">
                                                ${archive.archive_type === 'premium' ? '💎' : '📦'}
                                            </div>`
                                        }
                                        <div style="padding: 10px;">
                                            <h5 style="margin: 0 0 5px; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${title}</h5>
                                            <p style="margin: 0 0 5px; color: var(--tg-theme-hint-color); font-size: 11px;">
                                                ${archive.code}
                                            </p>
                                            <p style="margin: 0 0 8px; font-size: 16px; font-weight: bold; color: var(--primary-color);">
                                                $${price}
                                            </p>
                                            <div style="display: flex; gap: 5px;">
                                                <button onclick="window.AdminModule.showEditForm(window.app, ${archive.id})"
                                                        style="flex: 1; padding: 6px; background: var(--primary-color); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
                                                    ✏️
                                                </button>
                                                <button onclick="window.AdminModule.deleteArchive(window.app, ${archive.id})"
                                                        style="flex: 1; padding: 6px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
                                                    🗑️
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    `}
                </div>
            `;
        } catch (error) {
            console.error('Load archives error:', error);
            content.innerHTML = `
                <div class="admin-section p-3">
                    <h2>❌ Помилка</h2>
                    <p>${error.message}</p>
                    <button onclick="window.app.loadPage('admin')" class="btn btn-secondary">
                        Повернутись
                    </button>
                </div>
            `;
        }
    },

    // Допоміжна функція для рендеру картки товару
    renderArchiveCard(archive) {
        const title = archive.title?.ua || archive.title?.en || archive.code;
        const image = archive.image_path || '/static/images/placeholder.png';
        const price = archive.price || 0;

        return `
            <div class="archive-card">
                <img src="${image}" alt="${title}" onerror="this.src='/static/images/placeholder.png'">
                <div class="archive-info">
                    <h4>${title}</h4>
                    <p class="archive-code">Код: ${archive.code}</p>
                    <p class="archive-price">$${price}</p>
                    <p class="archive-type">${archive.archive_type}</p>
                    <div class="archive-actions">
                        <button onclick="window.adminPanel.editArchive(${archive.id})" class="btn btn-sm btn-primary">
                            ✏️ Редагувати
                        </button>
                        <button onclick="window.adminPanel.deleteArchive(${archive.id})" class="btn btn-sm btn-danger">
                            🗑️ Видалити
                        </button>
                    </div>
                </div>
            </div>
        `;
    },

    // --- ДЕТАЛЬНА СТАТИСТИКА ---
    async showStats(app) {
        try {
            const dashboard = await app.api.get('/api/admin/dashboard');

            const content = document.getElementById('app-content');
            content.innerHTML = `
                <div class="admin-stats p-3">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px;">
                        <h2>📊 Детальна статистика</h2>
                        <button onclick="window.app.loadPage('admin')" style="padding: 8px 16px; background: var(--tg-theme-secondary-bg-color); border: none; border-radius: 6px; cursor: pointer;">← Назад</button>
                    </div>

                    <!-- Загальна статистика -->
                    <div class="stats-section" style="margin-bottom: 30px;">
                        <h3 style="margin-bottom: 15px;">🌍 Загальна статистика</h3>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                            ${this.getStatCard('👥 Всього користувачів', dashboard.total_stats.users, 'зареєстровано')}
                            ${this.getStatCard('📦 Всього товарів', dashboard.total_stats.archives, 'в каталозі')}
                            ${this.getStatCard('🛒 Всього замовлень', dashboard.total_stats.orders, 'оформлено')}
                            ${this.getStatCard('💰 Загальний дохід', '$' + dashboard.total_stats.revenue.toFixed(2), 'USD')}
                        </div>
                    </div>

                    <!-- Статистика за місяць -->
                    <div class="stats-section" style="margin-bottom: 30px;">
                        <h3 style="margin-bottom: 15px;">📅 За останні 30 днів</h3>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                            ${this.getStatCard('👥 Нові користувачі', dashboard.recent_stats.new_users, 'приєдналось')}
                            ${this.getStatCard('🛒 Нові замовлення', dashboard.recent_stats.new_orders, 'оформлено')}
                            ${this.getStatCard('💰 Дохід за місяць', '$' + dashboard.recent_stats.revenue.toFixed(2), 'USD')}
                            ${this.getStatCard('📈 Конверсія', ((dashboard.recent_stats.new_orders / Math.max(dashboard.recent_stats.new_users, 1)) * 100).toFixed(1) + '%', 'замовлень/користувач')}
                        </div>
                    </div>

                    <!-- Топ товари -->
                    <div class="stats-section">
                        <h3 style="margin-bottom: 15px;">🏆 ТОП-5 товарів за продажами</h3>
                        <div style="background: var(--tg-theme-bg-color); border: 1px solid var(--tg-theme-secondary-bg-color); border-radius: 12px; padding: 20px;">
                            ${dashboard.top_archives.length > 0 ? dashboard.top_archives.map((archive, index) => `
                                <div style="display: flex; align-items: center; justify-content: space-between; padding: 15px 0; border-bottom: ${index < dashboard.top_archives.length - 1 ? '1px solid var(--tg-theme-secondary-bg-color)' : 'none'};">
                                    <div style="display: flex; align-items: center;">
                                        <div style="background: var(--primary-color); color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; margin-right: 15px;">
                                            ${index + 1}
                                        </div>
                                        <div>
                                            <strong>${archive.title}</strong>
                                            <div style="font-size: 12px; color: var(--tg-theme-hint-color);">${archive.code}</div>
                                        </div>
                                    </div>
                                    <div style="text-align: right;">
                                        <div style="color: var(--primary-color); font-weight: bold; font-size: 18px;">${archive.sales}</div>
                                        <div style="font-size: 12px; color: var(--tg-theme-hint-color);">продажів</div>
                                    </div>
                                </div>
                            `).join('') : '<p style="text-align: center; color: var(--tg-theme-hint-color);">Поки що немає продажів</p>'}
                        </div>
                    </div>
                </div>
            `;
        } catch (error) {
            app.showError(`Помилка завантаження статистики: ${error.message}`);
        }
    },

    // --- ДОПОМІЖНІ ФУНКЦІЇ ---
    getStatCard(title, value, subtitle) {
        return `
            <div class="stat-card">
                <h4>${title}</h4>
                <div class="value">${value}</div>
                <div class="subtitle">${subtitle}</div>
            </div>
        `;
    },

    getActionButton(title, description, onclick) {
        return `
            <div class="action-button" onclick="${onclick}">
                <h4 style="margin: 0 0 8px; color: var(--primary-color);">${title}</h4>
                <p style="margin: 0; font-size: 14px; color: var(--tg-theme-hint-color);">${description}</p>
            </div>
        `;
    }
};