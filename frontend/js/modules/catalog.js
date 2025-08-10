// Модуль каталогу з підтримкою мультимовності
window.CatalogModule = {
    // Отримати сторінку каталогу
    async getPage(app) {
        // Завантажуємо модуль пошуку, якщо ще не завантажений
        if (!window.SearchFilterModule) {
            await app.loadScript('js/modules/search-filter.js');
        }

        const t = (key) => app.t(key);

        // Спочатку показуємо скелетони
        const searchPanelHtml = window.SearchFilterModule.renderSearchPanel(app);
        const skeletonHtml = this.renderSkeletonGrid(app);

        // Запускаємо завантаження даних у фоні
        this.loadInitialData(app);

        return `
            <div class="catalog-page p-3">
                <h2 style="margin-bottom: 20px;">${t('navigation.catalog')}</h2>

                ${searchPanelHtml}

                <div id="products-count" style="margin-bottom: 15px; color: var(--tg-theme-hint-color); display: none;">
                    ${t('catalog.foundProducts')}: <strong id="products-count-value">0</strong>
                </div>

                <div id="products-grid">
                    ${skeletonHtml}
                </div>
            </div>
        `;
    },

    // Асинхронне завантаження початкових даних
    async loadInitialData(app) {
        try {
            const archives = await app.api.get('/api/archives/');
            app.productsCache = archives;

            const gridSection = document.getElementById('products-grid');
            const countElement = document.getElementById('products-count');
            const countValueElement = document.getElementById('products-count-value');

            if (!gridSection) return; // Якщо користувач вже пішов зі сторінки

            if (!archives || archives.length === 0) {
                 gridSection.innerHTML = `
                    <div style="text-align: center; padding: 50px; grid-column: 1 / -1;">
                        <h3>${app.t('catalog.empty')}</h3>
                        <p style="color: var(--tg-theme-hint-color);">${app.t('catalog.tryChangeSearch')}</p>
                    </div>
                `;
            } else {
                const productCards = archives.map(archive => this.getProductCard(archive, app)).join('');
                gridSection.innerHTML = productCards;
            }

            if (countElement && countValueElement) {
                countValueElement.innerText = archives.length;
                countElement.style.display = 'block';
            }

        } catch (error) {
            const gridSection = document.getElementById('products-grid');
            if(gridSection) {
                gridSection.innerHTML = app.showError(`${app.t('errors.loadCatalog')}: ${error.message}`);
            }
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

    renderSkeletonGrid(app) {
        const skeletonCard = `
            <div class="skeleton-card">
                <div class="skeleton-image shimmer"></div>
                <div class="skeleton-text shimmer"></div>
                <div class="skeleton-text skeleton-text-short shimmer"></div>
                <div class="skeleton-footer">
                    <div class="skeleton-price shimmer"></div>
                    <div class="skeleton-button shimmer"></div>
                </div>
            </div>
        `;
        return `<div class="skeleton-grid">${skeletonCard.repeat(6)}</div>`;
    },

    // Завантаження відфільтрованого каталогу
    async loadFiltered(filters, app) {
        const gridSection = document.getElementById('products-grid');
        if (!gridSection) return;

        // Показуємо скелетони
        gridSection.innerHTML = this.renderSkeletonGrid(app);

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
            const countElement = document.getElementById('products-count');
            const countValueElement = document.getElementById('products-count-value');
            if (countElement && countValueElement) {
                countValueElement.innerText = archives.length;
                countElement.style.display = 'block';
            }

            // Оновлюємо товари
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

        } catch (error) {
            console.error('Filter error:', error);
            app.tg.showAlert(`${app.t('errors.filterError')}: ${error.message}`);
            if (gridSection) {
                 gridSection.innerHTML = app.showError(`${app.t('errors.filterError')}: ${error.message}`);
            }
        }
    }
};