// frontend/js/core/api.js - ОНОВЛЕНА ВЕРСІЯ

export class Api {
    constructor(baseURL) {
        this.baseURL = baseURL || 'http://localhost:8001';
        this.token = null;
    }

    setToken(token) {
        this.token = token;
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;

        const config = {
            ...options,
            headers: {
                // 'Content-Type': 'application/json', // Видалено, щоб браузер сам встановлював для FormData
                ...options.headers,
            }
        };

        // Додаємо Content-Type тільки якщо це не FormData
        if (!(options.body instanceof FormData)) {
            config.headers['Content-Type'] = 'application/json';
        }

        // Add auth token if available
        if (this.token) {
            config.headers['Authorization'] = `Bearer ${this.token}`;
        }

        try {
            const response = await fetch(url, config);

            if (!response.ok) {
                // Спробуємо отримати текст помилки з відповіді
                const errorBody = await response.text();
                // Спробуємо розпарсити як JSON, якщо не вийде - покажемо як текст
                try {
                    const errorJson = JSON.parse(errorBody);
                    throw new Error(errorJson.detail || `HTTP error! status: ${response.status}`);
                } catch(e) {
                    throw new Error(errorBody || `HTTP error! status: ${response.status}`);
                }
            }

            // Якщо відповідь порожня (наприклад, статус 204)
            const contentType = response.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                return { success: true }; // Повертаємо успішний об'єкт за замовчуванням
            }

            const data = await response.json();
            return data;

        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    }

    get(endpoint) {
        return this.request(endpoint, { method: 'GET' });
    }

    post(endpoint, data) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    // ✅ НОВИЙ МЕТОД ДЛЯ ВІДПРАВКИ ФОРМ (ФАЙЛІВ)
    postForm(endpoint, formData) {
        return this.request(endpoint, {
            method: 'POST',
            body: formData // Передаємо FormData напряму
        });
    }

    put(endpoint, data) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }
}