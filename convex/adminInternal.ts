import { v } from 'convex/values';
import { internalMutationGeneric as internalMutation, internalQueryGeneric as internalQuery } from 'convex/server';

/** Admin sessions and global stats for the super-admin console. */
export const byToken = internalQuery({
	args: { token: v.string() },
	returns: v.any(),
	handler: async (ctx, { token }) => {
		const row = await ctx.db
			.query('adminSessions')
			.withIndex('by_token', (q) => q.eq('token', token))
			.unique();
		if (!row || row.expiresAt < Date.now()) return null;
		return row;
	}
});

export const createSession = internalMutation({
	args: { email: v.string(), token: v.string() },
	returns: v.null(),
	handler: async (ctx, { email, token }) => {
		await ctx.db.insert('adminSessions', { email, token, createdAt: Date.now(), expiresAt: Date.now() + 12 * 3600e3 });
	}
});

export const globalStats = internalQuery({
	args: {},
	returns: v.any(),
	handler: async (ctx) => {
		const [users, posts, profiles, apiKeys, harvestJobs, audit] = await Promise.all([
			ctx.db.query('users').collect(),
			ctx.db.query('posts').collect(),
			ctx.db.query('profiles').collect(),
			ctx.db.query('apiKeys').collect(),
			ctx.db.query('harvestJobs').collect(),
			ctx.db.query('auditLog').collect()
		]);
		const inbox = await ctx.db.query('inboxItems').collect();
		const published = posts.filter((p) => p.status === 'published').length;
		const scheduled = posts.filter((p) => p.status === 'scheduled').length;
		const recentAudit = [...audit].sort((a, b) => b.createdAt - a.createdAt).slice(0, 25);
		const recentUsers = [...users].sort((a, b) => b.createdAt - a.createdAt).slice(0, 25);
		return {
			counts: {
				users: users.length,
				posts: posts.length,
				published,
				scheduled,
				profiles: profiles.length,
				apiKeys: apiKeys.filter((k) => !k.revokedAt).length,
				harvestJobs: harvestJobs.length,
				inboxItems: inbox.length
			},
			users: recentUsers.map((u) => ({ _id: String(u._id), email: u.email, name: u.name, plan: u.plan, role: u.role, createdAt: u.createdAt })),
			audit: recentAudit.map((a) => ({ ...a, _id: String(a._id) })),
			generatedAt: Date.now()
		};
	}
});

export const endSession = internalMutation({
	args: { token: v.string() },
	returns: v.null(),
	handler: async (ctx, { token }) => {
		const row = await ctx.db
			.query('adminSessions')
			.withIndex('by_token', (q) => q.eq('token', token))
			.unique();
		if (row) await ctx.db.delete(row._id);
	}
});
