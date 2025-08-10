// Модуль Infinite Scroll
window.InfiniteScrollModule = {
    // Налаштування
    config: {
        threshold: 200, // Відстань до кінця сторінки для тригеру завантаження
        debounceDelay: 300, // Затримка між запитами
        initialPage: 1,
        itemsPerPage: 12
    },

    // Стан
    state: {
        isLoading: false,
        hasMore: true,
        currentPage: 1,
        totalPages: 0,
        loadedItems: [],
        filters: null,
        container: null,
        loader: null
    },

    // Ініціалізація
    init(containerSelector, options = {}) {
        this.config = { ...this.config, ...options };
        this.state.container = document.querySelector(containerSelector);

        if (!this.state.container) {
            console.error('Infinite scroll container not found:', containerSelector);
            return;
        }

        // Створюємо лоадер
        this.createLoader();

        // Додаємо слухач скролу
        this.attachScrollListener();

        // Завантажуємо першу сторінку
        this.loadInitialData();
    },

    // Створення лоадера
    createLoader() {
        const loaderHtml = `
            <div id="infinite-scroll-loader" style="display: none; text-align: center; padding: 20px;">
                <div class="loader" style="width: 40px; height: 40px; margin: 0 auto 10px; border: 3px solid #f3f3f3; border-top: 3px solid var(--primary-color); border-radius: 50%; animation: spin 1s linear infinite;"></div>
                <p style="color: var(--tg-theme-hint-color); font-size: 14px;">Завантаження...</p>
            </div>
        `;

        // Додаємо лоадер після контейнера
        this.state.container.insertAdjacentHTML('afterend', loaderHtml);
        this.state.loader = document.getElementById('infinite-scroll-loader');
    },

    // Прикріплення слухача скролу
    attachScrollListener() {
        let scrollTimeout;

        const handleScroll = () => {
            // Debounce для оптимізації
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                if (this.shouldLoadMore()) {
                    this.loadNextPage();
                }
            }, this.config.debounceDelay);
        };

        // Слухаємо скрол на вікні
        window.addEventListener('scroll', handleScroll);

        // Також слухаємо скрол на контейнері якщо він має overflow
        this.state.container.addEventListener('scroll', handleScroll);
    },

    // Перевірка чи потрібно завантажити більше
    shouldLoadMore() {
        if (this.state.isLoading || !this.state.hasMore) {
            return false;
        }

        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const windowHeight = window.innerHeight;
        const documentHeight = document.documentElement.scrollHeight;

        // Перевіряємо чи доскролили до порогу
        return (scrollTop + windowHeight) >= (documentHeight - this.config.threshold);
    },

    // Завантаження початкових даних
    async loadInitialData() {
        this.state.currentPage = 1;
        this.state.loadedItems = [];
        this.state.hasMore = true;

        // Очищуємо контейнер
        this.state.container.innerHTML = '';

        await this.loadPage(1);
    },

    // Завантаження наступної сторінки
    async loadNextPage() {
        if (this.state.isLoading || !this.state.hasMore) {
            return;
        }

        const nextPage = this.state.currentPage + 1;
        await this.loadPage(nextPage);
    },

    // Завантаження конкретної сторінки
    async loadPage(page) {
        if (this.state.isLoading) return;

        this.state.isLoading = true;
        this.showLoader();

        try {
            // ВИКОРИСТОВУЄМО ІСНУЮЧИЙ ЕНДПОІНТ /api/archives/
            // Поки що без справжньої пагінації, просто завантажуємо всі товари
            if (page === 1) {
                // Формуємо параметри запиту
                const params = new URLSearchParams(this.state.filters || {});

                // Запит до існуючого API
                const response = await window.app.api.get(`/api/archives/?${params}`);

                if (response && response.length > 0) {
                    // Симулюємо пагінацію на клієнті
                    const itemsPerPage = this.config.itemsPerPage;
                    const start = (page - 1) * itemsPerPage;
                    const end = start + itemsPerPage;
                    const pageItems = response.slice(start, end);

                    // Додаємо нові елементи
                    this.appendItems(pageItems);

                    // Оновлюємо стан
                    this.state.currentPage = page;
                    this.state.totalPages = Math.ceil(response.length / itemsPerPage);
                    this.state.hasMore = end < response.length;
                    this.state.loadedItems = [...this.state.loadedItems, ...pageItems];

                    // Зберігаємо всі товари для наступних сторінок
                    this.state.allItems = response;

                    // Оновлюємо лічильник
                    this.updateItemsCount(response.length);

                    // Якщо більше немає елементів
                    if (!this.state.hasMore) {
                        this.showEndMessage();
                    }
                }
            } else {
                // Для наступних сторінок використовуємо збережені дані
                if (this.state.allItems) {
                    const itemsPerPage = this.config.itemsPerPage;
                    const start = (page - 1) * itemsPerPage;
                    const end = start + itemsPerPage;
                    const pageItems = this.state.allItems.slice(start, end);

                    if (pageItems.length > 0) {
                        this.appendItems(pageItems);
                        this.state.currentPage = page;
                        this.state.hasMore = end < this.state.allItems.length;
                        this.state.loadedItems = [...this.state.loadedItems, ...pageItems];

                        if (!this.state.hasMore) {
                            this.showEndMessage();
                        }
                    }
                }
            }

        } catch (error) {
            console.error('Error loading page:', error);
            this.showError();
        } finally {
            this.state.isLoading = false;
            this.hideLoader();
        }
    },

    // Додавання елементів до контейнера
    appendItems(items) {
        if (!items || items.length === 0) return;

        const fragment = document.createDocumentFragment();

        items.forEach(item => {
            const element = this.createItemElement(item);
            fragment.appendChild(element);
        });

        // Додаємо з анімацією
        const newItems = Array.from(fragment.children);
        this.state.container.appendChild(fragment);

        // Анімація появи
        requestAnimationFrame(() => {
            newItems.forEach((item, index) => {
                setTimeout(() => {
                    item.style.opacity = '0';
                    item.style.transform = 'translateY(20px)';
                    item.style.transition = 'all 0.3s ease';

                    requestAnimationFrame(() => {
                        item.style.opacity = '1';
                        item.style.transform = 'translateY(0)';
                    });
                }, index * 50);
            });
        });
    },

    // Створення елемента товару
    createItemElement(archive) {
        const div = document.createElement('div');
        div.innerHTML = window.CatalogModule.getProductCard(archive, window.app);
        return div.firstElementChild;
    },

    // Показ/приховування лоадера
    showLoader() {
        if (this.state.loader) {
            this.state.loader.style.display = 'block';
        }
    },

    hideLoader() {
        if (this.state.loader) {
            this.state.loader.style.display = 'none';
        }
    },

    // Оновлення лічильника
    updateItemsCount(total) {
        const countElement = document.querySelector('[data-items-count]');
        if (countElement) {
            countElement.textContent = `Показано: ${this.state.loadedItems.length} з ${total}`;
        }
    },

    // Повідомлення про кінець списку
    showEndMessage() {
        const messageHtml = `
            <div style="text-align: center; padding: 30px; color: var(--tg-theme-hint-color);">
                <div style="font-size: 30px; margin-bottom: 10px;">✨</div>
                <p>Це всі товари за вашим запитом</p>
            </div>
        `;

        this.state.container.insertAdjacentHTML('afterend', messageHtml);
    },

    // Показ помилки
    showError() {
        const errorHtml = `
            <div style="text-align: center; padding: 20px; color: #e74c3c;">
                <p>Помилка завантаження. Спробуйте пізніше.</p>
                <button onclick="InfiniteScrollModule.retry()"
                        style="margin-top: 10px; padding: 8px 16px; background: var(--primary-color); color: white; border: none; border-radius: 6px; cursor: pointer;">
                    Спробувати ще
                </button>
            </div>
        `;

        if (this.state.loader) {
            this.state.loader.innerHTML = errorHtml;
            this.state.loader.style.display = 'block';
        }
    },

    // Повторна спроба
    retry() {
        this.hideLoader();
        this.loadNextPage();
    },

    // Встановлення фільтрів
    setFilters(filters) {
        this.state.filters = filters;
        this.loadInitialData();
    },

    // Скидання
    reset() {
        this.state.currentPage = 1;
        this.state.loadedItems = [];
        this.state.hasMore = true;
        this.state.filters = null;

        if (this.state.container) {
            this.state.container.innerHTML = '';
        }
    },

    // Очищення
    destroy() {
        window.removeEventListener('scroll', this.handleScroll);
        if (this.state.container) {
            this.state.container.removeEventListener('scroll', this.handleScroll);
        }

        if (this.state.loader) {
            this.state.loader.remove();
        }

        this.reset();
    }
};
