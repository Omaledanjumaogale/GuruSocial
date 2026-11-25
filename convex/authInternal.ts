import { v } from 'convex/values';
import { internalQueryGeneric as internalQuery } from 'convex/server';

/** Internal lookups used by public actions (AI generation, HTTP API). */
export const byToken = internalQuery({
	args: { token: v.string() },
	returns: v.any(),
	handler: async (ctx, { token }) => {
		const session = await ctx.db
			.query('sessions')
			.withIndex('by_token', (q) => q.eq('token', token))
			.unique();
		if (!session || session.expiresAt < Date.now()) return null;
		return { userId: session.userId, email: '' };
	}
});

export const userById = internalQuery({
	args: { userId: v.string() },
	returns: v.any(),
	handler: async (ctx, { userId }) => await ctx.db.get(userId as any)
});
