// Модуль Infinite Scroll (З ПІДТРИМКОЮ КЕШУВАННЯ)
window.InfiniteScrollModule = {
    config: {
        threshold: 300,
        itemsPerPage: 12
    },
    state: {
        isLoading: false,
        hasMore: true,
        currentPage: 1,
        filters: {},
        container: null,
        loader: null,
        loadedItems: []
    },

    init(containerSelector) {
        this.state.container = document.querySelector(containerSelector);
        if (!this.state.container) return;
        this.createLoader();
        window.addEventListener('scroll', () => this.handleScroll(), { passive: true });
        this.loadInitialData();
    },

    createLoader() {
        const loaderHtml = `<div id="infinite-scroll-loader" style="display: none; text-align: center; padding: 20px; grid-column: 1 / -1;"><div class="loader" style="width: 40px; height: 40px; margin: 0 auto 10px; border: 3px solid #f3f3f3; border-top: 3px solid var(--primary-color); border-radius: 50%; animation: spin 1s linear infinite;"></div></div>`;
        this.state.container.insertAdjacentHTML('beforeend', loaderHtml);
        this.state.loader = document.getElementById('infinite-scroll-loader');
    },

    handleScroll() {
        if (this.state.isLoading || !this.state.hasMore) return;
        const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
        if (scrollTop + clientHeight >= scrollHeight - this.config.threshold) {
            this.loadNextPage();
        }
    },

    async loadInitialData() {
        this.state.currentPage = 1;
        this.state.hasMore = true;
        this.state.loadedItems = [];
        window.app.productsCache = [];
        this.state.container.innerHTML = '';
        this.createLoader();
        await this.loadPage(1);
    },

    async loadNextPage() {
        if (this.state.isLoading || !this.state.hasMore) return;
        await this.loadPage(this.state.currentPage + 1);
    },

    async loadPage(page) {
        if (this.state.isLoading) return;
        this.state.isLoading = true;
        if (this.state.loader) this.state.loader.style.display = 'block';

        try {
            const cleanFilters = {};
            for (const key in this.state.filters) {
                const value = this.state.filters[key];
                if (value !== null && value !== undefined && value !== '') {
                    cleanFilters[key] = value;
                }
            }

            const params = new URLSearchParams({ page, limit: this.config.itemsPerPage, ...cleanFilters });

            // ЗМІНА: Вмикаємо кеш тільки для першої сторінки
            const options = (page === 1) ? { useCache: true, ttl: 300 } : {};
            const response = await window.app.api.get(`/api/archives/paginated/list?${params}`, options);

            if (response && response.items) {
                this.state.loadedItems.push(...response.items);
                window.app.productsCache.push(...response.items);

                const fragment = document.createDocumentFragment();
                response.items.forEach(item => {
                    const div = document.createElement('div');
                    div.innerHTML = window.CatalogModule.getProductCard(item, window.app);
                    fragment.appendChild(div.firstElementChild);
                });
                this.state.loader.before(fragment);

                this.state.currentPage = response.page;
                this.state.hasMore = response.has_more;
                this.updateItemsCount(response.total);

                if (!response.has_more && response.total > 0) this.showEndMessage();
                if (response.total === 0) this.showEmptyMessage();
            }
        } catch (error) {
            console.error('Infinite scroll error:', error);
            this.showError();
        } finally {
            this.state.isLoading = false;
            if (this.state.loader) this.state.loader.style.display = 'none';
        }
    },

    updateItemsCount(total) {
        const countElement = document.querySelector('[data-items-count]');
        if (countElement) countElement.innerHTML = `${window.app.t('catalog.foundProducts')}: <strong>${total}</strong>`;
    },

    showEndMessage() {
        if (document.querySelector('.end-message')) return;
        const messageHtml = `<div class="end-message" style="grid-column: 1 / -1; text-align: center; padding: 30px; color: var(--tg-theme-hint-color);">✨<p>Це всі товари</p></div>`;
        this.state.container.insertAdjacentHTML('beforeend', messageHtml);
    },

    showEmptyMessage() {
        this.state.container.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; padding: 50px;"><h3>${window.app.t('catalog.notFound')}</h3><p style="color: var(--tg-theme-hint-color);">${window.app.t('catalog.tryChangeSearch')}</p></div>`;
    },

    showError() {
        this.state.container.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; padding: 20px; color: #e74c3c;"><p>Помилка завантаження</p></div>`;
    },

    setFilters(filters) {
        this.state.filters = filters;
        this.loadInitialData();
    }
};