import { v } from 'convex/values';
import { internalMutationGeneric as internalMutation, internalQueryGeneric as internalQuery } from 'convex/server';

/** Internal functions backing the public REST API and MCP server. */
export const createForApiKey = internalMutation({
	args: {
		userId: v.string(), content: v.string(), platforms: v.array(v.string()),
		scheduledAt: v.optional(v.number()), mediaUrls: v.optional(v.array(v.string())),
		firstComment: v.optional(v.string()), draft: v.optional(v.boolean())
	},
	returns: v.object({ postId: v.string() }),
	handler: async (ctx, { userId, content, platforms, scheduledAt, mediaUrls, firstComment, draft }) => {
		if (!platforms.length) throw new Error('platforms must contain at least one platform slug.');
		const now = Date.now();
		const status = draft ? 'draft' : scheduledAt ? 'scheduled' : 'published';
		const postId = await ctx.db.insert('posts', {
			userId: userId as any, content, platforms, status: status as any,
			scheduledAt, publishedAt: status === 'published' ? now : undefined,
			mediaUrls: mediaUrls ?? [], hashtags: [], tags: [], generatedBy: 'api',
			perPlatformResults: status === 'published' ? platforms.map((p) => ({ platform: p, status: 'published', message: 'Delivered natively', attempts: 1 })) : undefined,
			firstComment, createdAt: now, updatedAt: now
		});
		if (status === 'published') {
			for (const platform of platforms) {
				await ctx.db.insert('analytics', {
					userId: userId as any, postId, platform, capturedAt: now,
					impressions: 0, reach: 0, likes: 0, comments: 0, shares: 0, saves: 0, clicks: 0, followersDelta: 0
				});
			}
		}
		return { postId: String(postId) };
	}
});

export const listForApiKey = internalQuery({
	args: { userId: v.string(), status: v.optional(v.string()), limit: v.number() },
	returns: v.array(v.any()),
	handler: async (ctx, { userId, status, limit }) => {
		let rows = await ctx.db
			.query('posts')
			.withIndex('by_user', (q) => q.eq('userId', userId as any))
			.collect();
		if (status) rows = rows.filter((p) => p.status === status);
		return rows.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit).map((p) => ({
			id: String(p._id), content: p.content, platforms: p.platforms, status: p.status,
			scheduledAt: p.scheduledAt ?? null, publishedAt: p.publishedAt ?? null, createdAt: p.createdAt
		}));
	}
});

export const profilesForApiKey = internalQuery({
	args: { userId: v.string() },
	returns: v.array(v.any()),
	handler: async (ctx, { userId }) => {
		const rows = await ctx.db
			.query('profiles')
			.withIndex('by_user', (q) => q.eq('userId', userId as any))
			.collect();
		return rows.map((p) => ({ id: String(p._id), platform: p.platform, handle: p.handle, displayName: p.displayName, status: p.status }));
	}
});

export const topAnalyticsForApiKey = internalQuery({
	args: { userId: v.string(), metric: v.string(), limit: v.number() },
	returns: v.array(v.any()),
	handler: async (ctx, { userId, metric, limit }) => {
		const rows = await ctx.db
			.query('analytics')
			.withIndex('by_user', (q) => q.eq('userId', userId as any))
			.collect();
		const totals: Record<string, number> = {};
		for (const a of rows) {
			totals[String(a.postId)] = (totals[String(a.postId)] ?? 0) + ((a as any)[metric] ?? a.impressions);
		}
		const ids = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, limit);
		return ids.map(([id, value]) => ({ postId: id, metric: metric, value }));
	}
});

export const analyticsForPostApiKey = internalQuery({
	args: { userId: v.string(), postId: v.string() },
	returns: v.array(v.any()),
	handler: async (ctx, { userId, postId }) => {
		return await ctx.db
			.query('analytics')
			.withIndex('by_user', (q) => q.eq('userId', userId as any))
			.filter((q) => q.eq(q.field('postId'), postId as any))
			.collect();
	}
});

export const replyForApiKey = internalMutation({
	args: { userId: v.string(), inboxItemId: v.string(), message: v.string() },
	returns: v.null(),
	handler: async (ctx, { userId, inboxItemId, message }) => {
		const item = await ctx.db.get(inboxItemId as any);
		if (!item || String(item.userId) !== userId) throw new Error('Inbox item not found.');
		await ctx.db.patch(item._id, { status: 'replied', repliedMessage: message, repliedAt: Date.now() });
	}
});
