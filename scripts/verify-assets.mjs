/**
 * Asset gate: every required WebP must exist, carry a real RIFF/WEBP header,
 * have a 640w derivative, and be byte-unique (no duplicated artwork).
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const REQUIRED = [
	'promo-slide-01',
	'promo-slide-02',
	'promo-slide-03',
	'story-customer',
	'story-discovery',
	'story-guide',
	'feature-learning',
	'feature-workflow',
	'feature-community',
	'dashboard-ecosystem'
];

const failures = [];
const hashes = new Map();

for (const name of REQUIRED) {
	const full = path.join(root, 'static', 'images', 'generated', `${name}.webp`);
	const small = path.join(root, 'static', 'images', 'responsive', `${name}-640.webp`);
	for (const [label, file] of [
		['full', full],
		['640w', small]
	]) {
		if (!fs.existsSync(file)) {
			failures.push(`${name}: missing ${label} derivative`);
			continue;
		}
		const buf = fs.readFileSync(file);
		if (buf.length < 12 || buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') {
			failures.push(`${name}: ${label} is not a valid WebP container`);
		}
		if (buf.length < 4000) failures.push(`${name}: ${label} looks empty (${buf.length} bytes)`);
		if (label === 'full') {
			const { createHash } = await import('node:crypto');
			const hash = createHash('sha256').update(buf).digest('hex');
			if (hashes.has(hash)) failures.push(`${name}: duplicates ${hashes.get(hash)} (byte-identical artwork)`);
			else hashes.set(hash, name);
		}
	}
}

if (failures.length) {
	console.error('[verify-assets] FAILED');
	for (const f of failures) console.error(` - ${f}`);
	process.exit(1);
}
console.log(`[verify-assets] OK — ${REQUIRED.length} unique WebP assets with responsive derivatives.`);
