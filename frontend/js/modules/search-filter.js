// Модуль пошуку та фільтрації (КОМПАКТНА ВЕРСІЯ З МОДАЛЬНИМИ ВІКНАМИ)
window.SearchFilterModule = {
    currentFilters: {
        search: '',
        archive_type: '',
        min_price: null,
        max_price: null,
        sort_by: 'id',
        sort_order: 'asc'
    },

    // 1. Рендер нової, компактної панелі
    renderSearchPanel(app) {
        const t = (key) => app.t(key);

        return `
            <div class="search-panel-compact" style="margin-bottom: 20px; position: sticky; top: var(--header-height); background: var(--tg-theme-bg-color); padding: 10px 0; z-index: 50;">
                <div style="position: relative; margin-bottom: 10px;">
                    <input
                        type="text"
                        id="search-input"
                        placeholder="🔍 ${t('search.placeholder')}"
                        value="${this.currentFilters.search}"
                        style="width: 100%; padding: 12px 40px 12px 15px; border: 1px solid var(--tg-theme-secondary-bg-color); border-radius: 8px; font-size: 16px;"
                        onkeyup="SearchFilterModule.handleSearchInput(event)"
                    >
                    ${this.currentFilters.search ? `
                        <button onclick="SearchFilterModule.clearSearch()" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; color: var(--tg-theme-hint-color); cursor: pointer; font-size: 20px;">×</button>
                    ` : ''}
                </div>

                <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px;">
                    <div style="display: flex; gap: 10px;">
                        <button onclick="SearchFilterModule.showFilterModal(window.app)" style="padding: 8px 16px; background: var(--tg-theme-secondary-bg-color); border: none; border-radius: 8px; cursor: pointer;">
                            ${t('buttons.filter')}
                        </button>
                        <button onclick="SearchFilterModule.showSortModal(window.app)" style="padding: 8px 16px; background: var(--tg-theme-secondary-bg-color); border: none; border-radius: 8px; cursor: pointer;">
                           ${t('buttons.sort')}
                        </button>
                    </div>
                    <button onclick="SearchFilterModule.resetFilters()" style="padding: 8px 16px; background: none; border: none; color: var(--tg-theme-hint-color); cursor: pointer;">
                        ${t('buttons.reset')}
                    </button>
                </div>

                ${this.renderActiveFilters(app)}
            </div>
        `;
    },

    // 2. Модальне вікно для ФІЛЬТРІВ
    showFilterModal(app) {
        const t = (key) => app.t(key);
        const modalId = 'filter-modal';
        if (document.getElementById(modalId)) return;

        const modalHtml = `
            <div class="modal-overlay" id="${modalId}" onclick="if(event.target.id === '${modalId}') SearchFilterModule.closeModal('${modalId}')">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>${t('buttons.filter')}</h3>
                        <button onclick="SearchFilterModule.closeModal('${modalId}')" class="modal-close-btn">&times;</button>
                    </div>
                    <div class="modal-body">
                        <label>${t('filter.type')}</label>
                        <select id="modal-filter-type" style="width: 100%; padding: 10px; border-radius: 8px; margin-bottom: 15px; border: 1px solid #ccc;">
                            <option value="">${t('filter.allTypes')}</option>
                            <option value="premium" ${this.currentFilters.archive_type === 'premium' ? 'selected' : ''}>${t('filter.premium')}</option>
                            <option value="free" ${this.currentFilters.archive_type === 'free' ? 'selected' : ''}>${t('filter.free')}</option>
                        </select>

                        <label>Ціна</label>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                            <input type="number" id="modal-min-price" placeholder="${t('filter.minPrice')}" value="${this.currentFilters.min_price || ''}" style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid #ccc;">
                            <input type="number" id="modal-max-price" placeholder="${t('filter.maxPrice')}" value="${this.currentFilters.max_price || ''}" style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid #ccc;">
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button onclick="SearchFilterModule.applyAndCloseModal('${modalId}')" class="modal-apply-btn">${t('buttons.apply')}</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    },

    // 3. Модальне вікно для СОРТУВАННЯ
    showSortModal(app) {
        const t = (key) => app.t(key);
        const modalId = 'sort-modal';
        if (document.getElementById(modalId)) return;

        const currentSort = `${this.currentFilters.sort_by}-${this.currentFilters.sort_order}`;

        const modalHtml = `
            <div class="modal-overlay" id="${modalId}" onclick="if(event.target.id === '${modalId}') SearchFilterModule.closeModal('${modalId}')">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>${t('buttons.sort')}</h3>
                        <button onclick="SearchFilterModule.closeModal('${modalId}')" class="modal-close-btn">&times;</button>
                    </div>
                    <div class="modal-body">
                        <select id="modal-sort-by" style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid #ccc;">
                            <option value="id-asc" ${currentSort === 'id-asc' ? 'selected' : ''}>${t('sort.default')}</option>
                            <option value="price-asc" ${currentSort === 'price-asc' ? 'selected' : ''}>${t('sort.priceAsc')}</option>
                            <option value="price-desc" ${currentSort === 'price-desc' ? 'selected' : ''}>${t('sort.priceDesc')}</option>
                            <option value="title-asc" ${currentSort === 'title-asc' ? 'selected' : ''}>${t('sort.title')}</option>
                            <option value="created_at-desc" ${currentSort === 'created_at-desc' ? 'selected' : ''}>${t('sort.newest')}</option>
                        </select>
                    </div>
                    <div class="modal-footer">
                        <button onclick="SearchFilterModule.applyAndCloseModal('${modalId}')" class="modal-apply-btn">${t('buttons.apply')}</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    },

    // 4. Оновлена логіка для зчитування даних з модальних вікон
    handleFilterChange() {
        // Фільтри
        const typeFilter = document.getElementById('modal-filter-type');
        if(typeFilter) this.currentFilters.archive_type = typeFilter.value;

        const minPriceFilter = document.getElementById('modal-min-price');
        if(minPriceFilter) this.currentFilters.min_price = minPriceFilter.value ? parseFloat(minPriceFilter.value) : null;

        const maxPriceFilter = document.getElementById('modal-max-price');
        if(maxPriceFilter) this.currentFilters.max_price = maxPriceFilter.value ? parseFloat(maxPriceFilter.value) : null;

        // Сортування
        const sortFilter = document.getElementById('modal-sort-by');
        if (sortFilter) {
            const [sortBy, sortOrder] = sortFilter.value.split('-');
            this.currentFilters.sort_by = sortBy;
            this.currentFilters.sort_order = sortOrder || 'asc';
        }
    },

    // 5. Функції для управління модальними вікнами
    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.remove();
    },

    applyAndCloseModal(modalId) {
        this.handleFilterChange();
        this.applyFilters();
        this.closeModal(modalId);
        // Перерендер панелі, щоб оновити активні фільтри
        document.querySelector('.search-panel-compact').outerHTML = this.renderSearchPanel(window.app);
    },

    // Решта методів залишаються майже без змін
    handleSearchInput(event) {
        this.currentFilters.search = event.target.value;
        if (event.key === 'Enter') {
            this.applyFilters();
        }
    },

    clearSearch() {
        this.currentFilters.search = '';
        document.getElementById('search-input').value = '';
        this.applyFilters();
    },

    async applyFilters() {
        if (window.app && window.CatalogModule) {
            await window.CatalogModule.loadFiltered(this.currentFilters, window.app);
        }
    },

    resetFilters() {
        this.currentFilters = { search: '', archive_type: '', min_price: null, max_price: null, sort_by: 'id', sort_order: 'asc' };
        this.applyFilters();
        // Перерендер панелі
        document.querySelector('.search-panel-compact').outerHTML = this.renderSearchPanel(window.app);
    },

    renderActiveFilters(app) {
        const activeFilters = [];
        const t = (key) => app.t(key);

        if (this.currentFilters.archive_type) {
            const typeName = this.currentFilters.archive_type === 'premium' ? t('filter.premium') : t('filter.free');
            activeFilters.push(`${t('filter.type')}: ${typeName}`);
        }
        if (this.currentFilters.min_price) {
            activeFilters.push(`${t('filter.from')} $${this.currentFilters.min_price}`);
        }
        if (this.currentFilters.max_price) {
            activeFilters.push(`${t('filter.to')} $${this.currentFilters.max_price}`);
        }

        if (activeFilters.length === 0) return '';

        return `
            <div style="margin-top: 10px; display: flex; flex-wrap: wrap; gap: 8px;">
                ${activeFilters.map(filter => `
                    <span style="background: var(--tg-theme-secondary-bg-color); padding: 4px 8px; border-radius: 16px; font-size: 12px;">
                        ${filter}
                    </span>
                `).join('')}
            </div>
        `;
    }
};