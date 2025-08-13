// Service Worker для PWA (НАДІЙНА ВЕРСІЯ)

const CACHE_NAME = 'revitbot-cache-v6'; // Оновили версію кешу

// Список файлів, які ми намагатимемося закешувати
const APP_FILES_TO_CACHE = [
    '/',
    '/index.html',
    '/css/main.css',
    '/css/components.css',
    '/css/skeletons.css',
    '/css/responsive.css',
    '/js/app.js',
    '/js/modules/admin-forms.js',
    '/js/modules/admin.js',
    '/js/modules/catalog.js',
    '/js/modules/daily-bonus.js',
    '/js/modules/downloads.js',
    '/js/modules/favorites.js', // Тепер він точно має бути тут
    '/js/modules/history.js',
    '/js/modules/infinite-scroll.js',
    '/js/modules/payment.js',
    '/js/modules/product-details.js',
    '/js/modules/ratings.js',
    '/js/modules/referrals.js',
    '/js/modules/responsive.js',
    '/js/modules/search-filter.js',
    '/js/modules/subscription.js',
    '/js/modules/vip.js',
    '/js/locales/ua.json',
    '/js/locales/en.json'
];

// Подія 'install' - кешуємо файли
self.addEventListener('install', (event) => {
  console.log(`Service Worker: Встановлення v${CACHE_NAME.split('-')[2]}...`);
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Service Worker: Кешування основних файлів...');
      // ВИПРАВЛЕННЯ: Кешуємо файли по одному, щоб помилка в одному файлі не зламала все
      const promises = APP_FILES_TO_CACHE.map((url) => {
        return cache.add(url).catch(err => {
            console.warn(`Не вдалося закешувати ${url}:`, err);
        });
      });
      return Promise.all(promises);
    })
  );
});

// Подія 'activate' - видаляємо старі кеші
self.addEventListener('activate', (event) => {
    console.log('Service Worker: Активація...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    return self.clients.claim();
});

// Подія 'fetch' - віддаємо файли з кешу або мережі
self.addEventListener('fetch', (event) => {
    const { request } = event;

    // Для API запитів - завжди йдемо в мережу, але коректно обробляємо офлайн
    if (request.url.includes('/api/')) {
        event.respondWith(
            fetch(request).catch(() => {
                // В офлайні повертаємо JSON з помилкою, щоб додаток не падав
                return new Response(JSON.stringify({ offline: true, error: "Network error" }), {
                    headers: { 'Content-Type': 'application/json' }
                });
            })
        );
        return;
    }

    // Для інших файлів (HTML, CSS, JS) - спочатку шукаємо в кеші
    event.respondWith(
        caches.match(request).then((cachedResponse) => {
            return cachedResponse || fetch(request);
        })
    );
});