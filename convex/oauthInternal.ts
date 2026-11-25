import { v } from 'convex/values';
import { internalMutationGeneric as internalMutation, internalQueryGeneric as internalQuery } from 'convex/server';

/** OAuth user provisioning shared by the Google/GitHub callback http actions. */
export const upsertOAuthUser = internalMutation({
	args: {
		provider: v.string(),
		providerAccountId: v.string(),
		email: v.string(),
		name: v.string()
	},
	returns: v.object({ token: v.string(), isNew: v.boolean() }),
	handler: async (ctx, { provider, providerAccountId, email, name }) => {
		const emailNorm = email.trim().toLowerCase();
		let user: any = await ctx.db
			.query('users')
			.withIndex('by_email', (q) => q.eq('email', emailNorm))
			.unique();
		let isNew = false;
		if (!user) {
			isNew = true;
			const userId = await ctx.db.insert('users', {
				email: emailNorm,
				name: name || emailNorm.split('@')[0],
				// OAuth accounts authenticate via the provider; password field is a random never-matching sentinel.
				passwordHash: `oauth:${provider}:${providerAccountId}`,
				role: 'owner',
				plan: 'free',
				createdAt: Date.now(),
				brandVoice: ''
			});
			await ctx.db.insert('brandKits', {
				userId, name: 'Default brand', tone: 'confident, plain-spoken, helpful',
				keyMessages: [], hashtags: [], colors: ['#6366f1', '#22c55e', '#f59e0b']
			});
			user = await ctx.db.get(userId);
		}
		const linked = await ctx.db
			.query('oauthAccounts')
			.withIndex('by_provider_account', (q) => q.eq('provider', provider))
			.filter((q) => q.eq(q.field('providerAccountId'), providerAccountId))
			.unique();
		if (!linked) {
			await ctx.db.insert('oauthAccounts', {
				provider, providerAccountId, email: emailNorm, userId: user._id, linkedAt: Date.now()
			});
		}
		const token = `sess_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`.replace(/[^a-zA-Z0-9_]/g, 'x').padEnd(40, 'x');
		await ctx.db.insert('sessions', {
			userId: user._id, token, expiresAt: Date.now() + 30 * 864e5, createdAt: Date.now()
		});
		return { token, isNew };
	}
});

export const byEmail = internalQuery({
	args: { email: v.string() },
	returns: v.any(),
	handler: async (ctx, { email }) => {
		return await ctx.db
			.query('users')
			.withIndex('by_email', (q) => q.eq('email', email.trim().toLowerCase()))
			.unique();
	}
});
