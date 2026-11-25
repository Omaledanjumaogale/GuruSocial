import { v } from 'convex/values';
import { internalQueryGeneric as internalQuery } from 'convex/server';

export const kitsForUser = internalQuery({
	args: { userId: v.string() },
	returns: v.array(v.any()),
	handler: async (ctx, { userId }) => {
		return await ctx.db
			.query('brandKits')
			.withIndex('by_user', (q) => q.eq('userId', userId as any))
			.collect();
	}
});
