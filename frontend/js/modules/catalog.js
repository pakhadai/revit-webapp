// Модуль каталогу (СПРОЩЕНА І БЕЗПЕЧНА ВЕРСІЯ)
window.CatalogModule = {
    async getPage(app) {
        if (!window.SearchFilterModule) await app.loadScript('js/modules/search-filter.js');
        if (!window.InfiniteScrollModule) await app.loadScript('js/modules/infinite-scroll.js');

        return `
            <div class="catalog-page p-3">
                <h2 style="margin-bottom: 20px;">${app.t('navigation.catalog')}</h2>
                ${window.SearchFilterModule.renderSearchPanel(app)}
                <div style="margin: 15px 0; color: var(--tg-theme-hint-color);">
                    <span data-items-count>${app.t('catalog.loading')}</span>
                </div>
                <div id="products-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 15px; min-height: 300px;"></div>
            </div>
        `;
    },

    async initInfiniteScroll(app) {
        if (window.InfiniteScrollModule) {
            window.InfiniteScrollModule.init('#products-grid');
        }
    },

    async loadFiltered(filters, app) {
        if (window.InfiniteScrollModule) {
            window.InfiniteScrollModule.setFilters(filters);
        }
    },

    getProductCard(archive, app) {
        const { id, title, price, discount_percent, archive_type, average_rating, ratings_count } = archive;
        const lang = app.currentLang || 'ua';
        const isInCart = app.cart.some(item => item.id === id);
        const isFavorite = window.FavoritesModule.isFavorite(id);
        const displayTitle = title[lang] || title['en'] || 'No title';
        const finalPrice = discount_percent > 0 ? (price * (1 - discount_percent / 100)).toFixed(2) : price;

        let buttonHtml;
        if (isInCart) {
            buttonHtml = `<button id="product-btn-${id}" style="padding: 8px 14px; border: none; border-radius: 6px; font-size: 14px; background-color: #b0b0b0; color: #fff; cursor: not-allowed;" disabled>${app.t('buttons.inCart')}</button>`;
        } else {
            buttonHtml = `<button id="product-btn-${id}" style="padding: 8px 14px; border: none; border-radius: 6px; font-size: 14px; background-color: var(--primary-color); color: white; cursor: pointer;" onclick="window.app.addToCart(${id})">${app.t('buttons.buy')}</button>`;
        }

        const favoriteButtonSvg = isFavorite
            ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="#e74c3c" stroke="#e74c3c" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>'
            : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>';

        return `
            <div class="product-card" data-id="${id}"
                 onclick="if (!event.target.closest('button')) { window.ProductDetailsModule.show(${id}); }"
                 style="background: var(--tg-theme-bg-color); border: 1px solid var(--tg-theme-secondary-bg-color); border-radius: 12px; padding: 12px; display: flex; flex-direction: column; justify-content: space-between; cursor: pointer;">
                <div>
                    <div style="height: 120px; border-radius: 8px; margin-bottom: 10px; display: flex; align-items: center; justify-content: center; color: white; font-size: 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); position: relative;">
                        ${archive_type === 'premium' ? '💎' : '📦'}
                        ${discount_percent > 0 ? `<div style="position: absolute; top: 5px; right: 5px; background: red; color: white; padding: 2px 6px; border-radius: 4px; font-size: 12px;">-${discount_percent}%</div>` : ''}

                        <button class="favorite-btn" onclick="window.FavoritesModule.toggleFavorite(${id}, this)" style="position: absolute; top: 5px; left: 5px; background: rgba(255,255,255,0.2); border: none; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                            ${favoriteButtonSvg}
                        </button>
                    </div>
                    <h4 style="margin: 5px 0; font-size: 14px; color: var(--tg-theme-text-color); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${displayTitle}</h4>

                    <div style="margin-bottom: 10px;">
                        ${RatingsModule.renderStars(average_rating, ratings_count)}
                    </div>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: auto;">
                    <div>
                        ${discount_percent > 0 ? `<div style="font-size: 12px; text-decoration: line-through; color: var(--tg-theme-hint-color);">$${price.toFixed(2)}</div><div style="color: var(--primary-color); font-weight: bold; font-size: 16px;">$${finalPrice}</div>` : `<div style="color: var(--primary-color); font-weight: bold; font-size: 16px;">$${price.toFixed(2)}</div>`}
                    </div>
                    ${buttonHtml}
                </div>
            </div>`;
    }
};