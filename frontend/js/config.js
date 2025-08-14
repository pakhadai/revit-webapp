// Configuration file
export const config = {
    // API Configuration - тепер без URL, бо все на одному домені!
    API_URL: '',  // Пустий, бо frontend і backend на одному домені

    // App Configuration
    APP_NAME: 'RevitBot Store',
    VERSION: '1.0.0',

    // Telegram Web App
    TELEGRAM_BOT_USERNAME: 'revitbot',

    // Storage Keys
    STORAGE_KEYS: {
        TOKEN: 'auth_token',
        USER: 'user_data',
        CART: 'cart_data',
        LANGUAGE: 'app_language',
        THEME: 'app_theme'
    },

    // Languages
    SUPPORTED_LANGUAGES: ['ua', 'en', 'de'],
    DEFAULT_LANGUAGE: 'ua',
    RTL_LANGUAGES: ['ar', 'he', 'fa', 'ur'],

    // Pagination
    ITEMS_PER_PAGE: 12,

    // Cache
    CACHE_TTL: 5 * 60 * 1000, // 5 minutes

    // Payments
    PAYMENT_METHODS: {
        CRYPTOMUS: 'cryptomus',
        DEV_MODE: 'dev_mode'
    },

    // Features
    FEATURES: {
        BONUSES: true,
        REFERRALS: true,
        PROMOTIONS: true,
        SUBSCRIPTION: true
    }
};