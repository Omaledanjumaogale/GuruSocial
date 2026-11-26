import { v } from 'convex/values';
import { mutationGeneric as mutation, queryGeneric as query } from 'convex/server';
import { anyApi } from 'convex/server';
import { sha256, randomToken, MutCtx, Doc } from './lib';

const api = anyApi;

const profile = v.object({
	email: v.string(),
	name: v.string(),
	plan: v.string(),
	role: v.string(),
	brandVoice: v.string()
});

async function createSession(ctx: MutCtx, userId: any, days = 30) {
	const token = randomToken(48);
	await ctx.db.insert('sessions', {
		userId,
		token,
		expiresAt: Date.now() + days * 864e5,
		createdAt: Date.now()
	});
	return token;
}

/**
 * Fire-and-forget identity sync to the E-WIN central hub.
 *
 * Sign-in must never fail because the hub is unreachable, so the sync is
 * scheduled after the transaction commits and the action itself degrades to a
 * no-op when EWIN_HUB_URL is not configured.
 */
async function scheduleHubSync(ctx: MutCtx, userId: any, event: 'signup' | 'signin') {
	try {
		await ctx.scheduler.runAfter(0, api.ewinAuthActions.syncIdentity, {
			userId: String(userId),
			event
		});
	} catch {
		/* scheduling is best-effort only */
	}
}

export const signUp = mutation({
	args: { email: v.string(), name: v.string(), password: v.string() },
	returns: v.object({ token: v.string(), userId: v.string(), user: profile }),
	handler: async (ctx, { email, name, password }) => {
		const emailNorm = email.trim().toLowerCase();
		if (!emailNorm.includes('@')) throw new Error('Enter a valid email address.');
		if (password.length < 8) throw new Error('Password must be at least 8 characters.');
		const existing = await ctx.db
			.query('users')
			.withIndex('by_email', (q) => q.eq('email', emailNorm))
			.unique();
		if (existing) throw new Error('An account with this email already exists. Try signing in.');
		const displayName = name.trim() || emailNorm.split('@')[0];
		const userId = await ctx.db.insert('users', {
			email: emailNorm,
			name: displayName,
			passwordHash: sha256(emailNorm + ':' + password),
			role: 'owner',
			plan: 'free',
			createdAt: Date.now(),
			brandVoice: ''
		});
		// Give the workspace its starter brand kit so day one is productive.
		await ctx.db.insert('brandKits', {
			userId,
			name: 'Default brand',
			tone: 'confident, plain-spoken, helpful',
			keyMessages: [],
			hashtags: [],
			colors: ['#6366f1', '#22c55e', '#f59e0b']
		});
		await ctx.db.insert('activityEvents', {
			userId,
			actor: emailNorm,
			eventType: 'auth.signup',
			targetType: 'user',
			targetId: String(userId),
			outcome: 'succeeded',
			createdAt: Date.now()
		});
		const token = await createSession(ctx, userId);
		await scheduleHubSync(ctx, userId, 'signup');
		return {
			token,
			userId: String(userId),
			user: { email: emailNorm, name: displayName, plan: 'free', role: 'owner', brandVoice: '' }
		};
	}
});

export const signIn = mutation({
	args: { email: v.string(), password: v.string() },
	returns: v.object({ token: v.string(), userId: v.string(), user: profile }),
	handler: async (ctx, { email, password }) => {
		const emailNorm = email.trim().toLowerCase();
		const user = await ctx.db
			.query('users')
			.withIndex('by_email', (q) => q.eq('email', emailNorm))
			.unique();
		if (!user) throw new Error('Incorrect email or password.');
		// Hub-asserted and OAuth accounts have no local password.
		if (user.passwordHash.startsWith('oauth:') || user.passwordHash.startsWith('hub:')) {
			throw new Error(
				'This account signs in with Google, GitHub or the E-WIN hub. Use one of those buttons instead.'
			);
		}
		if (user.passwordHash !== sha256(emailNorm + ':' + password)) {
			throw new Error('Incorrect email or password.');
		}
		const token = await createSession(ctx, user._id);
		await ctx.db.insert('activityEvents', {
			userId: user._id,
			actor: emailNorm,
			eventType: 'auth.signin',
			targetType: 'user',
			targetId: String(user._id),
			outcome: 'succeeded',
			createdAt: Date.now()
		});
		await scheduleHubSync(ctx, user._id, 'signin');
		return {
			token,
			userId: String(user._id),
			user: {
				email: user.email,
				name: user.name,
				plan: user.plan,
				role: user.role,
				brandVoice: user.brandVoice ?? ''
			}
		};
	}
});

export const signOut = mutation({
	args: { token: v.string() },
	returns: v.null(),
	handler: async (ctx, { token }) => {
		const session = await ctx.db
			.query('sessions')
			.withIndex('by_token', (q) => q.eq('token', token))
			.unique();
		if (session) await ctx.db.delete(session._id);
	}
});

/** A query (not a mutation): session validation is read-only and idempotent. */
export const me = query({
	args: { token: v.string() },
	returns: profile,
	handler: async (ctx, { token }) => {
		const session = await ctx.db
			.query('sessions')
			.withIndex('by_token', (q) => q.eq('token', token))
			.unique();
		if (!session) throw new Error('Unauthorized');
		if (session.expiresAt < Date.now()) throw new Error('Your session has expired. Please sign in again.');
		const u = await ctx.db.get(session.userId);
		if (!u) throw new Error('Unauthorized');
		return {
			email: u.email,
			name: u.name,
			plan: u.plan,
			role: u.role,
			brandVoice: u.brandVoice ?? ''
		};
	}
});

export const updateProfile = mutation({
	args: {
		token: v.string(),
		name: v.optional(v.string()),
		brandVoice: v.optional(v.string()),
		bestTimeSuggestions: v.optional(v.boolean()),
		weeklyReportEmail: v.optional(v.boolean()),
		llmProvider: v.optional(v.string()),
		llmApiKey: v.optional(v.string())
	},
	returns: v.null(),
	handler: async (
		ctx,
		{ token, name, brandVoice, bestTimeSuggestions, weeklyReportEmail, llmProvider, llmApiKey }
	) => {
		const session = await ctx.db
			.query('sessions')
			.withIndex('by_token', (q) => q.eq('token', token))
			.unique();
		if (!session) throw new Error('Unauthorized');
		const patch: Record<string, unknown> = {};
		if (name !== undefined) patch.name = name.trim().slice(0, 120);
		if (brandVoice !== undefined) patch.brandVoice = brandVoice.slice(0, 500);
		if (
			bestTimeSuggestions !== undefined ||
			weeklyReportEmail !== undefined ||
			llmProvider !== undefined ||
			llmApiKey !== undefined
		) {
			const u = await ctx.db.get(session.userId);
			patch.settings = {
				...(u?.settings ?? {}),
				bestTimeSuggestions,
				weeklyReportEmail,
				llmProvider,
				llmApiKey
			};
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
		if (u.passwordHash.startsWith('oauth:') || u.passwordHash.startsWith('hub:')) {
			throw new Error(
				'This account has no local password. Sign in with Google, GitHub or the E-WIN hub instead.'
			);
		}
		if (u.passwordHash !== sha256(u.email + ':' + current)) throw new Error('Current password is incorrect.');
		if (next.length < 8) throw new Error('New password must be at least 8 characters.');
		await ctx.db.patch(u._id, { passwordHash: sha256(u.email + ':' + next) });
	}
});
