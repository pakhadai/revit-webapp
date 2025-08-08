// Authentication Service
export class AuthService {
    constructor(api) {
        this.api = api;
    }

    async loginWithTelegram(initData) {
        try {
            const response = await this.api.post('/api/auth/telegram', {
                initData: initData
            });

            return response;
        } catch (error) {
            console.error('Auth error:', error);
            throw error;
        }
    }

    logout() {
        // Clear storage
        localStorage.clear();

        // Redirect to home
        window.location.href = '/';
    }
}
