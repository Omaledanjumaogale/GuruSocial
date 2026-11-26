/**
 * Asset pipeline: source JPEGs → optimised WebP (full + 640w derivative).
 * Runs at build/CI time, never inside a request handler.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';

const root = process.cwd();
const sourceDir = path.join(root, 'design-assets', 'generated-source');
const outDir = path.join(root, 'static', 'images', 'generated');
const responsiveDir = path.join(root, 'static', 'images', 'responsive');
const manifestPath = path.join(root, 'reports', 'asset-manifest.json');

fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(responsiveDir, { recursive: true });
fs.mkdirSync(path.dirname(manifestPath), { recursive: true });

if (!fs.existsSync(sourceDir)) {
	console.error('[assets] design-assets/generated-source is missing.');
	process.exit(1);
}

const sources = fs.readdirSync(sourceDir).filter((f) => /\.(jpe?g|png)$/i.test(f));
const assets = [];

for (const file of sources) {
	const name = path.basename(file, path.extname(file));
	const input = path.join(sourceDir, file);
	const full = path.join(outDir, `${name}.webp`);
	const small = path.join(responsiveDir, `${name}-640.webp`);

	const meta = await sharp(input).metadata();
	await sharp(input).resize({ width: 1536, withoutEnlargement: true }).webp({ quality: 82, effort: 5 }).toFile(full);
	await sharp(input).resize({ width: 640, withoutEnlargement: true }).webp({ quality: 80, effort: 5 }).toFile(small);

	const bytes = fs.readFileSync(full);
	assets.push({
		name,
		source: `/design-assets/generated-source/${file}`,
		fullPath: `/images/generated/${name}.webp`,
		responsivePath: `/images/responsive/${name}-640.webp`,
		width: meta.width ?? null,
		height: meta.height ?? null,
		bytes: bytes.length,
		sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
		format: 'webp'
	});
	console.log(`[assets] ${name}: ${(bytes.length / 1024).toFixed(0)} KB webp`);
}

assets.sort((a, b) => a.name.localeCompare(b.name));
fs.writeFileSync(
	manifestPath,
	JSON.stringify(
		{
			generatedAt: new Date().toISOString(),
			generator: 'built-in image generation (no external model entitlement used)',
			transformation: 'sharp → WebP q82 (1536w) + q80 (640w)',
			assets
		},
		null,
		'\t'
	) + '\n'
);

console.log(`[assets] wrote ${assets.length} assets and reports/asset-manifest.json`);
