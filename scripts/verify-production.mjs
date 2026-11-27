/**
 * Post-deploy verification of the live site.
 *
 * Fails (exit 1) unless the production origin serves the critical routes as
 * real HTML shells with the app mount container, and the machine-readable
 * artifacts (`build-info.json`, `manifest.json`) parse. Run after publishing:
 *
 *   APP_ORIGIN=https://gurusocial.ewinproject.org npm run production:verify
 */

const origin = (process.env.APP_ORIGIN || 'https://gurusocial.ewinproject.org').replace(/\/+$/, '');
const TIMEOUT_MS = 20_000;

const routes = [
	['/', 'html'],
	['/auth', 'html'],
	['/console', 'html'],
	['/docs', 'html'],
	['/pricing', 'html'],
	['/dashboard', 'html'],
	['/dashboard/composer', 'html'],
	['/dashboard/messages', 'html'],
	['/dashboard/ecosystem', 'html']
];
const artifacts = ['/build-info.json', '/manifest.json'];

const failures = [];

async function get(path) {
	const res = await fetch(origin + path, {
		signal: AbortSignal.timeout(TIMEOUT_MS),
		headers: { accept: path.endsWith('.json') ? 'application/json' : 'text/html' }
	});
	return { res, body: await res.text() };
}

for (const [path] of routes) {
	try {
		const { res, body } = await get(path);
		const type = res.headers.get('content-type') || '';
		if (res.status !== 200) failures.push(`${path} returned HTTP ${res.status}`);
		if (!type.includes('text/html')) failures.push(`${path} served ${type || 'no content-type'} instead of HTML`);
		if (!/<div[^>]*>/.test(body)) failures.push(`${path} has no mount container`);
		if (!/GuruSocial/.test(body)) failures.push(`${path} is missing the GuruSocial shell marker`);
	} catch (e) {
		failures.push(`${path} failed: ${e?.message ?? e}`);
	}
}

for (const path of artifacts) {
	try {
		const { res, body } = await get(path);
		if (res.status !== 200) failures.push(`${path} returned HTTP ${res.status}`);
		JSON.parse(body);
	} catch (e) {
		failures.push(`${path} failed: ${e?.message ?? e}`);
	}
}

if (failures.length) {
	console.error('[verify-production] FAILED for ' + origin);
	for (const f of failures) console.error(' - ' + f);
	process.exit(1);
}
console.log(`[verify-production] OK — ${routes.length} routes and ${artifacts.length} artifacts respond on ${origin}.`);
