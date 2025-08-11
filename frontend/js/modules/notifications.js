// frontend/js/modules/notifications.js
window.NotificationsModule = {
    unreadCount: 0,
    notifications: [],

    async init(app) {
        this.app = app;
        await this.loadNotifications();
        this.updateBellUI();
    },

    async loadNotifications() {
        try {
            const data = await this.app.api.get('/api/notifications/');
            this.unreadCount = data.unread_count;
            this.notifications = data.notifications;
        } catch (error) {
            console.error('Failed to load notifications:', error);
        }
    },

    updateBellUI() {
        const bell = document.getElementById('notifications-bell');
        const counter = document.getElementById('notifications-counter');
        if (!bell || !counter) return;

        counter.textContent = this.unreadCount;
        counter.style.display = this.unreadCount > 0 ? 'block' : 'none';
    },

    async showNotifications() {
        const modalId = 'notifications-modal';
        if (document.getElementById(modalId)) return;

        let itemsHtml = '';
        if (this.notifications.length === 0) {
            itemsHtml = `<p style="text-align: center; color: var(--tg-theme-hint-color);">Повідомлень немає</p>`;
        } else {
            itemsHtml = this.notifications.map(n => `
                <div class="notification-item ${n.is_read ? '' : 'unread'}" onclick="NotificationsModule.handleNotificationClick(${n.id}, ${n.related_archive_id})">
                    <p>${n.message}</p>
                    <small>${new Date(n.created_at).toLocaleString('uk-UA')}</small>
                </div>
            `).join('');
        }

        const modalHtml = `
            <div class="modal-overlay" id="${modalId}" onclick="if(event.target.id === '${modalId}') this.remove()">
                <div class="modal-content">
                    <div class="modal-header"><h3>Повідомлення</h3><button onclick="document.getElementById('${modalId}').remove()" class="modal-close-btn">&times;</button></div>
                    <div class="modal-body">${itemsHtml}</div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    },

    async handleNotificationClick(notificationId, archiveId) {
        // Позначаємо як прочитане (ця частина залишається без змін)
        const notification = this.notifications.find(n => n.id === notificationId);
        if (notification && !notification.is_read) {
            try {
                await this.app.api.post(`/api/notifications/${notificationId}/read`);
                notification.is_read = true;
                this.unreadCount--;
                this.updateBellUI();
                const itemEl = document.querySelector(`.notification-item[onclick*="handleNotificationClick(${notificationId}"]`);
                if(itemEl) itemEl.classList.remove('unread');
            } catch (error) {
                console.error("Failed to mark notification as read", error);
            }
        }

        // ✅ ОСНОВНЕ ВИПРАВЛЕННЯ ТУТ
        // Якщо є пов'язаний архів - завантажуємо модуль і відкриваємо його
        if (archiveId) {
            // Спочатку закриваємо модальне вікно сповіщень
            document.getElementById('notifications-modal').remove();

            try {
                // Перевіряємо, чи існує модуль ProductDetailsModule
                if (!window.ProductDetailsModule) {
                    // Якщо ні - завантажуємо його
                    await this.app.loadScript('js/modules/product-details.js');
                }
                // Тепер, коли ми впевнені, що модуль завантажений, викликаємо його
                window.ProductDetailsModule.show(archiveId);
            } catch (error) {
                console.error("Failed to load or show product details:", error);
                this.app.tg.showAlert("Не вдалося відкрити сторінку товару.");
            }
        }
    }
};