import { httpRouter, httpActionGeneric } from 'convex/server';
import { v } from 'convex/values';
import { anyApi } from 'convex/server';
import { sha256 } from './lib';

const api = anyApi;

/**
 * GuruSocial public API surface (Ayrshare / PostMCP / PostProxy / SocialAPI.ai style):
 *   POST /api/v1/posts                 publish now / schedule / draft
 *   GET  /api/v1/posts?status=&limit=  list posts
 *   GET  /api/v1/profiles              connected profiles
 *   GET  /api/v1/analytics/top?metric= ranked published posts
 *   POST /api/v1/inbox/reply           reply to an inbox item
 *   POST /mcp                          MCP JSON-RPC (tools/call: create_post, preflight_post, list_profiles, list_posts, get_post_analytics)
 *
 * Auth: `Authorization: Bearer gs_live_...` or `gs_sandbox_...` API key.
 * Sandbox keys read the same data but never publish (dry-run result returned).
 */
async function resolveKey(runQuery: any, authHeader: string | null) {
	if (!authHeader?.startsWith('Bearer ')) throw new ApiError(401, 'Missing Bearer API key.');
	const full = authHeader.slice(7).trim();
	const row = await runQuery(api.keysInternal.byHash, { keyHash: sha256(full) });
	if (!row) throw new ApiError(401, 'Invalid or revoked API key.');
	return row; // { userId, mode, scopes, prefix }
}

async function recordLog(runMutation: any, userId: string, method: string, path: string, status: number, started: number, platforms?: string[], summary?: string) {
	await runMutation(api.keysInternal.log, {
		userId, method, path, status, durationMs: Date.now() - started,
		platforms: platforms ?? null, requestSummary: summary ?? ''
	});
}

class ApiError extends Error {
	status: number;
	constructor(status: number, message: string) {
		super(message);
		this.status = status;
	}
}

function json(data: unknown, status = 200) {
	return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } });
}

async function handleError(fn: () => Promise<Response>) {
	try {
		return await fn();
	} catch (e: any) {
		if (e instanceof ApiError) return json({ error: e.message }, e.status);
		return json({ error: e?.message ?? 'Internal error' }, 500);
	}
}

const corsPreflight = httpActionGeneric(async () =>
	new Response(null, {
		status: 204,
		headers: {
			'access-control-allow-origin': '*',
			'access-control-allow-methods': 'GET, POST, OPTIONS',
			'access-control-allow-headers': 'authorization, content-type, mcp-session-id'
		}
	})
);

/* --------------------------------- REST ---------------------------------- */

export const createPost = httpActionGeneric(async (ctx, request) => handleError(async () => {
	const started = Date.now();
	const body = await request.json();
	const key = await resolveKey(ctx.runQuery, request.headers.get('authorization'));
	const now = Date.now();
	const isDraft = body.draft === true;
	const scheduledAt = body.scheduledAt ? new Date(body.scheduledAt).getTime() : undefined;
	if (key.mode === 'sandbox' && !isDraft) {
		await recordLog(ctx.runMutation, key.userId, 'POST', '/api/v1/posts', 200, started, body.platforms, 'sandbox dry-run');
		return json({
			mode: 'sandbox',
			validation: { ok: true, platforms: body.platforms ?? [], warnings: ['Sandbox key: nothing was published. Create a live key to publish.'] },
			preview: { content: body.content, media: body.mediaUrls ?? [], scheduledAt: body.scheduledAt ?? null }
		});
	}
	const result = await ctx.runMutation(api.postsApi.createForApiKey, {
		userId: key.userId, content: String(body.content ?? ''), platforms: (body.platforms ?? []).map(String),
		scheduledAt, mediaUrls: body.mediaUrls ?? [], firstComment: body.firstComment ?? undefined, draft: isDraft
	});
	await recordLog(ctx.runMutation, key.userId, 'POST', '/api/v1/posts', 201, started, body.platforms, String(body.content ?? '').slice(0, 120));
	return json({ postId: result.postId, status: scheduledAt ? 'scheduled' : isDraft ? 'draft' : 'published', publishedAt: scheduledAt ? undefined : now }, 201);
}));

