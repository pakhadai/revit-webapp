// Модуль каталогу з підтримкою мультимовності
window.CatalogModule = {
    // Отримати сторінку каталогу
    async getPage(app) {
        // Завантажуємо модуль пошуку, якщо ще не завантажений
        if (!window.SearchFilterModule) {
            await app.loadScript('js/modules/search-filter.js');
        }

        try {
            // Початкове завантаження без фільтрів
            const archives = await app.api.get('/api/archives/');
            app.productsCache = archives;

            const lang = app.currentLang || 'ua';

            if (!archives || archives.length === 0) {
                return `
                    <div class="catalog-page p-3">
                        <h2 style="margin-bottom: 20px;">${app.t('navigation.catalog')}</h2>
                        ${window.SearchFilterModule.renderSearchPanel(app)}
                        <div style="text-align: center; padding: 50px;">
                            <h3>${app.t('catalog.empty')}</h3>
                            <p style="color: var(--tg-theme-hint-color);">${app.t('catalog.tryChangeSearch')}</p>
                        </div>
                    </div>
                `;
            }

            const productCards = archives.map(archive => this.getProductCard(archive, app)).join('');

            return `
                <div class="catalog-page p-3">
                    <h2 style="margin-bottom: 20px;">${app.t('navigation.catalog')}</h2>

                    <!-- Панель пошуку та фільтрів -->
                    ${window.SearchFilterModule.renderSearchPanel(app)}

                    <!-- Кількість знайдених товарів -->
                    <div style="margin-bottom: 15px; color: var(--tg-theme-hint-color);">
                        ${app.t('catalog.foundProducts')}: <strong>${archives.length}</strong>
                    </div>

                    <!-- Сітка товарів -->
                    <div id="products-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 15px;">
                        ${productCards}
                    </div>
                </div>
            `;
        } catch (error) {
            return app.showError(`${app.t('errors.loadCatalog')}: ${error.message}`);
        }
    },

    // Картка товару з мультимовністю
    getProductCard(archive, app) {
        const { id, title, description, price, discount_percent, archive_type } = archive;
        const lang = app.currentLang || 'ua';
        const isInCart = app.cart.some(item => item.id === id);

        // Обираємо назву та опис відповідно до мови
        const displayTitle = title[lang] || title['en'] || title['ua'] || 'No title';
        const displayDescription = description[lang] || description['en'] || description['ua'] || '';

        // Розраховуємо ціну зі знижкою
        const finalPrice = discount_percent > 0
            ? (price * (1 - discount_percent / 100)).toFixed(2)
            : price;

        const buttonStyle = `padding: 6px 12px; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500;`;

        let buttonHtml;
        if (isInCart) {
            buttonHtml = `
                <button
                    id="product-btn-${id}"
                    style="${buttonStyle} background-color: #b0b0b0; color: #fff; cursor: not-allowed;"
                    disabled>
                    ${app.t('buttons.inCart')}
                </button>`;
        } else {
            buttonHtml = `
                <button
                    id="product-btn-${id}"
                    style="${buttonStyle} background-color: var(--primary-color); color: white;"
                    onclick="window.app.addToCart(${id})">
                    ${app.t('buttons.buy')}
                </button>`;
        }

        return `
            <div class="product-card" style="background: var(--tg-theme-bg-color); border: 1px solid var(--tg-theme-secondary-bg-color); border-radius: 12px; padding: 12px; display: flex; flex-direction: column; justify-content: space-between; transition: transform 0.2s; cursor: pointer;"
                 onmouseover="this.style.transform='translateY(-2px)'"
                 onmouseout="this.style.transform='translateY(0)'">
                <div>
                    <!-- Зображення/Іконка -->
                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); height: 120px; border-radius: 8px; margin-bottom: 10px; display: flex; align-items: center; justify-content: center; color: white; font-size: 40px; position: relative;">
                        ${archive_type === 'premium' ? '💎' : '📦'}

                        <!-- Бейдж знижки -->
                        ${discount_percent > 0 ? `
                            <div style="position: absolute; top: 5px; right: 5px; background: red; color: white; padding: 2px 6px; border-radius: 4px; font-size: 12px; font-weight: bold;">
                                -${discount_percent}%
                            </div>
                        ` : ''}
                    </div>

                    <!-- Назва -->
                    <h4 style="margin: 0 0 5px; font-size: 14px; color: var(--tg-theme-text-color); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        ${displayTitle}
                    </h4>

                    <!-- Короткий опис -->
                    ${displayDescription ? `
                        <p style="margin: 0 0 10px; font-size: 12px; color: var(--tg-theme-hint-color); overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">
                            ${displayDescription}
                        </p>
                    ` : ''}
                </div>

                <!-- Ціна та кнопка -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
                    <div>
                        ${discount_percent > 0 ? `
                            <div style="font-size: 12px; text-decoration: line-through; color: var(--tg-theme-hint-color);">$${price}</div>
                            <div style="color: var(--primary-color); font-weight: bold; font-size: 16px;">$${finalPrice}</div>
                        ` : `
                            <div style="color: var(--primary-color); font-weight: bold; font-size: 16px;">$${price}</div>
                        `}
                    </div>
                    ${buttonHtml}
                </div>
            </div>`;
    },

    // Завантаження відфільтрованого каталогу
    async loadFiltered(filters, app) {
        const catalogSection = document.querySelector('.catalog-page');
        if (!catalogSection) return;

        // Показуємо лоадер
        const gridSection = document.getElementById('products-grid');
        if (gridSection) {
            gridSection.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 50px;">
                    <div class="loader"></div>
                    <p style="margin-top: 10px; color: var(--tg-theme-hint-color);">${app.t('catalog.loading')}</p>
                </div>`;
        }

        try {
            // Формуємо параметри запиту
            const params = new URLSearchParams();
            if (filters.search) params.append('search', filters.search);
            if (filters.archive_type) params.append('archive_type', filters.archive_type);
            if (filters.min_price !== null) params.append('min_price', filters.min_price);
            if (filters.max_price !== null) params.append('max_price', filters.max_price);
            if (filters.sort_by) params.append('sort_by', filters.sort_by);
            if (filters.sort_order) params.append('sort_order', filters.sort_order);

            // Запит з фільтрами
            const archives = await app.api.get(`/api/archives/?${params.toString()}`);
            app.productsCache = archives;

            // Оновлюємо кількість
            const countElement = catalogSection.querySelector('div[style*="margin-bottom: 15px"]');
            if (countElement) {
                countElement.innerHTML = `${app.t('catalog.foundProducts')}: <strong>${archives.length}</strong>`;
            }

            // Оновлюємо товари
            if (gridSection) {
                if (archives.length === 0) {
                    gridSection.innerHTML = `
                        <div style="grid-column: 1/-1; text-align: center; padding: 50px;">
                            <h3>${app.t('catalog.notFound')}</h3>
                            <p style="color: var(--tg-theme-hint-color);">${app.t('catalog.tryChangeSearch')}</p>
                        </div>
                    `;
                } else {
                    const productCards = archives.map(archive => this.getProductCard(archive, app)).join('');
                    gridSection.innerHTML = productCards;
                }
            }

        } catch (error) {
            console.error('Filter error:', error);
            app.tg.showAlert(`${app.t('errors.filterError')}: ${error.message}`);
        }
    }
};