import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	ssr: {
		noExternal: ['convex']
	},
	build: {
		target: 'es2022'
	},
	// Cloud VM previews are served from a generated hostname, so the dev server
	// must accept those origins. Scoped to the preview platforms and loopback —
	// never `allowedHosts: true`.
	server: {
		host: '0.0.0.0',
		port: 3000,
		allowedHosts: ['.freebuff.site', '.agent37.app', 'localhost', '127.0.0.1']
	},
	preview: {
		host: '0.0.0.0',
		port: 3000,
		allowedHosts: ['.freebuff.site', '.agent37.app', 'localhost', '127.0.0.1']
	}
});
