import { v } from 'convex/values';
import { internalMutationGeneric as internalMutation, internalQueryGeneric as internalQuery } from 'convex/server';

export const byHash = internalQuery({
	args: { keyHash: v.string() },
	returns: v.any(),
	handler: async (ctx, { keyHash }) => {
		const row = await ctx.db
			.query('apiKeys')
			.withIndex('by_hash', (q) => q.eq('keyHash', keyHash))
			.unique();
		if (!row || row.revokedAt) return null;
		return { userId: String(row.userId), mode: row.mode, scopes: row.scopes, prefix: row.keyPrefix, _id: String(row._id) };
	}
});

export const touch = internalMutation({
	args: { id: v.string() },
	returns: v.null(),
	handler: async (ctx, { id }) => {
		await ctx.db.patch(id as any, { lastUsedAt: Date.now() });
	}
});

export const log = internalMutation({
	args: {
		userId: v.string(), method: v.string(), path: v.string(), status: v.number(), durationMs: v.number(),
		platforms: v.optional(v.array(v.string())), requestSummary: v.string()
	},
	returns: v.null(),
	handler: async (ctx, { userId, method, path, status, durationMs, platforms, requestSummary }) => {
		await ctx.db.insert('apiLogs', { userId: userId as any, method, path, status, durationMs, platforms, requestSummary, createdAt: Date.now() });
	}
});
