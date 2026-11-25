import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		// Cloudflare Pages: fully static output with an SPA fallback for client-rendered routes.
		adapter: adapter({
			pages: 'build',
			assets: 'build',
			fallback: 'index.html',
			precompress: false,
			strict: true
		}),
		// CRITICAL for SPA fallback hosts: emit absolute asset URLs so deep routes
		// like /dashboard/composer load /_app/... from the site root, not relative
		// paths that 404 and render a blank white page.
		paths: { relative: false },
		csrf: { checkOrigin: false }
	}
};

export default config;
