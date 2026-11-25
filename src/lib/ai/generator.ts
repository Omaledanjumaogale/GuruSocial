/**
 * GuruSocial AI content engine (client library).
 *
 * Harmonized from Blotato's "point it at anything, get a post" flow and
 * Buffer/Sprout composer best practices. Works fully offline with
 * deterministic, evidence-based copywriting heuristics; if the user supplies
 * an LLM provider key in Settings, `generateWithLLM` upgrades to model-backed
 * generation. No key ships with this app.
 */

export type Platform = string;

export interface PlatformSpec {
	slug: string;
	name: string;
	charLimit: number;
	hashtagLimit: number;
	tone: 'professional' | 'casual' | 'visual' | 'concise';
}

export const PLATFORM_SPECS: PlatformSpec[] = [
	{ slug: 'facebook', name: 'Facebook', charLimit: 63206, hashtagLimit: 5, tone: 'casual' },
	{ slug: 'instagram', name: 'Instagram', charLimit: 2200, hashtagLimit: 30, tone: 'visual' },
	{ slug: 'x', name: 'X (Twitter)', charLimit: 280, hashtagLimit: 2, tone: 'concise' },
	{ slug: 'linkedin', name: 'LinkedIn', charLimit: 3000, hashtagLimit: 3, tone: 'professional' },
	{ slug: 'tiktok', name: 'TikTok', charLimit: 4096, hashtagLimit: 6, tone: 'visual' },
	{ slug: 'youtube', name: 'YouTube', charLimit: 5000, hashtagLimit: 15, tone: 'visual' },
	{ slug: 'threads', name: 'Threads', charLimit: 500, hashtagLimit: 1, tone: 'casual' },
	{ slug: 'bluesky', name: 'Bluesky', charLimit: 300, hashtagLimit: 1, tone: 'concise' },
	{ slug: 'pinterest', name: 'Pinterest', charLimit: 500, hashtagLimit: 8, tone: 'visual' },
	{ slug: 'telegram', name: 'Telegram', charLimit: 4096, hashtagLimit: 5, tone: 'casual' },
	{ slug: 'whatsapp', name: 'WhatsApp', charLimit: 4096, hashtagLimit: 2, tone: 'casual' },
	{ slug: 'google-business', name: 'Google Business', charLimit: 1500, hashtagLimit: 2, tone: 'professional' },
	{ slug: 'zalo', name: 'Zalo', charLimit: 2000, hashtagLimit: 3, tone: 'casual' },
	{ slug: 'slack', name: 'Slack', charLimit: 3000, hashtagLimit: 0, tone: 'concise' },
	{ slug: 'discord', name: 'Discord', charLimit: 2000, hashtagLimit: 0, tone: 'concise' }
];

const HOOK_TEMPLATES = [
	'Here is what nobody tells you about {topic}:',
	'{topic} in 30 seconds — no fluff:',
	'The 3 things that changed how we do {topic}:',
	'Stop guessing with {topic}. Read this first.',
	'We tested {topic} for weeks. Here is the honest result.',
	'{topic} looks complicated. It is not. Here is the map.'
];

const CTA_TEMPLATES = [
	'Try it free — link in bio.',
	'Full breakdown on our blog.',
	'Drop a 🔥 if this helps.',
	'Save this for later.',
	'Tag someone who needs to see this.'
];

function pick<T>(arr: T[], seed: number): T {
	return arr[Math.abs(seed) % arr.length];
}

export function platformSpec(slug: string): PlatformSpec {
	return PLATFORM_SPECS.find((p) => p.slug === slug) ?? PLATFORM_SPECS[0];
}

export interface DraftRequest {
	topic: string;
	sourceText?: string; // pasted article / notes / transcript
	brandTone?: string;
	keyMessages?: string[];
	hashtags?: string[];
	platforms: string[];
	variantSeed?: number;
}

export interface Draft {
	platform: string;
	content: string;
	hashtags: string[];
	warnings: string[];
	charCount: number;
	charLimit: number;
}

