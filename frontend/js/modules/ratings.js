// frontend/js/modules/ratings.js (З ВИПРАВЛЕННЯМ NULL)
window.RatingsModule = {
    myRatings: {},
    async init(app) { this.app = app; await this.loadMyRatings(); },
    async loadMyRatings() { try { this.myRatings = await this.app.api.get('/api/ratings/my-ratings'); } catch (error) { this.myRatings = {}; } },
    async submitRating(archiveId, ratingValue) { try { await this.app.api.post(`/api/ratings/${archiveId}`, { rating_value: ratingValue }); this.myRatings[archiveId] = ratingValue; this.app.tg.showAlert(`Дякуємо за оцінку ${ratingValue} ★`); const product = this.app.productsCache.find(p => p.id === archiveId); if (product) { const oldCount = product.ratings_count || 0; const oldAvg = product.average_rating || 0; product.average_rating = ((oldAvg * oldCount) + ratingValue) / (oldCount + 1); product.ratings_count = oldCount + 1; } const interactiveStarsWrapper = document.querySelector('.stars-interactive-wrapper'); if (interactiveStarsWrapper) interactiveStarsWrapper.innerHTML = this.renderInteractiveStars(archiveId); } catch (error) { this.app.tg.showAlert(`Помилка: ${error.message}`); } },

    // ВИПРАВЛЕННЯ: Додаємо значення за замовчуванням
    renderStars(averageRating = 0, ratingsCount = 0) {
        // Перетворюємо null/undefined в 0
        const avg = averageRating || 0;
        const count = ratingsCount || 0;

        if (count === 0) {
            return '<div class="stars-static" style="opacity: 0.5;">' + '☆'.repeat(5) + '</div>';
        }

        const fullStars = Math.round(avg);
        const emptyStars = 5 - fullStars;
        return `<div class="stars-static">${'★'.repeat(fullStars)}${'☆'.repeat(emptyStars)} <span class="ratings-count">(${count})</span></div>`;
    },

    renderInteractiveStars(archiveId) { const myRating = this.myRatings[archiveId] || 0; let starsHtml = ''; for (let i = 1; i <= 5; i++) { const isChecked = i <= myRating; starsHtml += `<span class="star-interactive ${isChecked ? 'checked' : ''}" data-value="${i}" onclick="RatingsModule.submitRating(${archiveId}, ${i})">★</span>`; } return `<div class="stars-interactive-wrapper">${starsHtml}</div>`; }
};