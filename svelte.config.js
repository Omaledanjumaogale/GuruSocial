import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		// Cloudflare Pages: fully static output. `fallback` supplies the SPA shell
		// and scripts/postbuild-static-shells.mjs materialises a real HTML file for
		// every route, so page requests never need a Function.
		adapter: adapter({
			pages: 'build',
			assets: 'build',
			fallback: 'index.html',
			precompress: false,
			strict: true
		}),
		// Absolute asset URLs: deep routes must load /_app/... from the site root.
		paths: { relative: false }
	}
};

export default config;
