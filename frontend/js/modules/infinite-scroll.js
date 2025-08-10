// Модуль Infinite Scroll (СПРОЩЕНА І БЕЗПЕЧНА ВЕРСІЯ)
window.InfiniteScrollModule = {
    state: {
        isLoading: false,
        hasMore: true,
        currentPage: 1,
        filters: {},
        container: null,
        loader: null
    },

    init(containerSelector) {
        this.state.container = document.querySelector(containerSelector);
        if (!this.state.container) return;
        this.createLoader();
        window.addEventListener('scroll', () => this.handleScroll(), { passive: true });
        this.loadInitialData();
    },

    createLoader() {
        const loaderHtml = `<div id="infinite-scroll-loader" style="display: none; text-align: center; padding: 20px; grid-column: 1 / -1;"><div class="loader"></div></div>`;
        this.state.container.insertAdjacentHTML('beforeend', loaderHtml);
        this.state.loader = document.getElementById('infinite-scroll-loader');
    },

    handleScroll() {
        if (this.state.isLoading || !this.state.hasMore) return;
        const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
        if (scrollTop + clientHeight >= scrollHeight - 200) {
            this.loadNextPage();
        }
    },

    async loadInitialData() {
        this.state.currentPage = 1;
        this.state.hasMore = true;
        this.state.container.innerHTML = '';
        this.createLoader();
        await this.loadPage(1);
    },

    async loadNextPage() {
        if (this.state.isLoading || !this.state.hasMore) return;
        await this.loadPage(this.state.currentPage + 1);
    },

    async loadPage(page) {
        this.state.isLoading = true;
        if (this.state.loader) this.state.loader.style.display = 'block';

        try {
            const params = new URLSearchParams({ page, limit: 12, ...this.state.filters });
            const response = await window.app.api.get(`/api/archives/paginated/list?${params}`);

            if (response && response.items) {
                // ВАЖЛИВО: Оновлюємо кеш товарів, щоб кнопка "Додати в кошик" працювала
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
        this.state.container.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; padding: 50px;"><h3>${window.app.t('catalog.notFound')}</h3></div>`;
    },

    setFilters(filters) {
        this.state.filters = filters;
        this.loadInitialData();
    }
};