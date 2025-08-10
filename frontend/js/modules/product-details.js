// frontend/js/modules/product-details.js

window.ProductDetailsModule = {

    async show(archiveId) {
        if (!window.HistoryModule) await window.app.loadScript('js/modules/history.js');
        if (!window.RatingsModule) await window.app.loadScript('js/modules/ratings.js');

        const archive = window.app.productsCache.find(p => p.id === archiveId);
        if (!archive) {
            window.app.tg.showAlert('Помилка: не вдалося знайти дані про товар.');
            return;
        }

        window.HistoryModule.trackView(archiveId);

        const app = window.app;
        const lang = app.currentLang || 'ua';
        const displayTitle = archive.title[lang] || archive.title['en'] || 'No title';
        const displayDescription = archive.description[lang] || archive.description['en'] || 'Опис відсутній.';

        const modalId = 'product-details-modal';
        this.close();

        // ВИПРАВЛЕННЯ: Додаємо логіку для відображення зображення або іконки
        const hasRealImage = archive.image_path && !archive.image_path.includes('placeholder.png');
        const imageAreaHtml = hasRealImage
            ? `<img src="${archive.image_path}" alt="${displayTitle}" style="width: 100%; height: 180px; border-radius: 8px; object-fit: cover; margin-bottom: 20px;">`
            : `<div style="height: 180px; border-radius: 8px; margin-bottom: 20px; display: flex; align-items: center; justify-content: center; color: white; font-size: 60px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">${archive.archive_type === 'premium' ? '💎' : '📦'}</div>`;

        const modalHtml = `
            <div class="modal-overlay" id="${modalId}" onclick="if(event.target.id === '${modalId}') ProductDetailsModule.close()">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>${displayTitle}</h3>
                        <button onclick="ProductDetailsModule.close()" class="modal-close-btn">&times;</button>
                    </div>
                    <div class="modal-body">
                        ${imageAreaHtml}

                        <div style="text-align: center; margin-bottom: 20px;">
                            <p style="margin: 0 0 10px; color: var(--tg-theme-hint-color);">Оцініть цей архів:</p>
                            ${RatingsModule.renderInteractiveStars(archiveId)}
                        </div>

                        <p style="font-size: 16px; line-height: 1.6;">${displayDescription}</p>
                    </div>
                    <div class="modal-footer">
                         <button onclick="window.app.addToCart(${archive.id}); ProductDetailsModule.close();" class="modal-apply-btn">Додати в кошик</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    },

    close() {
        const modal = document.getElementById('product-details-modal');
        if (modal) modal.remove();
    }
};