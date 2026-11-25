import { v } from 'convex/values';
import { mutationGeneric as mutation, queryGeneric as query } from 'convex/server';
import { requireUser, apiKey, sha256 } from './lib';

export const listKeys = query({
	args: { token: v.string() },
	returns: v.array(v.any()),
	handler: async (ctx, { token }) => {
		const user = await requireUser(ctx, token);
		const rows = await ctx.db
			.query('apiKeys')
			.withIndex('by_user', (q) => q.eq('userId', user._id))
			.collect();
		return rows.sort((a, b) => b.createdAt - a.createdAt).map((r) => ({
			_id: String(r._id), name: r.name, keyPrefix: r.keyPrefix, scopes: r.scopes,
			mode: r.mode, revokedAt: r.revokedAt ?? null, lastUsedAt: r.lastUsedAt ?? null, createdAt: r.createdAt
		}));
	}
});

export const createKey = mutation({
	args: { token: v.string(), name: v.string(), scopes: v.array(v.string()), mode: v.union(v.literal('live'), v.literal('sandbox')) },
	returns: v.object({ key: v.string(), prefix: v.string() }),
	handler: async (ctx, { token, name, scopes, mode }) => {
		const user = await requireUser(ctx, token);
		const { full, prefix } = apiKey(mode);
		await ctx.db.insert('apiKeys', {
			userId: user._id, name, keyPrefix: prefix, keyHash: sha256(full), scopes, mode, createdAt: Date.now()
		});
		await ctx.db.insert('auditLog', {
			userId: user._id, actor: user.name, action: 'apikey.created', target: prefix, detail: scopes.join(','), createdAt: Date.now()
		});
		return { key: full, prefix };
	}
});

export const revokeKey = mutation({
	args: { token: v.string(), id: v.string() },
	returns: v.null(),
	handler: async (ctx, { token, id }) => {
		const user = await requireUser(ctx, token);
		await ctx.db.patch(id as any, { revokedAt: Date.now() });
		await ctx.db.insert('auditLog', { userId: user._id, actor: user.name, action: 'apikey.revoked', target: id, detail: '', createdAt: Date.now() });
	}
});

export const webhooks = query({
	args: { token: v.string() },
	returns: v.array(v.any()),
	handler: async (ctx, { token }) => {
		const user = await requireUser(ctx, token);
		return await ctx.db
			.query('webhooks')
			.withIndex('by_user', (q) => q.eq('userId', user._id))
			.collect();
	}
});

export const addWebhook = mutation({
	args: { token: v.string(), url: v.string(), events: v.array(v.string()) },
	returns: v.object({ webhookId: v.string() }),
	handler: async (ctx, { token, url, events }) => {
		const user = await requireUser(ctx, token);
		if (!/^https?:\/\//.test(url)) throw new Error('Webhook URL must start with http(s)://');
		const id = await ctx.db.insert('webhooks', { userId: user._id, url, events, active: true, createdAt: Date.now() });
		return { webhookId: String(id) };
	}
});

export const removeWebhook = mutation({
	args: { token: v.string(), id: v.string() },
	returns: v.null(),
	handler: async (ctx, { token, id }) => {
		await requireUser(ctx, token);
		await ctx.db.delete(id as any);
	}
});

export const logs = query({
	args: { token: v.string(), limit: v.optional(v.number()) },
	returns: v.array(v.any()),
	handler: async (ctx, { token, limit }) => {
		const user = await requireUser(ctx, token);
		const rows = await ctx.db
			.query('apiLogs')
			.withIndex('by_user', (q) => q.eq('userId', user._id))
			.collect();
		return rows.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit ?? 50).map((r) => ({ ...r, _id: String(r._id) }));
	}
});

export const auditTrail = query({
	args: { token: v.string(), limit: v.optional(v.number()) },
	returns: v.array(v.any()),
	handler: async (ctx, { token, limit }) => {
		const user = await requireUser(ctx, token);
		const rows = await ctx.db
			.query('auditLog')
			.withIndex('by_user', (q) => q.eq('userId', user._id))
			.collect();
		return rows.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit ?? 50).map((r) => ({ ...r, _id: String(r._id) }));
	}
});

export const activitySummary = query({
	args: { token: v.string() },
	returns: v.any(),
	handler: async (ctx, { token }) => {
		const user = await requireUser(ctx, token);
		const logs = await ctx.db
			.query('auditLog')
			.withIndex('by_user', (q) => q.eq('userId', user._id))
			.collect();
		const actions: Record<string, number> = {};
		for (const l of logs) actions[l.action] = (actions[l.action] ?? 0) + 1;
		return actions;
	}
});