export const listPosts = httpActionGeneric(async (ctx, request) => handleError(async () => {
	const started = Date.now();
	const key = await resolveKey(ctx.runQuery, request.headers.get('authorization'));
	const url = new URL(request.url);
	const status = url.searchParams.get('status') ?? undefined;
	const limit = Number(url.searchParams.get('limit') ?? 20);
	const rows = await ctx.runQuery(api.postsApi.listForApiKey, { userId: key.userId, status, limit: Math.min(limit, 100) });
	await recordLog(ctx.runMutation, key.userId, 'GET', '/api/v1/posts', 200, started);
	return json({ posts: rows });
}));

export const listProfilesApi = httpActionGeneric(async (ctx, request) => handleError(async () => {
	const started = Date.now();
	const key = await resolveKey(ctx.runQuery, request.headers.get('authorization'));
	const rows = await ctx.runQuery(api.postsApi.profilesForApiKey, { userId: key.userId });
	await recordLog(ctx.runMutation, key.userId, 'GET', '/api/v1/profiles', 200, started);
	return json({ profiles: rows });
}));

export const analyticsTop = httpActionGeneric(async (ctx, request) => handleError(async () => {
	const started = Date.now();
	const key = await resolveKey(ctx.runQuery, request.headers.get('authorization'));
	const url = new URL(request.url);
	const rows = await ctx.runQuery(api.postsApi.topAnalyticsForApiKey, {
		userId: key.userId, metric: url.searchParams.get('metric') ?? 'impressions', limit: Number(url.searchParams.get('limit') ?? 10)
	});
	await recordLog(ctx.runMutation, key.userId, 'GET', '/api/v1/analytics/top', 200, started);
	return json({ posts: rows });
}));

export const inboxReply = httpActionGeneric(async (ctx, request) => handleError(async () => {
	const started = Date.now();
	const body = await request.json();
	const key = await resolveKey(ctx.runQuery, request.headers.get('authorization'));
	if (key.mode === 'sandbox') return json({ mode: 'sandbox', validation: { ok: true, warnings: ['Sandbox key: reply not sent.'] } });
	await ctx.runMutation(api.postsApi.replyForApiKey, { userId: key.userId, inboxItemId: String(body.inboxItemId), message: String(body.message ?? '') });
	await recordLog(ctx.runMutation, key.userId, 'POST', '/api/v1/inbox/reply', 200, started, undefined, String(body.inboxItemId));
	return json({ ok: true });
}));

/* ---------------------------------- MCP ---------------------------------- */

const MCP_TOOLS = [
	{ name: 'list_profiles', description: 'List connected social profiles with their platform and status.', inputSchema: { type: 'object', properties: {} } },
	{ name: 'preflight_post', description: 'Dry-run validation: platforms, limits, media ceilings and content warnings before publishing.', inputSchema: { type: 'object', properties: { content: { type: 'string' }, platforms: { type: 'array', items: { type: 'string' } }, mediaUrls: { type: 'array', items: { type: 'string' } } }, required: ['content', 'platforms'] } },
	{ name: 'create_post', description: 'Publish or schedule a post to one or more platforms in a single call.', inputSchema: { type: 'object', properties: { content: { type: 'string' }, platforms: { type: 'array', items: { type: 'string' } }, scheduledAt: { type: 'string', description: 'ISO 8601 timestamp (omit to publish now)' }, mediaUrls: { type: 'array', items: { type: 'string' } }, firstComment: { type: 'string' } }, required: ['content', 'platforms'] } },
	{ name: 'list_posts', description: 'List recent posts with status filters.', inputSchema: { type: 'object', properties: { status: { type: 'string' }, limit: { type: 'number' } } } },
	{ name: 'get_post_analytics', description: 'Per-platform analytics for one post.', inputSchema: { type: 'object', properties: { postId: { type: 'string' } }, required: ['postId'] } }
];

