import { v } from 'convex/values';
import { queryGeneric as query, mutationGeneric as mutation } from 'convex/server';
import { requireAdmin, recordActivity } from './rbac';

/**
 * Super-admin operations: user/role administration and the activity register.
 * Every mutation verifies the operator session and records an audit event.
 */

export const listUsers = query({
	args: { adminToken: v.string() },
	returns: v.array(v.any()),
	handler: async (ctx, { adminToken }) => {
		await requireAdmin(ctx, adminToken);
		const users = await ctx.db.query('users').take(500);
		return users
			.sort((a, b) => b.createdAt - a.createdAt)
			.map((u) => ({
				_id: String(u._id),
				email: u.email,
				name: u.name,
				role: u.role,
				plan: u.plan,
				createdAt: u.createdAt
			}));
	}
});

export const setUserRole = mutation({
	args: {
		adminToken: v.string(),
		userId: v.id('users'),
		role: v.union(v.literal('owner'), v.literal('admin'), v.literal('approver'), v.literal('member'))
	},
	returns: v.null(),
	handler: async (ctx, { adminToken, userId, role }) => {
		const session = await requireAdmin(ctx, adminToken);
		const user = await ctx.db.get(userId);
		if (!user) throw new Error('User not found.');
		await ctx.db.patch(userId, { role });
		await recordActivity(ctx, {
			userId,
			actor: session.email,
			eventType: 'admin.user.role_changed',
			targetType: 'user',
			targetId: userId,
			metadata: { from: user.role, to: role }
		});
	}
});

export const activity = query({
	args: { adminToken: v.string(), limit: v.optional(v.number()) },
	returns: v.array(v.any()),
	handler: async (ctx, { adminToken, limit }) => {
		await requireAdmin(ctx, adminToken);
		const rows = await ctx.db
			.query('activityEvents')
			.withIndex('by_created')
			.order('desc')
			.take(Math.min(limit ?? 50, 200));
		return rows.map((e) => ({
			_id: String(e._id),
			actor: e.actor,
			eventType: e.eventType,
			targetType: e.targetType,
			targetId: e.targetId,
			outcome: e.outcome,
			metadata: e.metadata ?? null,
			createdAt: e.createdAt
		}));
	}
});

/** Platform counters for the console overview (bounded, no full-table scans). */
export const overview = query({
	args: { adminToken: v.string() },
	returns: v.any(),
	handler: async (ctx, { adminToken }) => {
		await requireAdmin(ctx, adminToken);
		const [users, posts, profiles, conversations, notifications, harvestJobs, keys] = await Promise.all([
			ctx.db.query('users').take(1000),
			ctx.db.query('posts').take(1000),
			ctx.db.query('profiles').take(1000),
			ctx.db.query('conversations').take(500),
			ctx.db.query('notifications').take(1000),
			ctx.db.query('harvestJobs').take(500),
			ctx.db.query('apiKeys').take(500)
		]);
		const dayAgo = Date.now() - 864e5;
		return {
			counts: {
				users: users.length,
				newUsers24h: users.filter((u) => u.createdAt > dayAgo).length,
				posts: posts.length,
				published: posts.filter((p) => p.status === 'published').length,
				scheduled: posts.filter((p) => p.status === 'scheduled').length,
				pendingApproval: posts.filter((p) => p.status === 'pending_approval').length,
				profiles: profiles.length,
				conversations: conversations.length,
				unreadNotifications: notifications.filter((n) => !n.readAt).length,
				harvestJobs: harvestJobs.length,
				apiKeys: keys.filter((k) => !k.revokedAt).length
			},
			roleBreakdown: ['owner', 'admin', 'approver', 'member'].map((role) => ({
				role,
				count: users.filter((u) => u.role === role).length
			})),
			planBreakdown: ['free', 'starter', 'pro', 'agency', 'enterprise'].map((plan) => ({
				plan,
				count: users.filter((u) => u.plan === plan).length
			})),
			generatedAt: Date.now()
		};
	}
});
