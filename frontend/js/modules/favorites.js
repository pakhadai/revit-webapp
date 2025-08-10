// frontend/js/modules/favorites.js

window.FavoritesModule = {
    favoriteIds: new Set(),

    async init(app) {
        this.app = app;
        await this.loadFavorites();
    },

    async loadFavorites() {
        try {
            const ids = await this.app.api.get('/api/favorites/');
            this.favoriteIds = new Set(ids);
        } catch (error) {
            console.error('Failed to load favorites:', error);
            this.favoriteIds = new Set();
        }
    },

    isFavorite(archiveId) {
        return this.favoriteIds.has(archiveId);
    },

    async toggleFavorite(archiveId, buttonElement) {
        const isCurrentlyFavorite = this.isFavorite(archiveId);

        try {
            if (isCurrentlyFavorite) {
                await this.app.api.delete(`/api/favorites/${archiveId}`);
                this.favoriteIds.delete(archiveId);
            } else {
                await this.app.api.post(`/api/favorites/${archiveId}`, {});
                this.favoriteIds.add(archiveId);
            }
            if (buttonElement) {
                this.updateButtonUI(buttonElement, !isCurrentlyFavorite);
            }
            if (this.app.tg.isAvailable && this.app.tg.HapticFeedback) {
                this.app.tg.HapticFeedback.impactOccurred('light');
            }
        } catch (error) {
            this.app.tg.showAlert('Помилка при зміні статусу "Вибраного"');
        }
    },

    updateButtonUI(button, isFavorite) {
        button.innerHTML = isFavorite
            ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="#e74c3c" stroke="#e74c3c" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>'
            : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>';
    },

    // Нова функція для відображення сторінки вибраних
    async showFavoritesPage(app) {
        const t = (key) => app.t(key);
        const content = document.getElementById('app-content');
        content.innerHTML = `<div class="loader-container"><div class="loader"></div></div>`;

        const favoriteArchives = window.app.productsCache.filter(p => this.isFavorite(p.id));

        let pageHtml = `
            <div class="favorites-page p-3">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px;">
                    <h2>Мої вибрані</h2>
                    <button onclick="window.app.loadPage('profile')" style="padding: 8px 16px; background: var(--tg-theme-secondary-bg-color); border: none; border-radius: 6px; cursor: pointer;">← Назад</button>
                </div>
        `;

        if (favoriteArchives.length === 0) {
            pageHtml += `<div style="text-align: center; padding: 50px;"><h3>Список порожній</h3><p>Додайте товари у вибране, натиснувши на сердечко.</p></div>`;
        } else {
            pageHtml += `<div id="products-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 15px;">
                ${favoriteArchives.map(archive => window.CatalogModule.getProductCard(archive, app)).join('')}
            </div>`;
        }

        pageHtml += `</div>`;
        content.innerHTML = pageHtml;
    }
};
