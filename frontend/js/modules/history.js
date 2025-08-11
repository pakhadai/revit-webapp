// frontend/js/modules/history.js
window.HistoryModule = {

    async showHistoryPage(app) {
        const content = document.getElementById('app-content');
        content.innerHTML = `<div class="loader-container"><div class="loader"></div></div>`;
        try {
            const viewedArchives = await app.api.get('/api/history/recently-viewed');
            let pageHtml = `
                <div class="history-page p-3">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px;">
                        <h2>Історія переглядів</h2>
                        <div>
                            <button onclick="HistoryModule.clearHistory()" style="padding: 8px 16px; background: var(--tg-theme-secondary-bg-color); border: none; border-radius: 6px; cursor: pointer; margin-right: 10px;">Очистити</button>
                            <button onclick="window.app.loadPage('profile')" style="padding: 8px 16px; background: var(--tg-theme-secondary-bg-color); border: none; border-radius: 6px; cursor: pointer;">←</button>
                        </div>
                    </div>`;
            if (viewedArchives.length === 0) {
                pageHtml += `<div id="history-content" style="text-align: center; padding: 50px;"><h3>Історія порожня</h3></div>`;
            } else {
                pageHtml += `<div id="history-content"><div id="products-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 15px;">
                    ${viewedArchives.map(archive => window.CatalogModule.getProductCard(archive, app)).join('')}
                </div></div>`;
            }
            pageHtml += `</div>`;
            content.innerHTML = pageHtml;
        } catch (error) {
            content.innerHTML = app.showError('Не вдалося завантажити історію.');
        }
    },

    // НОВА ФУНКЦІЯ
    async clearHistory() {
        if (!confirm("Ви впевнені, що хочете очистити історію переглядів?")) return;
        try {
            await window.app.api.delete('/api/history/clear');
            document.getElementById('history-content').innerHTML = `<div style="text-align: center; padding: 50px;"><h3>Історія порожня</h3></div>`;
        } catch (error) {
            window.app.tg.showAlert('Не вдалося очистити історію.');
        }
    },

    async trackView(archiveId) {
        try {
            await window.app.api.post(`/api/history/view/${archiveId}`);
            console.log(`Tracked view for archive ${archiveId}`);
        } catch (error) {
            console.error('Failed to track view:', error);
        }
    }
};