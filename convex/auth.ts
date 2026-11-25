import { v } from 'convex/values';
import { mutationGeneric as mutation, actionGeneric as action } from 'convex/server';
import { sha256, randomToken, MutCtx, Ctx, Doc } from './lib';

async function createSession(ctx: MutCtx, userId: any) {
	const token = randomToken(48);
	await ctx.db.insert('sessions', { userId, token, expiresAt: Date.now() + 30 * 864e5, createdAt: Date.now() });
	return token;
}

export const signUp = mutation({
	args: { email: v.string(), name: v.string(), password: v.string() },
	returns: v.object({ token: v.string(), userId: v.string() }),
	handler: async (ctx, { email, name, password }) => {
		const emailNorm = email.trim().toLowerCase();
		if (!emailNorm.includes('@')) throw new Error('Enter a valid email address.');
		if (password.length < 8) throw new Error('Password must be at least 8 characters.');
		const existing = await ctx.db
			.query('users')
			.withIndex('by_email', (q) => q.eq('email', emailNorm))
			.unique();
		if (existing) throw new Error('An account with this email already exists. Try signing in.');
		const userId = await ctx.db.insert('users', {
			email: emailNorm,
			name: name.trim() || emailNorm.split('@')[0],
			passwordHash: sha256(emailNorm + ':' + password),
			role: 'owner',
			plan: 'free',
			createdAt: Date.now(),
			brandVoice: ''
		});
		// Give the workspace its starter queue slots + brand kit so day one is productive.
		await ctx.db.insert('brandKits', {
			userId,
			name: 'Default brand',
			tone: 'confident, plain-spoken, helpful',
			keyMessages: [],
			hashtags: [],
			colors: ['#6366f1', '#22c55e', '#f59e0b']
		});
		const token = await createSession(ctx, userId);
		return { token, userId: String(userId) };
	}
});

export const signIn = mutation({
	args: { email: v.string(), password: v.string() },
	returns: v.object({ token: v.string(), userId: v.string() }),
	handler: async (ctx, { email, password }) => {
		const emailNorm = email.trim().toLowerCase();
		const user = await ctx.db
			.query('users')
			.withIndex('by_email', (q) => q.eq('email', emailNorm))
			.unique();
		if (!user || user.passwordHash !== sha256(emailNorm + ':' + password)) {
			throw new Error('Incorrect email or password.');
		}
		const token = await createSession(ctx, user._id);
		return { token, userId: String(user._id) };
	}
});

export const signOut = mutation({
	args: { token: v.string() },
	handler: async (ctx, { token }) => {
		const session = await ctx.db
			.query('sessions')
			.withIndex('by_token', (q) => q.eq('token', token))
			.unique();
		if (session) await ctx.db.delete(session._id);
	}
});

export const me = mutation({
	args: { token: v.string() },
	returns: v.object({ email: v.string(), name: v.string(), plan: v.string(), role: v.string(), brandVoice: v.string() }),
	handler: async (ctx, { token }) => {
		const user = await ctx.db
			.query('sessions')
			.withIndex('by_token', (q) => q.eq('token', token))
			.unique();
		if (!user) throw new Error('Unauthorized');
		const u = await ctx.db.get(user.userId);
		return { email: u!.email, name: u!.name, plan: u!.plan, role: u!.role, brandVoice: u!.brandVoice ?? '' };
	}
});

export const updateProfile = mutation({
	args: {
		token: v.string(),
		name: v.optional(v.string()),
		brandVoice: v.optional(v.string()),
		bestTimeSuggestions: v.optional(v.boolean()),
		weeklyReportEmail: v.optional(v.boolean())
	},
	returns: v.null(),
	handler: async (ctx, { token, name, brandVoice, bestTimeSuggestions, weeklyReportEmail }) => {
		const session = await ctx.db
			.query('sessions')
			.withIndex('by_token', (q) => q.eq('token', token))
			.unique();
		if (!session) throw new Error('Unauthorized');
		const patch: any = {};
		if (name !== undefined) patch.name = name;
		if (brandVoice !== undefined) patch.brandVoice = brandVoice;
		if (bestTimeSuggestions !== undefined || weeklyReportEmail !== undefined) {
			const u = await ctx.db.get(session.userId);
			patch.settings = { ...(u?.settings ?? {}), bestTimeSuggestions, weeklyReportEmail };
		}
		await ctx.db.patch(session.userId, patch);
	}
});

export const changePassword = mutation({
	args: { token: v.string(), current: v.string(), next: v.string() },
	returns: v.null(),
	handler: async (ctx, { token, current, next }) => {
		const session = await ctx.db
			.query('sessions')
			.withIndex('by_token', (q) => q.eq('token', token))
			.unique();
		if (!session) throw new Error('Unauthorized');
		const u = (await ctx.db.get(session.userId)) as Doc<'users'>;
		if (u.passwordHash !== sha256(u.email + ':' + current)) throw new Error('Current password is incorrect.');
		if (next.length < 8) throw new Error('New password must be at least 8 characters.');
		await ctx.db.patch(u._id, { passwordHash: sha256(u.email + ':' + next) });
	}
});
