// Simple Router
export class Router {
    constructor() {
        this.routes = {};
        this.currentRoute = null;
        this.history = [];
    }

    async init() {
        // Handle browser back/forward
        window.addEventListener('popstate', (e) => {
            this.handleRoute(window.location.pathname);
        });

        // Handle initial route
        const path = window.location.pathname === '/' ? '/home' : window.location.pathname;
        await this.navigate(path);
    }

    register(path, handler) {
        this.routes[path] = handler;
    }

    async navigate(path) {
        // Update history
        this.history.push(this.currentRoute);
        this.currentRoute = path;

        // Update URL without reload
        window.history.pushState({}, '', path);

        // Handle route
        await this.handleRoute(path);
    }

    async handleRoute(path) {
        const content = document.getElementById('app-content');
        if (!content) return;

        // Show loader
        content.innerHTML = '<div class="loader-container"><div class="loader"></div></div>';

        // Default route
        if (path === '/' || path === '') {
            path = '/home';
        }

        // Load page based on route
        try {
            let html = '';

            switch(path) {
                case '/home':
                    html = await this.loadHomePage();
                    break;
                case '/catalog':
                    html = await this.loadCatalogPage();
                    break;
                case '/cart':
                    html = await this.loadCartPage();
                    break;
                case '/profile':
                    html = await this.loadProfilePage();
                    break;
                case '/admin':
                    html = await this.loadAdminPage();
                    break;
                default:
                    html = '<div class="error-page"><h2>404</h2><p>Page not found</p></div>';
            }

            content.innerHTML = html;

        } catch (error) {
            console.error('Route error:', error);
            content.innerHTML = '<div class="error-page"><h2>Error</h2><p>Failed to load page</p></div>';
        }
    }

    async loadHomePage() {
        return `
            <div class="home-page">
                <div class="welcome-section p-3">
                    <h2>Welcome to RevitBot Store</h2>
                    <p>High-quality Revit families for your projects</p>
                </div>

                <div class="featured-section p-3">
                    <h3>Featured Archives</h3>
                    <div class="product-grid">
                        <!-- Products will be loaded here -->
                        <div class="product-card">
                            <div class="product-card__image">
                                <div style="background: #f0f0f0; height: 200px;"></div>
                            </div>
                            <div class="product-card__content">
                                <h4>Sample Archive</h4>
                                <p>Description here...</p>
                                <div class="product-card__price">$9.99</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async loadCatalogPage() {
        return `
            <div class="catalog-page p-3">
                <h2>Catalog</h2>
                <p>Browse all archives</p>
            </div>
        `;
    }

    async loadCartPage() {
        return `
            <div class="cart-page p-3">
                <h2>Shopping Cart</h2>
                <p>Your cart is empty</p>
            </div>
        `;
    }

    async loadProfilePage() {
        return `
            <div class="profile-page p-3">
                <h2>Profile</h2>
                <p>User profile information</p>
            </div>
        `;
    }

    async loadAdminPage() {
        return `
            <div class="admin-page p-3">
                <h2>Admin Panel</h2>
                <p>Admin features</p>
            </div>
        `;
    }

    back() {
        if (this.history.length > 0) {
            const previousRoute = this.history.pop();
            this.navigate(previousRoute);
        }
    }

    canGoBack() {
        return this.history.length > 0;
    }
}