// Telegram Web App Integration
export class TelegramWebApp {
    constructor() {
        this.tg = window.Telegram?.WebApp;
        this.isAvailable = !!this.tg;
    }

    init() {
        if (!this.isAvailable) {
            console.warn('Telegram WebApp is not available');
            return;
        }

        // Ready
        this.tg.ready();

        // Expand to full height
        this.tg.expand();

        // Enable closing confirmation
        this.tg.enableClosingConfirmation();
    }

    getInitData() {
        return this.tg?.initData || '';
    }

    getInitDataUnsafe() {
        return this.tg?.initDataUnsafe || {};
    }

    getUserLanguage() {
        const user = this.getInitDataUnsafe().user;
        return user?.language_code;
    }

    getThemeParams() {
        return this.tg?.themeParams || {
            bg_color: '#ffffff',
            text_color: '#000000',
            hint_color: '#999999',
            link_color: '#2481cc',
            button_color: '#2481cc',
            button_text_color: '#ffffff',
            secondary_bg_color: '#f1f1f1'
        };
    }

    get colorScheme() {
        return this.tg?.colorScheme || 'light';
    }

    close() {
        if (this.isAvailable) {
            this.tg.close();
        }
    }

    showAlert(message) {
        if (this.isAvailable) {
            this.tg.showAlert(message);
        } else {
            alert(message);
        }
    }

    showConfirm(message, callback) {
        if (this.isAvailable) {
            this.tg.showConfirm(message, callback);
        } else {
            const result = confirm(message);
            callback(result);
        }
    }

    onBackButtonClick(callback) {
        if (this.isAvailable && this.tg.BackButton) {
            this.tg.BackButton.onClick(callback);
            this.tg.BackButton.show();
        }
    }

    hideBackButton() {
        if (this.isAvailable && this.tg.BackButton) {
            this.tg.BackButton.hide();
        }
    }
}
