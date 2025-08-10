// Модуль завантажень
window.DownloadsModule = {
    currentDownload: null,
    userArchives: [],

    // Показати сторінку завантажень
    async showDownloads(app) {
        const t = (key) => app.t(key);

        try {
            // Завантажуємо список доступних архівів
            const data = await app.api.get('/api/downloads/user-archives');
            this.userArchives = data.archives;

            const content = document.getElementById('app-content');
            content.innerHTML = `
                <div class="downloads-page p-3">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px;">
                        <h2>📥 ${t('downloads.title')}</h2>
                        <button onclick="window.app.loadPage('profile')"
                                style="padding: 8px 16px; background: var(--tg-theme-secondary-bg-color); border: none; border-radius: 6px; cursor: pointer;">
                            ← ${t('buttons.back')}
                        </button>
                    </div>

                    <!-- Статистика -->
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 25px;">
                        ${this.renderStatistics(data, t)}
                    </div>

                    <!-- Фільтри -->
                    <div style="display: flex; gap: 10px; margin-bottom: 20px;">
                        <button onclick="DownloadsModule.filterArchives('all')"
                                id="filter-all"
                                style="padding: 8px 16px; background: var(--primary-color); color: white; border: none; border-radius: 6px; cursor: pointer;">
                            ${t('downloads.all')}
                        </button>
                        <button onclick="DownloadsModule.filterArchives('purchased')"
                                id="filter-purchased"
                                style="padding: 8px 16px; background: var(--tg-theme-secondary-bg-color); border: none; border-radius: 6px; cursor: pointer;">
                            ${t('downloads.purchased')}
                        </button>
                        <button onclick="DownloadsModule.filterArchives('subscription')"
                                id="filter-subscription"
                                style="padding: 8px 16px; background: var(--tg-theme-secondary-bg-color); border: none; border-radius: 6px; cursor: pointer;">
                            ${t('downloads.subscription')}
                        </button>
                        <button onclick="DownloadsModule.filterArchives('free')"
                                id="filter-free"
                                style="padding: 8px 16px; background: var(--tg-theme-secondary-bg-color); border: none; border-radius: 6px; cursor: pointer;">
                            ${t('downloads.free')}
                        </button>
                    </div>

                    <!-- Список архівів -->
                    <div id="archives-list">
                        ${this.renderArchivesList(data.archives, app)}
                    </div>
                </div>
            `;
        } catch (error) {
            app.tg.showAlert(`❌ ${t('errors.loadingDownloads')}: ${error.message}`);
        }
    },

    // Рендер статистики
    renderStatistics(data, t) {
        const stats = [
            {
                value: data.total,
                label: t('downloads.totalArchives'),
                color: '#667eea',
                icon: '📚'
            }
        ];

        return stats.map(stat => `
            <div style="background: ${stat.color}20; border: 1px solid ${stat.color}; border-radius: 12px; padding: 15px; text-align: center;">
                <div style="font-size: 24px; margin-bottom: 5px;">${stat.icon}</div>
                <div style="font-size: 28px; font-weight: bold; color: ${stat.color};">
                    ${stat.value}
                </div>
                <div style="font-size: 12px; color: #666;">
                    ${stat.label}
                </div>
            </div>
        `).join('');
    },

    // Рендер списку архівів
    renderArchivesList(archives, app) {
        const t = (key) => app.t(key);
        const lang = app.currentLang || 'ua';

        if (!archives || archives.length === 0) {
            return `
                <div style="text-align: center; padding: 50px;">
                    <div style="font-size: 60px; margin-bottom: 20px;">📦</div>
                    <h3>${t('downloads.noArchives')}</h3>
                    <p style="color: var(--tg-theme-hint-color); margin-bottom: 20px;">
                        ${t('downloads.getArchives')}
                    </p>
                    <button onclick="window.app.loadPage('catalog')"
                            style="padding: 12px 24px; background: var(--primary-color); color: white; border: none; border-radius: 8px; cursor: pointer;">
                        🛒 ${t('downloads.goToCatalog')}
                    </button>
                </div>
            `;
        }

        return `
            <div style="display: flex; flex-direction: column; gap: 15px;">
                ${archives.map(item => {
                    const title = item.archive.title[lang] || item.archive.title['en'] || item.archive.title['ua'];
                    const accessBadge = this.getAccessBadge(item.access_type, t);

                    return `
                        <div class="archive-download-card" data-type="${item.access_type}" style="background: var(--tg-theme-bg-color); border: 1px solid var(--tg-theme-secondary-bg-color); border-radius: 12px; padding: 15px;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div style="flex: 1;">
                                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                                        <div style="font-size: 32px;">
                                            ${item.archive.type === 'premium' ? '💎' : '📦'}
                                        </div>
                                        <div>
                                            <h4 style="margin: 0;">
                                                ${title}
                                            </h4>
                                            <div style="font-size: 12px; color: var(--tg-theme-hint-color);">
                                                ${item.archive.code}
                                            </div>
                                        </div>
                                    </div>

                                    <div style="display: flex; gap: 10px; align-items: center;">
                                        ${accessBadge}
                                        ${item.purchased_at ? `
                                            <span style="font-size: 12px; color: var(--tg-theme-hint-color);">
                                                ${t('downloads.purchasedOn')}: ${new Date(item.purchased_at).toLocaleDateString(lang === 'ua' ? 'uk-UA' : 'en-US')}
                                            </span>
                                        ` : ''}
                                        ${item.unlocked_at ? `
                                            <span style="font-size: 12px; color: var(--tg-theme-hint-color);">
                                                ${t('downloads.unlockedOn')}: ${new Date(item.unlocked_at).toLocaleDateString(lang === 'ua' ? 'uk-UA' : 'en-US')}
                                            </span>
                                        ` : ''}
                                    </div>
                                </div>

                                <div style="display: flex; gap: 10px;">
                                    <button onclick="DownloadsModule.showPreview(${item.archive.id})"
                                            style="padding: 8px 12px; background: var(--tg-theme-secondary-bg-color); border: none; border-radius: 6px; cursor: pointer; font-size: 14px;"
                                            title="${t('downloads.preview')}">
                                        👁️ ${t('buttons.preview')}
                                    </button>
                                    <button onclick="DownloadsModule.downloadArchive(${item.archive.id})"
                                            style="padding: 8px 16px; background: var(--primary-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 600;">
                                        📥 ${t('buttons.download')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    },

    // Отримати бейдж доступу
    getAccessBadge(type, t) {
        const badges = {
            'free': {
                color: '#4caf50',
                text: t('downloads.free'),
                icon: '🆓'
            },
            'purchased': {
                color: '#2196f3',
                text: t('downloads.purchased'),
                icon: '💰'
            },
            'subscription': {
                color: '#9c27b0',
                text: t('downloads.subscription'),
                icon: '⭐'
            }
        };

        const badge = badges[type] || badges['free'];

        return `
            <span style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; background: ${badge.color}20; color: ${badge.color}; border: 1px solid ${badge.color}; border-radius: 4px; font-size: 12px; font-weight: 600;">
                ${badge.icon} ${badge.text}
            </span>
        `;
    },

    // Фільтрувати архіви
    filterArchives(type) {
        // Оновлюємо активну кнопку
        document.querySelectorAll('[id^="filter-"]').forEach(btn => {
            btn.style.background = 'var(--tg-theme-secondary-bg-color)';
            btn.style.color = 'var(--tg-theme-text-color)';
        });

        const activeBtn = document.getElementById(`filter-${type}`);
        if (activeBtn) {
            activeBtn.style.background = 'var(--primary-color)';
            activeBtn.style.color = 'white';
        }

        // Фільтруємо картки
        const cards = document.querySelectorAll('.archive-download-card');
        cards.forEach(card => {
            if (type === 'all') {
                card.style.display = 'block';
            } else {
                card.style.display = card.dataset.type === type ? 'block' : 'none';
            }
        });
    },

    // Завантажити архів
    async downloadArchive(archiveId) {
        const app = window.app;
        const t = (key) => app.t(key);

        try {
            // Показуємо модальне вікно завантаження
            this.showDownloadModal(archiveId, app);

            // Запитуємо токен завантаження
            const response = await app.api.get(`/api/downloads/request/${archiveId}`);

            if (response.success) {
                // Оновлюємо модальне вікно з інформацією
                this.updateDownloadModal(response, app);

                // Починаємо завантаження
                this.startDownload(response.download_url, response.archive.code);
            } else {
                throw new Error(response.message || 'Failed to get download link');
            }

        } catch (error) {
            this.closeDownloadModal();
            app.tg.showAlert(`❌ ${t('downloads.error')}: ${error.message}`);
        }
    },

    // Показати модальне вікно завантаження
    showDownloadModal(archiveId, app) {
        const t = (key) => app.t(key);

        const modalHtml = `
            <div id="download-modal" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 20px;">
                <div style="background: white; border-radius: 20px; max-width: 400px; width: 100%; padding: 30px; text-align: center;">
                    <div class="download-spinner" style="width: 60px; height: 60px; margin: 0 auto 20px; border: 4px solid #f3f3f3; border-top: 4px solid var(--primary-color); border-radius: 50%; animation: spin 1s linear infinite;"></div>

                    <h3 style="margin: 0 0 10px;">${t('downloads.preparing')}</h3>
                    <p style="color: var(--tg-theme-hint-color); margin: 0;">
                        ${t('downloads.pleaseWait')}
                    </p>
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
    },

    // Оновити модальне вікно
    updateDownloadModal(data, app) {
        const t = (key) => app.t(key);
        const lang = app.currentLang || 'ua';
        const title = data.archive.title[lang] || data.archive.title['en'];

        const modal = document.getElementById('download-modal');
        if (!modal) return;

        const content = modal.querySelector('div > div');
        content.innerHTML = `
            <div style="font-size: 60px; margin-bottom: 20px;">📦</div>

            <h3 style="margin: 0 0 15px;">${title}</h3>

            <div style="background: #f8f9fa; border-radius: 10px; padding: 15px; margin-bottom: 20px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                    <span style="color: #666; font-size: 14px;">${t('downloads.filename')}:</span>
                    <span style="font-weight: 600; font-size: 14px;">${data.file.filename}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span style="color: #666; font-size: 14px;">${t('downloads.filesize')}:</span>
                    <span style="font-weight: 600; font-size: 14px;">${data.file.size_mb} MB</span>
                </div>
            </div>

            <div style="display: flex; gap: 10px;">
                <button onclick="DownloadsModule.startDownload('${data.download_url}', '${data.archive.code}')"
                        style="flex: 1; padding: 15px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 10px; font-size: 16px; font-weight: bold; cursor: pointer;">
                    📥 ${t('downloads.startDownload')}
                </button>
                <button onclick="DownloadsModule.closeDownloadModal()"
                        style="padding: 15px 20px; background: #e0e0e0; color: #666; border: none; border-radius: 10px; cursor: pointer;">
                    ${t('buttons.cancel')}
                </button>
            </div>

            <div style="margin-top: 15px; padding: 10px; background: #fff3cd; border-radius: 8px;">
                <p style="margin: 0; font-size: 12px; color: #856404;">
                    ⚠️ ${t('downloads.notice')}
                </p>
            </div>
        `;
    },

    // Почати завантаження
    startDownload(url, filename) {
        // Створюємо тимчасове посилання для завантаження
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Показуємо повідомлення
        this.showDownloadSuccess();
    },

    // Показати успіх завантаження
    showDownloadSuccess() {
        const app = window.app;
        const t = (key) => app.t(key);

        this.closeDownloadModal();

        const successHtml = `
            <div id="download-success" style="position: fixed; top: 20px; right: 20px; background: #4caf50; color: white; padding: 15px 20px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); z-index: 10000; animation: slideIn 0.3s ease-out;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 24px;">✅</span>
                    <div>
                        <div style="font-weight: 600;">
                            ${t('downloads.successTitle')}
                        </div>
                        <div style="font-size: 12px; opacity: 0.9;">
                            ${t('downloads.successMessage')}
                        </div>
                    </div>
                </div>
            </div>

            <style>
                @keyframes slideIn {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
            </style>
        `;

        document.body.insertAdjacentHTML('beforeend', successHtml);

        // Видаляємо через 5 секунд
        setTimeout(() => {
            const success = document.getElementById('download-success');
            if (success) {
                success.style.animation = 'slideIn 0.3s ease-out reverse';
                setTimeout(() => success.remove(), 300);
            }
        }, 5000);
    },

    // Показати превью архіву
    async showPreview(archiveId) {
        const app = window.app;
        const t = (key) => app.t(key);

        try {
            const response = await app.api.get(`/api/downloads/preview/${archiveId}`);

            if (response.success) {
                this.showPreviewModal(response, app);
            } else {
                app.tg.showAlert(`ℹ️ ${t('downloads.previewNotAvailable')}`);
            }

        } catch (error) {
            app.tg.showAlert(`❌ ${t('downloads.previewError')}: ${error.message}`);
        }
    },

    // Показати модальне вікно превью
    showPreviewModal(data, app) {
        const t = (key) => app.t(key);
        const lang = app.currentLang || 'ua';
        const title = data.archive.title[lang] || data.archive.title['en'];

        const modalHtml = `
            <div id="preview-modal" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 20px;">
                <div style="background: white; border-radius: 20px; max-width: 600px; width: 100%; max-height: 80vh; display: flex; flex-direction: column;">
                    <!-- Заголовок -->
                    <div style="padding: 20px; border-bottom: 1px solid #eee;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <h3 style="margin: 0;">
                                📁 ${title}
                            </h3>
                            <button onclick="DownloadsModule.closePreviewModal()"
                                    style="background: none; border: none; font-size: 24px; cursor: pointer; color: #999;">
                                ×
                            </button>
                        </div>
                    </div>

                    <!-- Контент -->
                    <div style="flex: 1; overflow-y: auto; padding: 20px;">
                        <pre style="font-family: 'Courier New', monospace; font-size: 12px; line-height: 1.5; white-space: pre-wrap; word-break: break-all; margin: 0;">
${this.escapeHtml(data.preview)}
                        </pre>
                    </div>

                    <!-- Футер -->
                    <div style="padding: 20px; border-top: 1px solid #eee;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-size: 12px; color: #666;">
                                ${t('downloads.previewInfo')}
                            </span>
                            <button onclick="DownloadsModule.downloadFromPreview(${data.archive.id})"
                                    style="padding: 10px 20px; background: var(--primary-color); color: white; border: none; border-radius: 8px; cursor: pointer;">
                                📥 ${t('buttons.download')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
    },

    // Завантажити з превью
    downloadFromPreview(archiveId) {
        this.closePreviewModal();
        this.downloadArchive(archiveId);
    },

    // Закрити модальні вікна
    closeDownloadModal() {
        const modal = document.getElementById('download-modal');
        if (modal) modal.remove();
    },

    closePreviewModal() {
        const modal = document.getElementById('preview-modal');
        if (modal) modal.remove();
    },

    // Екранування HTML
    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }
};
