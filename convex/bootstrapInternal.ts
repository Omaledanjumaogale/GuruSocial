import { v } from 'convex/values';
import { internalMutationGeneric as internalMutation } from 'convex/server';
import { sha256 } from './lib';

/**
 * Idempotent bootstrap of the ecosystem super-admin workspace.
 *
 * The operator console authenticates against env credentials, but the person
 * behind it also needs a normal workspace login (posts, inbox, messaging). This
 * creates that user once, with an owner role and an enterprise plan, and never
 * overwrites an existing password.
 */
export const ensureSuperAdminUser = internalMutation({
	args: { email: v.string(), password: v.string(), name: v.string() },
	returns: v.object({ created: v.boolean(), userId: v.string() }),
	handler: async (ctx, { email, password, name }) => {
		const emailNorm = email.trim().toLowerCase();
		const existing = await ctx.db
			.query('users')
			.withIndex('by_email', (q) => q.eq('email', emailNorm))
			.unique();
		if (existing) {
			// Keep the role authoritative but never reset a password silently.
			if (existing.role !== 'owner' || existing.plan !== 'enterprise') {
				await ctx.db.patch(existing._id, { role: 'owner', plan: 'enterprise' });
			}
			return { created: false, userId: String(existing._id) };
		}
		const userId = await ctx.db.insert('users', {
			email: emailNorm,
			name: name.trim() || 'E-WIN Super Admin',
			passwordHash: sha256(emailNorm + ':' + password),
			role: 'owner',
			plan: 'enterprise',
			createdAt: Date.now(),
			brandVoice: 'confident, plain-spoken, helpful'
		});
		await ctx.db.insert('brandKits', {
			userId,
			name: 'E-WIN brand',
			tone: 'confident, plain-spoken, helpful',
			keyMessages: ['One API, one inbox, one CRM', 'Own your social stack'],
			hashtags: ['gurusocial', 'ewin'],
			colors: ['#6366f1', '#22c55e', '#f59e0b']
		});
		await ctx.db.insert('notificationPreferences', {
			userId,
			inApp: true,
			email: true,
			product: true,
			security: true
		});
		await ctx.db.insert('activityEvents', {
			userId,
			actor: 'bootstrap',
			eventType: 'account.super_admin_created',
			targetType: 'user',
			targetId: String(userId),
			outcome: 'success',
			createdAt: Date.now()
		});
		return { created: true, userId: String(userId) };
	}
});
