// Модуль пошуку та фільтрації з мультимовністю
window.SearchFilterModule = {
    currentFilters: {
        search: '',
        archive_type: '',
        min_price: null,
        max_price: null,
        sort_by: 'id',
        sort_order: 'asc'
    },

    // Рендер панелі пошуку та фільтрів
    renderSearchPanel(app) {
        const t = (key) => app.t(key); // Скорочення для перекладу

        return `
            <div class="search-filter-panel" style="background: var(--tg-theme-bg-color); border: 1px solid var(--tg-theme-secondary-bg-color); border-radius: 12px; padding: 20px; margin-bottom: 20px;">
                <!-- Пошук -->
                <div style="margin-bottom: 15px;">
                    <div style="position: relative;">
                        <input
                            type="text"
                            id="search-input"
                            placeholder="🔍 ${t('search.placeholder')}"
                            value="${this.currentFilters.search}"
                            style="width: 100%; padding: 12px 40px 12px 15px; border: 1px solid var(--tg-theme-secondary-bg-color); border-radius: 8px; font-size: 16px;"
                            onkeyup="SearchFilterModule.handleSearchInput(event)"
                        >
                        ${this.currentFilters.search ? `
                            <button
                                onclick="SearchFilterModule.clearSearch()"
                                style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; color: var(--tg-theme-hint-color); cursor: pointer; font-size: 20px;">
                                ×
                            </button>
                        ` : ''}
                    </div>
                </div>

                <!-- Фільтри -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-bottom: 15px;">
                    <!-- Тип архіву -->
                    <select
                        id="filter-type"
                        onchange="SearchFilterModule.handleFilterChange()"
                        style="padding: 10px; border: 1px solid var(--tg-theme-secondary-bg-color); border-radius: 8px; background: white; font-size: 14px;">
                        <option value="">📦 ${t('filter.allTypes')}</option>
                        <option value="premium" ${this.currentFilters.archive_type === 'premium' ? 'selected' : ''}>💎 ${t('filter.premium')}</option>
                        <option value="free" ${this.currentFilters.archive_type === 'free' ? 'selected' : ''}>🆓 ${t('filter.free')}</option>
                    </select>

                    <!-- Сортування -->
                    <select
                        id="sort-by"
                        onchange="SearchFilterModule.handleFilterChange()"
                        style="padding: 10px; border: 1px solid var(--tg-theme-secondary-bg-color); border-radius: 8px; background: white; font-size: 14px;">
                        <option value="id-asc">🔢 ${t('sort.default')}</option>
                        <option value="price-asc" ${this.currentFilters.sort_by === 'price' && this.currentFilters.sort_order === 'asc' ? 'selected' : ''}>💰 ${t('sort.priceAsc')}</option>
                        <option value="price-desc" ${this.currentFilters.sort_by === 'price' && this.currentFilters.sort_order === 'desc' ? 'selected' : ''}>💰 ${t('sort.priceDesc')}</option>
                        <option value="title-asc" ${this.currentFilters.sort_by === 'title' ? 'selected' : ''}>🔤 ${t('sort.title')}</option>
                        <option value="created_at-desc" ${this.currentFilters.sort_by === 'created_at' ? 'selected' : ''}>📅 ${t('sort.newest')}</option>
                    </select>
                </div>

                <!-- Фільтр ціни -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px;">
                    <input
                        type="number"
                        id="filter-min-price"
                        placeholder="${t('filter.minPrice')}"
                        value="${this.currentFilters.min_price || ''}"
                        min="0"
                        step="0.01"
                        onchange="SearchFilterModule.handleFilterChange()"
                        style="padding: 10px; border: 1px solid var(--tg-theme-secondary-bg-color); border-radius: 8px; font-size: 14px;">

                    <input
                        type="number"
                        id="filter-max-price"
                        placeholder="${t('filter.maxPrice')}"
                        value="${this.currentFilters.max_price || ''}"
                        min="0"
                        step="0.01"
                        onchange="SearchFilterModule.handleFilterChange()"
                        style="padding: 10px; border: 1px solid var(--tg-theme-secondary-bg-color); border-radius: 8px; font-size: 14px;">
                </div>

                <!-- Кнопки -->
                <div style="display: flex; gap: 10px;">
                    <button
                        onclick="SearchFilterModule.applyFilters()"
                        style="flex: 1; padding: 12px; background: var(--primary-color); color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer;">
                        🔍 ${t('buttons.apply')}
                    </button>
                    <button
                        onclick="SearchFilterModule.resetFilters()"
                        style="padding: 12px 20px; background: var(--tg-theme-secondary-bg-color); color: var(--tg-theme-text-color); border: none; border-radius: 8px; font-size: 16px; cursor: pointer;">
                        🔄 ${t('buttons.reset')}
                    </button>
                </div>

                <!-- Активні фільтри -->
                ${this.renderActiveFilters(app)}
            </div>
        `;
    },

    // Відображення активних фільтрів
    renderActiveFilters(app) {
        const activeFilters = [];
        const t = (key) => app.t(key);

        if (this.currentFilters.search) {
            activeFilters.push(`${t('filter.search')}: "${this.currentFilters.search}"`);
        }
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
            <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid var(--tg-theme-secondary-bg-color);">
                <div style="font-size: 12px; color: var(--tg-theme-hint-color); margin-bottom: 8px;">${t('filter.activeFilters')}:</div>
                <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                    ${activeFilters.map(filter => `
                        <span style="background: var(--tg-theme-secondary-bg-color); padding: 4px 8px; border-radius: 4px; font-size: 12px;">
                            ${filter}
                        </span>
                    `).join('')}
                </div>
            </div>
        `;
    },

    // Решта методів залишаються без змін...
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

    handleFilterChange() {
        const typeFilter = document.getElementById('filter-type');
        const sortFilter = document.getElementById('sort-by');
        const minPriceFilter = document.getElementById('filter-min-price');
        const maxPriceFilter = document.getElementById('filter-max-price');

        this.currentFilters.archive_type = typeFilter.value;

        const [sortBy, sortOrder] = sortFilter.value.split('-');
        this.currentFilters.sort_by = sortBy;
        this.currentFilters.sort_order = sortOrder;

        this.currentFilters.min_price = minPriceFilter.value ? parseFloat(minPriceFilter.value) : null;
        this.currentFilters.max_price = maxPriceFilter.value ? parseFloat(maxPriceFilter.value) : null;
    },

    async applyFilters() {
        if (window.app && window.CatalogModule) {
            await window.CatalogModule.loadFiltered(this.currentFilters, window.app);
        }
    },

    resetFilters() {
        this.currentFilters = {
            search: '',
            archive_type: '',
            min_price: null,
            max_price: null,
            sort_by: 'id',
            sort_order: 'asc'
        };

        document.getElementById('search-input').value = '';
        document.getElementById('filter-type').value = '';
        document.getElementById('sort-by').value = 'id-asc';
        document.getElementById('filter-min-price').value = '';
        document.getElementById('filter-max-price').value = '';

        this.applyFilters();
    }
};