/**
 * Deployment gate for static delivery.
 *
 * Fails (exit 1) unless every critical route has a real HTML shell in `build/`,
 * `_redirects` provides the SPA fallback, `_routes.json` excludes all paths from
 * Functions, and `404.html` exists. Run in CI before publishing.
 */
import fs from 'node:fs';
import path from 'node:path';

const build = path.join(process.cwd(), 'build');
const failures = [];

const required = [
	'index.html',
	'auth.html',
	'console.html',
	'docs.html',
	'dashboard.html',
	'dashboard/composer.html',
	'dashboard/messages.html',
	'_redirects',
	'_routes.json',
	'404.html',
	'build-info.json',
	'manifest.json',
	'sw.js'
];

for (const rel of required) {
	if (!fs.existsSync(path.join(build, rel))) failures.push(`missing build/${rel}`);
}

const shell = path.join(build, 'index.html');
if (fs.existsSync(shell)) {
	const html = fs.readFileSync(shell, 'utf8');
	if (!html.includes('_app/')) failures.push('index.html does not reference /_app assets');
	if (!/<div[^>]*>/.test(html)) failures.push('index.html has no mount container');
}

const routesFile = path.join(build, '_routes.json');
if (fs.existsSync(routesFile)) {
	try {
		const routes = JSON.parse(fs.readFileSync(routesFile, 'utf8'));
		if (!Array.isArray(routes.include) || routes.include.length !== 0) {
			failures.push('_routes.json must include no paths (static-only delivery)');
		}
		if (!routes.exclude?.includes('/*')) failures.push('_routes.json must exclude /* from Functions');
	} catch (e) {
		failures.push(`_routes.json is not valid JSON: ${e.message}`);
	}
}

const redirects = path.join(build, '_redirects');
if (fs.existsSync(redirects)) {
	const text = fs.readFileSync(redirects, 'utf8');
	if (!/\/\*\s+\/index\.html\s+200/.test(text)) failures.push('_redirects is missing the SPA fallback rule');
}

if (failures.length) {
	console.error('[verify-static] FAILED');
	for (const f of failures) console.error(` - ${f}`);
	process.exit(1);
}
console.log('[verify-static] OK — all critical routes have static HTML shells and Functions are fully excluded.');
