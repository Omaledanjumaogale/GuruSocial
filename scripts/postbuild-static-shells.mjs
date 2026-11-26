/**
 * Post-build static shell emitter.
 *
 * SvelteKit's adapter-static writes a single `index.html` fallback for an SPA.
 * Cloudflare Pages can still return its own 404 for a deep link when Functions
 * are unavailable (fail-open with no shell to serve), which is the blank-page
 * incident. This script materialises a real HTML shell for every route:
 *
 *   build/index.html
 *   build/dashboard/index.html
 *   build/dashboard/composer/index.html
 *   ...
 *
 * Each shell is byte-identical to the SPA fallback, so hydration, asset paths
 * and client routing behave exactly as before — but the file now exists, so
 * Pages serves it directly without invoking a Function and without a 404.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const buildDir = path.join(root, 'build');
const shellPath = path.join(buildDir, 'index.html');

if (!fs.existsSync(shellPath)) {
	console.error('[static-shells] build/index.html is missing — run vite build first.');
	process.exit(1);
}

const shell = fs.readFileSync(shellPath);
const pagesDir = path.join(root, 'src', 'routes');

/** Recursively collect route directories that contain a +page.svelte. */
function collectRoutes(dir, segments = []) {
	const out = [];
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		if (!entry.isDirectory()) continue;
		// Skip route groups, private folders, and dynamic segments are still valid
		// as a static shell (the client router resolves the parameter).
		if (entry.name.startsWith('(') && entry.name.endsWith(')')) {
			out.push(...collectRoutes(path.join(dir, entry.name), segments));
			continue;
		}
		const nextSegments = [...segments, entry.name];
		const child = path.join(dir, entry.name);
		if (fs.existsSync(path.join(child, '+page.svelte')) || fs.existsSync(path.join(child, '+page.ts'))) {
			out.push(nextSegments);
		}
		out.push(...collectRoutes(child, nextSegments));
	}
	return out;
}

const routes = fs.existsSync(pagesDir) ? collectRoutes(pagesDir) : [];
const written = [];

for (const segments of routes) {
	// Dynamic segments cannot be materialised as a single file; the fallback and
	// _redirects still cover them.
	if (segments.some((s) => s.includes('['))) continue;
	// Clean URLs: Pages serves `/dashboard` from `dashboard.html` with a 200. A
	// `dashboard/index.html` would instead 308 to `/dashboard/`, which conflicts
	// with SvelteKit's trailingSlash: 'never'.
	const targetDir = path.join(buildDir, ...segments.slice(0, -1));
	fs.mkdirSync(targetDir, { recursive: true });
	fs.writeFileSync(path.join(targetDir, `${segments[segments.length - 1]}.html`), shell);
	written.push('/' + segments.join('/'));
}

// Root shell is already present.
written.unshift('/');

// Build identity — commit only, never secrets. Lets production verification
// prove which revision is live.
let commitSha = process.env.CF_PAGES_COMMIT_SHA || process.env.GITHUB_SHA || '';
if (!commitSha) {
	try {
		commitSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
	} catch {
		commitSha = 'unknown';
	}
}
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
fs.writeFileSync(
	path.join(buildDir, 'build-info.json'),
	JSON.stringify(
		{
			app: pkg.name,
			version: pkg.version,
			commitSha,
			branch: process.env.CF_PAGES_BRANCH || process.env.GITHUB_REF_NAME || '',
			environment: process.env.CF_PAGES_BRANCH === 'main' ? 'production' : process.env.CF_PAGES_BRANCH ? 'preview' : 'local',
			builtAt: new Date().toISOString()
		},
		null,
		'\t'
	) + '\n'
);

// Recovery page must always exist in the output.
const notFound = path.join(root, 'static', '404.html');
if (fs.existsSync(notFound)) fs.copyFileSync(notFound, path.join(buildDir, '404.html'));

console.log(`[static-shells] wrote ${written.length} HTML shells: ${written.join(', ')}`);
