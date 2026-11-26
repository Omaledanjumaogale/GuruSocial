/*
 * GuruSocial service worker.
 *
 * Rules:
 *  - Never cache authenticated data or cross-origin (Convex) responses.
 *  - HTML is network-first; a cached shell is only a last-resort offline fallback.
 *  - Immutable hashed assets may be cached, but a new SW version purges old caches.
 *  - The browser is told when a new version is waiting so the UI can prompt reload.
 */
const VERSION = 'gurusocial-v3';
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;
const SHELL_URL = '/index.html';

self.addEventListener('install', (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(SHELL_CACHE);
			// Cache individually: one 404 must not abort the whole install (the
			// previous version used addAll(['/dashboard', ...]) which can fail on
			// hosts that do not serve every route).
			await Promise.all(
				[SHELL_URL, '/', '/manifest.json'].map(async (url) => {
					try {
						const res = await fetch(url, { cache: 'reload' });
						if (res.ok) await cache.put(url, res.clone());
					} catch {
						/* offline during install — fine */
					}
				})
			);
			await self.skipWaiting();
		})()
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			const keys = await caches.keys();
			await Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)));
			await self.clients.claim();
			const clients = await self.clients.matchAll({ type: 'window' });
			clients.forEach((client) => client.postMessage({ type: 'GS_SW_ACTIVE', version: VERSION }));
		})()
	);
});

self.addEventListener('message', (event) => {
	if (event.data?.type === 'GS_SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
	const { request } = event;
	if (request.method !== 'GET') return;

	let url;
	try {
		url = new URL(request.url);
	} catch {
		return;
	}
	// Only same-origin static delivery; Convex/API traffic always goes to network.
	if (url.origin !== self.location.origin) return;
	if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/mcp')) return;

	// Navigations: network-first, cached shell only when offline.
	if (request.mode === 'navigate') {
		event.respondWith(
			(async () => {
				try {
					const fresh = await fetch(request);
					if (fresh.ok) {
						const cache = await caches.open(SHELL_CACHE);
						cache.put(SHELL_URL, fresh.clone()).catch(() => {});
					}
					return fresh;
				} catch {
					const cache = await caches.open(SHELL_CACHE);
					return (await cache.match(SHELL_URL)) || (await cache.match('/')) || Response.error();
				}
			})()
		);
		return;
	}

	// Immutable, content-hashed build assets may be served cache-first.
	if (url.pathname.startsWith('/_app/immutable/')) {
		event.respondWith(
			(async () => {
				const cache = await caches.open(ASSET_CACHE);
				const hit = await cache.match(request);
				if (hit) return hit;
				const res = await fetch(request);
				if (res.ok) cache.put(request, res.clone()).catch(() => {});
				return res;
			})()
		);
		return;
	}

	// Everything else (icons, images, manifest) is network-first with a cache
	// fallback so updated artwork is picked up as soon as it is deployed.
	if (/\.(css|js|svg|png|jpe?g|webp|avif|ico|json|woff2?)$/.test(url.pathname)) {
		event.respondWith(
			(async () => {
				const cache = await caches.open(ASSET_CACHE);
				try {
					const res = await fetch(request);
					if (res.ok) cache.put(request, res.clone()).catch(() => {});
					return res;
				} catch {
					const hit = await cache.match(request);
					return hit || Response.error();
				}
			})()
		);
	}
});
