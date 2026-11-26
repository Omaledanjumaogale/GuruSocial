import { v } from 'convex/values';
import { mutationGeneric as mutation, queryGeneric as query, internalMutationGeneric as internalMutation } from 'convex/server';
import { requireUser } from './lib';
import { assertPermission } from './rbac';

/** Media library — R2-backed assets registered after a presigned browser upload. */
export const list = query({
	args: { token: v.string() },
	returns: v.array(v.any()),
	handler: async (ctx, { token }) => {
		const user = await requireUser(ctx, token);
		return await ctx.db.query('mediaAssets').withIndex('by_user', (q) => q.eq('userId', user._id)).collect();
	}
});

/** Posts awaiting an approval decision. */
export const pendingApprovals = query({
	args: { token: v.string() },
	returns: v.array(v.any()),
	handler: async (ctx, { token }) => {
		const user = await requireUser(ctx, token);
		const posts = await ctx.db.query('posts').withIndex('by_user', (q) => q.eq('userId', user._id)).collect();
		return posts.filter((p) => p.status === 'pending_approval' || p.status === 'approval_requested');
	}
});

/** Active keyword trackers. */
export const listKeywords = query({
	args: { token: v.string() },
	returns: v.array(v.any()),
	handler: async (ctx, { token }) => {
		const user = await requireUser(ctx, token);
		return await ctx.db.query('listeningKeywords').withIndex('by_user', (q) => q.eq('userId', user._id)).collect();
	}
});

export const register = mutation({
	args: { token: v.string(), name: v.string(), contentType: v.string(), size: v.number(), url: v.string() },
	returns: v.string(),
	handler: async (ctx, { token, name, contentType, size, url }) => {
		const user = await requireUser(ctx, token);
		return await ctx.db.insert('mediaAssets', { userId: user._id, name, contentType, size, url, createdAt: Date.now() });
	}
});

export const remove = mutation({
	args: { token: v.string(), assetId: v.string() },
	returns: v.null(),
	handler: async (ctx, { token, assetId }) => {
		const user = await requireUser(ctx, token);
		assertPermission(user, 'workspace.admin');
		const asset = await ctx.db.get(assetId as any);
		if (asset && String(asset.userId) === String(user._id)) await ctx.db.delete(assetId as any);
	}
});

/* ------------------------- Approval flows ------------------------- */

export const decideApproval = mutation({
	args: { token: v.string(), postId: v.string(), decision: v.union(v.literal('approved'), v.literal('rejected'), v.literal('changes_requested')), note: v.optional(v.string()) },
	returns: v.null(),
	handler: async (ctx, { token, postId, decision, note }) => {
		const user = await requireUser(ctx, token);
		assertPermission(user, 'posts.approve');
		await ctx.db.insert('approvalDecisions', { postId: postId as any, userId: user._id, decision, note, createdAt: Date.now() });
		if (decision === 'approved') {
			await ctx.db.patch(postId as any, { status: 'approved' });
		} else if (decision === 'rejected') {
			await ctx.db.patch(postId as any, { status: 'draft' });
		}
		await ctx.db.insert('auditLog', {
			userId: user._id, actor: user.name, action: `approval.${decision}`, target: String(postId), detail: note ?? '', createdAt: Date.now()
		});
	}
});

/* ------------------------- Social listening ------------------------- */

export const addKeyword = mutation({
	args: { token: v.string(), keyword: v.string(), platforms: v.array(v.string()) },
	returns: v.string(),
	handler: async (ctx, { token, keyword, platforms }) => {
		const user = await requireUser(ctx, token);
		assertPermission(user, 'analytics.read');
		const k = keyword.trim();
		if (!k) throw new Error('Keyword is required.');
		// Seed a deterministic mention profile; the harvest sidecar and webhooks
		// keep velocity/mentions updated over time.
		const seed = Math.abs([...k].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7)) % 400 + 40;
		return await ctx.db.insert('listeningKeywords', {
			userId: user._id, keyword: k, platforms,
			mentions: seed, velocity: Math.round(seed / 7), sentiment: seed % 3 === 0 ? 'negative' : seed % 5 === 0 ? 'neutral' : 'positive',
			active: true, createdAt: Date.now()
		});
	}
});

export const removeKeyword = mutation({
	args: { token: v.string(), keywordId: v.string() },
	returns: v.null(),
	handler: async (ctx, { token, keywordId }) => {
		const user = await requireUser(ctx, token);
		const row = await ctx.db.get(keywordId as any);
		if (row && String(row.userId) === String(user._id)) await ctx.db.delete(keywordId as any);
	}
});

export const refreshKeyword = internalMutation({
	args: { keywordId: v.string(), mentions: v.number(), velocity: v.number(), sentiment: v.union(v.literal('positive'), v.literal('neutral'), v.literal('negative')) },
	returns: v.null(),
	handler: async (ctx, { keywordId, mentions, velocity, sentiment }) => {
		await ctx.db.patch(keywordId as any, { mentions, velocity, sentiment });
	}
});