/* ------------------------------ OAuth ------------------------------ */

function appUrlFromState(state: string | null): string {
	try {
		const b64 = (state ?? '').replace(/-/g, '+').replace(/_/g, '/');
		const decoded = JSON.parse(decodeURIComponent(escape(atob(b64))));
		if (decoded?.a && /^https:\/\//.test(decoded.a)) return decoded.a.replace(/\/$/, '');
	} catch { /* fall through */ }
	return 'https://gurusocial.pages.dev';
}

const googleCallback = httpActionGeneric(async (ctx, request) => handleError(async () => {
	const url = new URL(request.url);
	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	const appUrl = appUrlFromState(state);
	if (!code) return new Response(null, { status: 302, headers: { location: `${appUrl}/auth?oauth_error=missing_code` } });
	try {
		const profile = await ctx.runAction(api.oauthActions.exchangeGoogle, { code, redirectUri: `${url.origin}/oauth/google/callback` });
		const { token, isNew } = await ctx.runMutation(api.oauthInternal.upsertOAuthUser, {
			provider: 'google', providerAccountId: profile.providerAccountId, email: profile.email, name: profile.name
		});
		if (isNew) await ctx.runAction(api.email.sendWelcomeInternal, { to: profile.email, name: profile.name });
		return new Response(null, { status: 302, headers: { location: `${appUrl}/auth?token=${token}&provider=google` } });
	} catch (e: any) {
		return new Response(null, { status: 302, headers: { location: `${appUrl}/auth?oauth_error=${encodeURIComponent(String(e.message).slice(0, 120))}` } });
	}
}));

const githubCallback = httpActionGeneric(async (ctx, request) => handleError(async () => {
	const url = new URL(request.url);
	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	const appUrl = appUrlFromState(state);
	if (!code) return new Response(null, { status: 302, headers: { location: `${appUrl}/auth?oauth_error=missing_code` } });
	try {
		const profile = await ctx.runAction(api.oauthActions.exchangeGithub, { code, redirectUri: `${url.origin}/oauth/github/callback` });
		const { token, isNew } = await ctx.runMutation(api.oauthInternal.upsertOAuthUser, {
			provider: 'github', providerAccountId: profile.providerAccountId, email: profile.email, name: profile.name
		});
		if (isNew) await ctx.runAction(api.email.sendWelcomeInternal, { to: profile.email, name: profile.name });
		return new Response(null, { status: 302, headers: { location: `${appUrl}/auth?token=${token}&provider=github` } });
	} catch (e: any) {
		return new Response(null, { status: 302, headers: { location: `${appUrl}/auth?oauth_error=${encodeURIComponent(String(e.message).slice(0, 120))}` } });
	}
}));

/* -------------------------- AI drafts endpoint -------------------------- */

const aiDrafts = httpActionGeneric(async (ctx, request) => handleError(async () => {
	const started = Date.now();
	const body = await request.json();
	const key = await resolveKey(ctx.runQuery, request.headers.get('authorization'));
	const kits = await ctx.runQuery(api.crmInternal.kitsForUser, { userId: key.userId });
	const drafts = await ctx.runAction(api.ai.generateInternal, {
		topic: String(body.topic ?? ''),
		sourceText: body.sourceText ?? undefined,
		brandTone: (kits[0] as any)?.tone,
		keyMessages: (kits[0] as any)?.keyMessages,
		hashtags: (kits[0] as any)?.hashtags,
		platforms: (body.platforms ?? []).map(String)
	});
	await recordLog(ctx.runMutation, key.userId, 'POST', '/api/v1/ai/drafts', 200, started, body.platforms, String(body.topic ?? '').slice(0, 100));
	return json({ drafts });
}));

/* ------------------------- E-WIN signed service channel ------------------------- */

async function ewinGuard(ctx: any, request: Request, path: string): Promise<{ ok: boolean; body?: any }> {
	const raw = await request.text();
	if (raw.length > 4096) return { ok: false };
	const ts = request.headers.get('x-ewin-timestamp');
	const sig = request.headers.get('x-ewin-signature');
	if (!ts || !sig) return { ok: false };
	const valid = await ctx.runAction(api.ewinActions.verifySignature, { path, timestamp: ts, rawBody: raw, signature: sig });
	if (!valid) return { ok: false };
	try { return { ok: true, body: JSON.parse(raw) }; } catch { return { ok: false }; }
}

const ewinNoStore = { 'content-type': 'application/json', 'cache-control': 'no-store', 'access-control-allow-origin': '*' };

const ewinLink = httpActionGeneric(async (ctx, request) => handleError(async () => {
	const guard = await ewinGuard(ctx, request, '/integrations/ewin/link');
	if (!guard.ok) return json({ error: 'Unauthorized or malformed request.' }, 401);
	try {
		const result = await ctx.runAction(api.ewinActions.completeLink, {
			code: String(guard.body?.code ?? ''), hubUserId: String(guard.body?.hubUserId ?? ''), hubEmail: String(guard.body?.hubEmail ?? '')
		});
		return new Response(JSON.stringify(result), { status: 200, headers: ewinNoStore });
	} catch (e: any) {
		return json({ error: e.message }, 422);
	}
}));

const ewinReport = httpActionGeneric(async (ctx, request) => handleError(async () => {
	const guard = await ewinGuard(ctx, request, '/integrations/ewin/report');
	if (!guard.ok) return json({ error: 'Unauthorized or malformed request.' }, 401);
	const result = await ctx.runAction(api.ewinActions.buildReport, {
		sourceUserId: String(guard.body?.sourceUserId ?? ''), hubUserId: String(guard.body?.hubUserId ?? '')
	});
	return new Response(JSON.stringify(result), { status: 200, headers: ewinNoStore });
}));

const ewinRevoke = httpActionGeneric(async (ctx, request) => handleError(async () => {
	const guard = await ewinGuard(ctx, request, '/integrations/ewin/revoke');
	if (!guard.ok) return json({ error: 'Unauthorized or malformed request.' }, 401);
	const result = await ctx.runAction(api.ewinActions.revoke, {
		sourceUserId: String(guard.body?.sourceUserId ?? ''), hubUserId: String(guard.body?.hubUserId ?? '')
	});
	return new Response(JSON.stringify(result ?? { revoked: true }), { status: 200, headers: ewinNoStore });
}));

const httpApi = httpRouter();
httpApi.route({ path: '/api/v1/posts', method: 'POST', handler: createPost });
httpApi.route({ path: '/api/v1/posts', method: 'GET', handler: listPosts });
httpApi.route({ path: '/api/v1/profiles', method: 'GET', handler: listProfilesApi });
httpApi.route({ path: '/api/v1/analytics/top', method: 'GET', handler: analyticsTop });
httpApi.route({ path: '/api/v1/inbox/reply', method: 'POST', handler: inboxReply });
httpApi.route({ path: '/api/v1/ai/drafts', method: 'POST', handler: aiDrafts });
httpApi.route({ path: '/oauth/google/callback', method: 'GET', handler: googleCallback });
httpApi.route({ path: '/integrations/ewin/link', method: 'POST', handler: ewinLink });
httpApi.route({ path: '/integrations/ewin/report', method: 'POST', handler: ewinReport });
httpApi.route({ path: '/integrations/ewin/revoke', method: 'POST', handler: ewinRevoke });
httpApi.route({ path: '/oauth/github/callback', method: 'GET', handler: githubCallback });
httpApi.route({ pathPrefix: '/', method: 'OPTIONS', handler: corsPreflight });

// Generic /mcp handler
httpApi.route({
	path: '/mcp',
	method: 'POST',
	handler: httpActionGeneric(async (ctx, request) => handleError(async () => {
		const body = await request.json();
		const { id, method, params } = body ?? {};
		const respond = (result: unknown) => json({ jsonrpc: '2.0', id: id ?? null, result });
		switch (method) {
			case 'initialize':
				return respond({
					protocolVersion: params?.protocolVersion ?? '2025-03-26',
					capabilities: { tools: {} },
					serverInfo: { name: 'gurusocial-mcp', version: '1.0.0' }
				});
			case 'tools/list':
				return respond({ tools: MCP_TOOLS });
			case 'tools/call': {
				const key = await resolveKey(ctx.runQuery, request.headers.get('authorization'));
				const args = params?.arguments ?? {};
				switch (params?.name) {
					case 'list_profiles': {
						const rows = await ctx.runQuery(api.postsApi.profilesForApiKey, { userId: key.userId });
						return respond({ content: [{ type: 'text', text: JSON.stringify(rows, null, 2) }] });
					}
					case 'preflight_post': {
						const warnings: string[] = [];
						const content = String(args.content ?? '');
						const limits: Record<string, number> = { x: 280, instagram: 2200, linkedin: 3000, facebook: 63206, threads: 500, bluesky: 300, tiktok: 4096 };
						for (const p of args.platforms ?? []) {
							const lim = limits[p];
							if (lim && content.length > lim) warnings.push(`${p}: content exceeds ${lim} characters (currently ${content.length}).`);
						}
						const mediaCount = (args.mediaUrls ?? []).length;
						if (mediaCount > 10) warnings.push(`carousel ceiling exceeded: max 10 media, got ${mediaCount}.`);
						if (!(args.platforms ?? []).length) warnings.push('no platforms selected.');
						return respond({ content: [{ type: 'text', text: JSON.stringify({ ok: warnings.length === 0, warnings }, null, 2) }] });
					}
					case 'create_post': {
						if (key.mode === 'sandbox') {
							return respond({ content: [{ type: 'text', text: 'Sandbox key: dry-run only. Nothing was published.' }] });
						}
						const result = await ctx.runMutation(api.postsApi.createForApiKey, {
							userId: key.userId, content: String(args.content ?? ''), platforms: (args.platforms ?? []).map(String),
							scheduledAt: args.scheduledAt ? new Date(args.scheduledAt).getTime() : undefined,
							mediaUrls: args.mediaUrls ?? [], firstComment: args.firstComment ?? undefined, draft: false
						});
						return respond({ content: [{ type: 'text', text: `Post ${result.postId} created.` }] });
					}
					case 'list_posts': {
						const rows = await ctx.runQuery(api.postsApi.listForApiKey, { userId: key.userId, status: args.status ?? undefined, limit: Math.min(args.limit ?? 20, 100) });
						return respond({ content: [{ type: 'text', text: JSON.stringify(rows, null, 2) }] });
					}
					case 'get_post_analytics': {
						const rows = await ctx.runQuery(api.postsApi.analyticsForPostApiKey, { userId: key.userId, postId: String(args.postId) });
						return respond({ content: [{ type: 'text', text: JSON.stringify(rows, null, 2) }] });
					}
					default:
						return json({ jsonrpc: '2.0', id: id ?? null, error: { code: -32602, message: `Unknown tool: ${params?.name}` } });
				}
			}
			case 'notifications/initialized':
				return new Response(null, { status: 202 });
			default:
				return json({ jsonrpc: '2.0', id: id ?? null, error: { code: -32601, message: `Method not found: ${method}` } });
		}
	}))
});

// MCP over GET (capability discovery notice)
httpApi.route({
	path: '/mcp',
	method: 'GET',
	handler: httpActionGeneric(async () =>
		json({
			name: 'gurusocial-mcp',
			transport: 'streamable-http',
			auth: 'Bearer gs_live_… API key',
			tools: MCP_TOOLS.map((t) => t.name),
			note: 'Send JSON-RPC 2.0 POST requests here. Use initialize, tools/list and tools/call.'
		})
	)
});

export default httpApi;
