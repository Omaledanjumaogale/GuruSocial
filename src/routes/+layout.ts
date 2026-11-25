// Client-side SPA: all rendering happens in the browser so the same static
// build serves Cloudflare Pages, Capacitor-style mobile wrappers and offline PWA.
export const ssr = false;
export const prerender = false;
export const trailingSlash = 'never';
