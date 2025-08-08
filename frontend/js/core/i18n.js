// Internationalization
export class I18n {
    constructor() {
        this.translations = {};
        this.currentLang = 'en';
    }

    async load(lang) {
        try {
            const response = await fetch(`/locales/${lang}.json`);
            if (!response.ok) {
                throw new Error(`Failed to load language: ${lang}`);
            }

            this.translations[lang] = await response.json();
            this.currentLang = lang;

            // Update HTML lang attribute
            document.documentElement.lang = lang;

            // Update direction for RTL languages
            const rtlLanguages = ['ar', 'he', 'fa', 'ur'];
            document.dir = rtlLanguages.includes(lang) ? 'rtl' : 'ltr';

            return true;
        } catch (error) {
            console.error('Failed to load translations:', error);

            // Fallback to English
            if (lang !== 'en') {
                return this.load('en');
            }

            return false;
        }
    }

    t(key, params = {}) {
        const keys = key.split('.');
        let value = this.translations[this.currentLang];

        for (const k of keys) {
            value = value?.[k];
            if (!value) break;
        }

        if (!value) {
            console.warn(`Translation not found: ${key}`);
            return key;
        }

        // Replace parameters
        let result = value;
        Object.keys(params).forEach(param => {
            result = result.replace(new RegExp(`{${param}}`, 'g'), params[param]);
        });

        return result;
    }
}