/** Deterministic, platform-tuned draft generation. */
export function generateDrafts(req: DraftRequest): Draft[] {
	const seedBase = (req.variantSeed ?? 0) + req.topic.length;
	const tone = req.brandTone || 'confident, plain-spoken, helpful';
	const keyMsg = req.keyMessages?.[0];
	const source = (req.sourceText ?? '').replace(/\s+/g, ' ').trim();

	return req.platforms.map((platform, idx) => {
		const spec = platformSpec(platform);
		const seed = seedBase + idx * 7 + platform.length;
		const topic = req.topic.trim().replace(/[.。]+$/, '');
		const hook = pick(HOOK_TEMPLATES, seed).replace('{topic}', topic);
		let body: string;
		if (source && source.length > 60) {
			const sentences = source.split(/(?<=[.!?])\s+/);
			const key = sentences.slice(0, spec.tone === 'concise' ? 2 : 3).join(' ');
			body = key.length > 400 ? key.slice(0, 397) + '…' : key;
		} else {
			body =
				spec.tone === 'professional'
					? `${hook}\n\n1) ${keyMsg ?? 'Consolidate the stack'} — one API instead of five vendor tabs.\n2) Ship faster — AI drafts tuned per network.\n3) Prove it — unified analytics on every post.\n\n${tone}.`
					: spec.tone === 'concise'
						? `${hook} ${keyMsg ?? 'One API, one inbox, one CRM.'}`
						: spec.tone === 'visual'
							? `${hook}\n\n🎬 ${topic} — the 3-step version:\n1. Point it at your idea\n2. Pick your platforms\n3. Ship everywhere at once\n${CTA_TEMPLATES[seed % CTA_TEMPLATES.length]}`
							: `${hook}\n\n${keyMsg ?? 'It works across 15 platforms from one call.'}\n\n${pick(CTA_TEMPLATES, seed + 3)}`;
		}
		const tags = (req.hashtags ?? ['gurusocial']).slice(0, spec.hashtagLimit).map((t) => '#' + t.replace(/^#/, '').replace(/\s+/g, ''));
		const content = spec.hashtagLimit === 0 ? body : `${body}\n\n${tags.join(' ')}`;
		const warnings: string[] = [];
		if (content.length > spec.charLimit) warnings.push(`Trim to ${spec.charLimit} characters for ${spec.name}.`);
		return { platform, content, hashtags: tags, warnings, charCount: content.length, charLimit: spec.charLimit };
	});
}

/** Best-time suggestions (Metricool/Sprout style) derived from queue slots. */
export function bestTimes(platform: string): string[] {
	const table: Record<string, string[]> = {
		linkedin: ['Tue–Thu 08:00', 'Wed 12:00'],
		instagram: ['Mon 11:00', 'Thu 19:00', 'Sat 10:00'],
		x: ['Mon 12:00', 'Fri 17:00'],
		tiktok: ['Tue 21:00', 'Fri 15:00'],
		facebook: ['Wed 13:00', 'Sun 11:00'],
		youtube: ['Sat 09:00'],
		default: ['Tue 10:00', 'Thu 14:00']
	};
	return table[platform] ?? table.default;
}

/** Optional model-backed generation: user supplies their own provider key in Settings. */
export async function generateWithLLM(req: DraftRequest & { provider: string; apiKey: string }): Promise<Draft[]> {
	const prompt = `Write social posts about "${req.topic}"${req.sourceText ? ` based on this source: ${req.sourceText.slice(0, 4000)}` : ''}.
Tone: ${req.brandTone ?? 'professional, plain-spoken'}. Brand key messages: ${(req.keyMessages ?? []).join('; ')}.
For each platform (${req.platforms.join(', ')}), respect its character limit and hashtag norms.
Return JSON: [{"platform":"...","content":"...","hashtags":["..."]}]`;
	const res = await fetch('https://api.openai.com/v1/chat/completions', {
		method: 'POST',
		headers: { 'content-type': 'application/json', authorization: `Bearer ${req.apiKey}` },
		body: JSON.stringify({
			model: 'gpt-4o-mini',
			messages: [{ role: 'user', content: prompt }],
			response_format: { type: 'json_object' }
		})
	});
	if (!res.ok) throw new Error(`LLM provider returned ${res.status}. Check your key or use the built-in generator.`);
	const data = await res.json();
	const parsed = JSON.parse(data.choices[0].message.content);
	const list: any[] = Array.isArray(parsed) ? parsed : parsed.posts ?? [];
	return list.map((d) => {
		const spec = platformSpec(d.platform);
		return { platform: d.platform, content: d.content, hashtags: d.hashtags ?? [], warnings: [], charCount: d.content.length, charLimit: spec.charLimit };
	});
}

/** Content extraction from a URL — Blotato's "point it at anything". */
export async function extractFromUrl(url: string): Promise<{ title: string; text: string }> {
	const res = await fetch('https://r.jina.ai/' + url, { headers: { accept: 'text/plain' } });
	if (!res.ok) throw new Error(`Could not read ${url} (${res.status}).`);
	const text = await res.text();
	const lines = text.split('\n').filter(Boolean);
	const title = lines.find((l) => l.startsWith('Title:'))?.replace(/^Title:\s*/, '') ?? url;
	return { title, text: text.slice(0, 6000) };
}
