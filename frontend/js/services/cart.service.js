// Cart Service
export class CartService {
    constructor(api, storage) {
        this.api = api;
        this.storage = storage;
        this.items = [];
    }

    async load() {
        // Load from storage
        const savedCart = this.storage.get('cart', { items: [] });
        this.items = savedCart.items;
    }

    addItem(product, quantity = 1) {
        const existingItem = this.items.find(item => item.id === product.id);

        if (existingItem) {
            existingItem.quantity += quantity;
        } else {
            this.items.push({
                ...product,
                quantity
            });
        }

        this.save();
        this.updateUI();
    }

    removeItem(productId) {
        this.items = this.items.filter(item => item.id !== productId);
        this.save();
        this.updateUI();
    }

    clear() {
        this.items = [];
        this.save();
        this.updateUI();
    }

    getItemsCount() {
        return this.items.reduce((sum, item) => sum + item.quantity, 0);
    }

    getTotal() {
        return this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    }

    save() {
        this.storage.set('cart', { items: this.items });
    }

    updateUI() {
        // Update cart badge
        if (window.app) {
            window.app.updateCartBadge();
        }
    }
}