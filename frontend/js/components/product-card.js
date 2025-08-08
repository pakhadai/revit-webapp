// js/components/product-card.js (до 400 рядків)
export class ProductCard {
    constructor(archive) {
        this.archive = archive;
        this.element = null;
    }

    render() {
        const template = `
            <div class="product-card" data-id="${this.archive.id}">
                <div class="product-card__image-wrapper">
                    <img src="${this.archive.image}"
                         alt="${this.archive.title[i18n.currentLang]}"
                         class="product-card__image">
                    ${this.renderBadges()}
                </div>

                <div class="product-card__content">
                    <h3 class="product-card__title">
                        ${this.archive.title[i18n.currentLang]}
                    </h3>

                    <p class="product-card__description">
                        ${this.truncate(this.archive.description[i18n.currentLang], 60)}
                    </p>

                    <div class="product-card__footer">
                        <div class="product-card__price">
                            ${this.renderPrice()}
                        </div>

                        <button class="btn btn--primary btn--small"
                                onclick="app.cart.addItem('${this.archive.id}')">
                            ${i18n.t('buttons.addToCart')}
                        </button>
                    </div>
                </div>
            </div>
        `;

        this.element = this.htmlToElement(template);
        this.attachEvents();
        return this.element;
    }

    renderBadges() {
        let badges = '';

        if (this.archive.isNew) {
            badges += '<span class="badge badge--new">NEW</span>';
        }

        if (this.archive.discount > 0) {
            badges += `<span class="badge badge--sale">-${this.archive.discount}%</span>`;
        }

        return badges ? `<div class="product-card__badges">${badges}</div>` : '';
    }

    renderPrice() {
        if (this.archive.discount > 0) {
            const salePrice = this.archive.price * (1 - this.archive.discount / 100);
            return `
                <span class="price price--old">$${this.archive.price}</span>
                <span class="price price--sale">$${salePrice.toFixed(2)}</span>
            `;
        }

        return `<span class="price">$${this.archive.price}</span>`;
    }

    attachEvents() {
        // Клік на картку - перехід на сторінку товару
        this.element.addEventListener('click', (e) => {
            if (!e.target.classList.contains('btn')) {
                router.navigate(`/product/${this.archive.id}`);
            }
        });
    }
}