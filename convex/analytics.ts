import { v } from 'convex/values';
import { mutationGeneric as mutation, queryGeneric as query } from 'convex/server';
import { requireUser } from './lib';

export const overview = query({
	args: { token: v.string(), days: v.optional(v.number()) },
	returns: v.any(),
	handler: async (ctx, { token, days }) => {
		const user = await requireUser(ctx, token);
		const since = Date.now() - (days ?? 30) * 864e5;
		const analytics = await ctx.db
			.query('analytics')
			.withIndex('by_user', (q) => q.eq('userId', user._id))
			.collect();
		const recent = analytics.filter((a) => a.capturedAt >= since);
		const totals = recent.reduce(
			(acc, a) => ({
				impressions: acc.impressions + a.impressions,
				reach: acc.reach + a.reach,
				likes: acc.likes + a.likes,
				comments: acc.comments + a.comments,
				shares: acc.shares + a.shares,
				saves: acc.saves + a.saves,
				clicks: acc.clicks + a.clicks,
				followersDelta: acc.followersDelta + a.followersDelta
			}),
			{ impressions: 0, reach: 0, likes: 0, comments: 0, shares: 0, saves: 0, clicks: 0, followersDelta: 0 }
		);
		const byPlatform: Record<string, any> = {};
		for (const a of recent) {
			const row = (byPlatform[a.platform] ??= { platform: a.platform, impressions: 0, reach: 0, engagement: 0, posts: 0 });
			row.impressions += a.impressions; row.reach += a.reach;
			row.engagement += a.likes + a.comments + a.shares + a.saves;
			row.posts += 1;
		}
		const byDay: Record<string, { day: string; impressions: number; engagement: number }> = {};
		for (let i = (days ?? 30) - 1; i >= 0; i--) {
			const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
			byDay[d] = { day: d, impressions: 0, engagement: 0 };
		}
		for (const a of recent) {
			const key = new Date(a.capturedAt).toISOString().slice(0, 10);
			if (byDay[key]) { byDay[key].impressions += a.impressions; byDay[key].engagement += a.likes + a.comments + a.shares; }
		}
		const audience = await ctx.db
			.query('audienceSnapshot')
			.withIndex('by_user', (q) => q.eq('userId', user._id))
			.collect();
		const followers = audience
			.filter((a) => a.capturedAt >= since)
			.reduce((acc, a) => ((acc[a.platform] ??= { followers: 0 }), (acc[a.platform].followers += a.followers), acc), {} as Record<string, { followers: number }>);
		const topPosts = recent
			.reduce((acc, a) => { acc.set(String(a.postId), (acc.get(String(a.postId)) ?? 0) + a.impressions); return acc; }, new Map<string, number>());
		return { totals, byPlatform: Object.values(byPlatform), byDay: Object.values(byDay), followers, topPostIds: [...topPosts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id]) => id) };
	}
});

export const perPost = query({
	args: { token: v.string(), postId: v.string() },
	returns: v.array(v.any()),
	handler: async (ctx, { token, postId }) => {
		const user = await requireUser(ctx, token);
		return await ctx.db
			.query('analytics')
			.withIndex('by_user', (q) => q.eq('userId', user._id))
			.filter((q) => q.eq(q.field('postId'), postId as any))
			.collect();
	}
});

export const topPosts = query({
	args: { token: v.string(), metric: v.optional(v.union(v.literal('impressions'), v.literal('reach'), v.literal('likes'), v.literal('comments'), v.literal('shares'))), limit: v.optional(v.number()) },
	returns: v.array(v.any()),
	handler: async (ctx, { token, metric, limit }) => {
		const user = await requireUser(ctx, token);
		const analytics = await ctx.db
			.query('analytics')
			.withIndex('by_user', (q) => q.eq('userId', user._id))
			.collect();
		const m = metric ?? 'impressions';
		const totals: Record<string, number> = {};
		for (const a of analytics) {
			totals[String(a.postId)] = (totals[String(a.postId)] ?? 0) + (m === 'impressions' ? a.impressions : m === 'reach' ? a.reach : m === 'likes' ? a.likes : m === 'comments' ? a.comments : a.shares);
		}
		const postIds = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, limit ?? 8).map(([id]) => id as any);
		const posts = await Promise.all(postIds.map((id) => ctx.db.get(id)));
		return posts.filter(Boolean).map((p: any) => ({ _id: String(p._id), content: p.content, platforms: p.platforms, status: p.status, publishedAt: p.publishedAt, metricValue: totals[String(p._id)] ?? 0 }));
	}
});

export const audience = query({
	args: { token: v.string() },
	returns: v.array(v.any()),
	handler: async (ctx, { token }) => {
		const user = await requireUser(ctx, token);
		const rows = await ctx.db
			.query('audienceSnapshot')
			.withIndex('by_user', (q) => q.eq('userId', user._id))
			.collect();
		return rows.map((r) => ({ ...r, _id: String(r._id) }));
	}
});

export const competitors = query({
	args: { token: v.string() },
	returns: v.array(v.any()),
	handler: async (ctx, { token }) => {
		const user = await requireUser(ctx, token);
		return await ctx.db
			.query('competitors')
			.withIndex('by_user', (q) => q.eq('userId', user._id))
			.collect();
	}
});

export const addCompetitor = mutation({
	args: { token: v.string(), name: v.string(), platform: v.string(), handle: v.string(), followers: v.number(), postsPerWeek: v.number(), engagementRate: v.number() },
	returns: v.null(),
	handler: async (ctx, { token, name, platform, handle, followers, postsPerWeek, engagementRate }) => {
		const user = await requireUser(ctx, token);
		await ctx.db.insert('competitors', { userId: user._id, name, platform, handle, followers, postsPerWeek, engagementRate, createdAt: Date.now() });
	}
});

export const removeCompetitor = mutation({
	args: { token: v.string(), id: v.string() },
	returns: v.null(),
	handler: async (ctx, { token, id }) => {
		await requireUser(ctx, token);
		await ctx.db.delete(id as any);
	}
});
