"use node";
import { v } from 'convex/values';
import { actionGeneric as action, internalActionGeneric as internalAction } from 'convex/server';
import { requireNodeEnv, sha256 } from './lib';
import { anyApi } from 'convex/server';

const api = anyApi;

const PLATFORM_SPECS: Record<string, { name: string; limit: number; hashtags: number }> = {
	facebook: { name: 'Facebook', limit: 63206, hashtags: 5 },
	instagram: { name: 'Instagram', limit: 2200, hashtags: 30 },
	x: { name: 'X', limit: 280, hashtags: 2 },
	linkedin: { name: 'LinkedIn', limit: 3000, hashtags: 3 },
	tiktok: { name: 'TikTok', limit: 4096, hashtags: 6 },
	youtube: { name: 'YouTube', limit: 5000, hashtags: 15 },
	threads: { name: 'Threads', limit: 500, hashtags: 1 },
	bluesky: { name: 'Bluesky', limit: 300, hashtags: 1 },
	pinterest: { name: 'Pinterest', limit: 500, hashtags: 8 },
	telegram: { name: 'Telegram', limit: 4096, hashtags: 5 },
	whatsapp: { name: 'WhatsApp', limit: 4096, hashtags: 2 },
	'google-business': { name: 'Google Business', limit: 1500, hashtags: 2 },
	zalo: { name: 'Zalo', limit: 2000, hashtags: 3 },
	slack: { name: 'Slack', limit: 3000, hashtags: 0 },
	discord: { name: 'Discord', limit: 2000, hashtags: 0 }
};

export interface Draft {
	platform: string;
	content: string;
	hashtags: string[];
	warnings: string[];
	charCount: number;
	charLimit: number;
}

/** Calls the OpenAI-compatible Agnes AI hub with the server-side key. */
async function agnesChat(prompt: string): Promise<string> {
	const key = requireNodeEnv('AGNES_AI_KEY');
	const baseUrl = (process.env.AGNES_BASE_URL ?? 'https://apihub.agnes-ai.com/v1').replace(/\/$/, '');
	const model = process.env.AGNES_MODEL ?? 'agnes-3.0-flash';
	const res = await fetch(`${baseUrl}/chat/completions`, {
		method: 'POST',
		headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
		body: JSON.stringify({
			model,
			messages: [
				{ role: 'system', content: 'You are GuruSocial\'s senior social media copywriter. Output only valid JSON.' },
				{ role: 'user', content: prompt }
			],
			temperature: 0.8,
			max_tokens: 1600
		})
	});
	if (!res.ok) {
		const text = await res.text();
		throw new Error(`Agnes AI error ${res.status}: ${text.slice(0, 200)}`);
	}
	const data = await res.json();
	return data.choices?.[0]?.message?.content ?? '';
}

function normalizeDrafts(raw: string, platforms: string[]): Draft[] {
	let parsed: any[] = [];
	try {
		const json = raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1);
		const obj = JSON.parse(json);
		parsed = Array.isArray(obj) ? obj : obj.posts ?? obj.drafts ?? [obj];
	} catch {
		throw new Error('Model returned unparseable JSON. Try regenerating.');
	}
	return platforms.map((platform) => {
		const spec = PLATFORM_SPECS[platform] ?? { name: platform, limit: 2200, hashtags: 5 };
		const match = parsed.find((d) => String(d.platform).toLowerCase() === platform) ?? parsed[0] ?? {};
		const content = String(match.content ?? '').slice(0, spec.limit * 2);
		const hashtags = (match.hashtags ?? []).slice(0, spec.hashtags).map((t: string) => '#' + String(t).replace(/^#/, '').replace(/\s+/g, ''));
		const finalContent = spec.hashtags === 0 ? content : `${content}\n\n${hashtags.join(' ')}`.trim();
		return {
			platform,
			content: finalContent,
			hashtags,
			warnings: finalContent.length > spec.limit ? [`Trim to ${spec.limit} characters for ${spec.name}.`] : [],
			charCount: finalContent.length,
			charLimit: spec.limit
		};
	});
}

/** Internal: model-backed draft generation for one workspace (auth checked by caller). */
export const generateInternal = internalAction({
	args: {
		topic: v.string(), sourceText: v.optional(v.string()), brandTone: v.optional(v.string()),
		keyMessages: v.optional(v.array(v.string())), hashtags: v.optional(v.array(v.string())),
		platforms: v.array(v.string())
	},
	returns: v.array(v.any()),
	handler: async (ctx, { topic, sourceText, brandTone, keyMessages, hashtags, platforms }) => {
		const prompt = [
			`Write social media posts about "${topic}".`,
			sourceText ? `Base them on this source material:\n"""${sourceText.slice(0, 4000)}"""` : '',
			`Tone: ${brandTone ?? 'confident, plain-spoken, helpful'}.`,
			keyMessages?.length ? `Brand key messages to weave in: ${keyMessages.join('; ')}.` : '',
			hashtags?.length ? `Prefer these hashtags where natural: ${hashtags.map((h) => '#' + h.replace(/^#/, '')).join(' ')}.` : '',
			`For EACH of these platforms — ${platforms.join(', ')} — respect its character limits and hashtag norms (X: 280, Bluesky: 300, Threads: 500).`,
			'Return strict JSON: {"posts":[{"platform":"<slug>","content":"...","hashtags":["..."]}]} with one entry per platform.'
		].filter(Boolean).join('\n\n');
		const raw = await agnesChat(prompt);
		return normalizeDrafts(raw, platforms);
	}
});

/** Public action: sign-in required; uses the workspace brand kit. */
export const generate = action({
	args: {
		token: v.string(), topic: v.string(), sourceText: v.optional(v.string()), platforms: v.array(v.string())
	},
	returns: v.array(v.any()),
	handler: async (ctx, { token, topic, sourceText, platforms }) => {
		if (!platforms.length) throw new Error('Select at least one platform.');
		const session = await ctx.runQuery(api.authInternal.byToken, { token });
		if (!session) throw new Error('Your session has expired. Please sign in again.');
		const kits = await ctx.runQuery(api.crmInternal.kitsForUser, { userId: String(session.userId) });
		const kit: any = kits[0];
		try {
			return await ctx.runAction(api.ai.generateInternal, {
				topic, sourceText, brandTone: kit?.tone, keyMessages: kit?.keyMessages,
				hashtags: kit?.hashtags, platforms
			});
		} catch (e: any) {
			throw new Error(`${e.message} — the built-in offline generator is used automatically when the model is unavailable.`);
		}
	}
});
