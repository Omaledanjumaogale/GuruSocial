/* GuruSocial service worker — offline shell + network-first for data pages. */
const CACHE = 'gurusocial-v1';
const OFFLINE_URLS = ['/', '/dashboard', '/docs', '/manifest.json'];

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(CACHE).then((cache) => cache.addAll(OFFLINE_URLS)).then(() => self.skipWaiting())
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
	);
});

self.addEventListener('fetch', (event) => {
	const { request } = event;
	if (request.method !== 'GET') return;
	const url = new URL(request.url);
	if (url.origin !== self.location.origin) return;

	// Network-first for navigations, cache fallback for offline.
	if (request.mode === 'navigate') {
		event.respondWith(
			fetch(request)
				.then((res) => {
					const copy = res.clone();
					caches.open(CACHE).then((c) => c.put(request, copy));
					return res;
				})
				.catch(() => caches.match(request).then((hit) => hit ?? caches.match('/dashboard')))
		);
		return;
	}
	// Cache-first for static assets.
	if (/\.(css|js|svg|png|jpg|jpeg|woff2?|ico|json)$/.test(url.pathname)) {
		event.respondWith(
			caches.match(request).then((hit) => hit ?? fetch(request).then((res) => {
				const copy = res.clone();
				caches.open(CACHE).then((c) => c.put(request, copy));
				return res;
			}))
		);
	}
});
