// frontend/js/modules/product-details.js - ОНОВЛЕНА ВЕРСІЯ З КОМЕНТАРЯМИ

window.ProductDetailsModule = {

    async show(archiveId) {
        // Завантажуємо необхідні модулі
        if (!window.HistoryModule) await window.app.loadScript('js/modules/history.js');
        if (!window.RatingsModule) await window.app.loadScript('js/modules/ratings.js');
        if (!window.CommentsModule) await window.app.loadScript('js/modules/comments.js');

        const archive = window.app.productsCache.find(p => p.id === archiveId);
        if (!archive) {
            window.app.tg.showAlert('Помилка: не вдалося знайти дані про товар.');
            return;
        }

        // Трекаємо перегляд
        window.HistoryModule.trackView(archiveId);

        // Завантажуємо коментарі
        const commentsData = await window.CommentsModule.loadComments(archiveId);
        const commentsCount = commentsData.total || 0;

        const app = window.app;
        const lang = app.currentLang || 'ua';
        const displayTitle = archive.title[lang] || archive.title['en'] || 'No title';
        const displayDescription = archive.description[lang] || archive.description['en'] || 'Опис відсутній.';

        const modalId = 'product-details-modal';
        this.close();

        // Визначаємо чи є зображення
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

                        <!-- Рейтинг -->
                        <div style="text-align: center; margin-bottom: 20px;">
                            <p style="margin: 0 0 10px; color: var(--tg-theme-hint-color);">Оцініть цей архів:</p>
                            ${RatingsModule.renderInteractiveStars(archiveId)}
                        </div>

                        <!-- Опис -->
                        <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">${displayDescription}</p>

                        <!-- Інформація про товар -->
                        <div style="background: var(--tg-theme-secondary-bg-color); border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                                <div>
                                    <span style="color: var(--tg-theme-hint-color); font-size: 12px;">Код:</span>
                                    <div style="font-weight: 600;">${archive.code}</div>
                                </div>
                                <div>
                                    <span style="color: var(--tg-theme-hint-color); font-size: 12px;">Тип:</span>
                                    <div style="font-weight: 600;">${archive.archive_type === 'premium' ? 'Premium 💎' : 'Безкоштовний 🆓'}</div>
                                </div>
                                <div>
                                    <span style="color: var(--tg-theme-hint-color); font-size: 12px;">Ціна:</span>
                                    <div style="font-weight: 600; color: var(--primary-color);">
                                        ${archive.discount_percent > 0
                                            ? `<span style="text-decoration: line-through; color: var(--tg-theme-hint-color);">$${archive.price.toFixed(2)}</span> $${(archive.price * (1 - archive.discount_percent / 100)).toFixed(2)}`
                                            : `$${archive.price.toFixed(2)}`
                                        }
                                    </div>
                                </div>
                                <div>
                                    <span style="color: var(--tg-theme-hint-color); font-size: 12px;">Рейтинг:</span>
                                    <div>${RatingsModule.renderStars(archive.average_rating, archive.ratings_count)}</div>
                                </div>
                            </div>
                        </div>

                        <!-- Кнопка коментарів -->
                        <button
                            onclick="CommentsModule.showComments(${archiveId})"
                            style="width: 100%; padding: 12px; background: var(--tg-theme-secondary-bg-color); border: none; border-radius: 8px; margin-bottom: 15px; cursor: pointer; display: flex; justify-content: center; align-items: center; gap: 10px; font-size: 16px; font-weight: 600;"
                        >
                            <span>💬 ${app.t('comments.title')}</span>
                            ${commentsCount > 0 ? `<span style="background: var(--primary-color); color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px;">${commentsCount}</span>` : ''}
                        </button>
                    </div>
                    <div class="modal-footer">
                         <button onclick="window.app.addToCart(${archive.id}); ProductDetailsModule.close();" class="modal-apply-btn">
                            🛒 Додати в кошик
                         </button>
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