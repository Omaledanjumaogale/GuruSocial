import { v } from 'convex/values';
import { queryGeneric as query, mutationGeneric as mutation, internalMutationGeneric as internalMutation } from 'convex/server';
import { requireUser } from './lib';
import { requireAdmin, recordActivity } from './rbac';

/**
 * In-app notifications with explicit, user-controlled preferences.
 *
 * In-app rows are always written for account/security events; email delivery is
 * opt-in (Resend is only called when the preference and provider are present).
 */

const DEFAULT_PREFS = { inApp: true, email: false, product: true, security: true };

async function prefsFor(ctx: any, userId: any) {
	const row = await ctx.db
		.query('notificationPreferences')
		.withIndex('by_user', (q: any) => q.eq('userId', userId))
		.unique();
	return row ?? { ...DEFAULT_PREFS, userId };
}

export const list = query({
	args: { token: v.string(), limit: v.optional(v.number()) },
	returns: v.array(v.any()),
	handler: async (ctx, { token, limit }) => {
		const user = await requireUser(ctx, token);
		const rows = await ctx.db
			.query('notifications')
			.withIndex('by_user_created', (q) => q.eq('userId', user._id))
			.order('desc')
			.take(Math.min(limit ?? 30, 100));
		return rows.map((n) => ({
			_id: String(n._id),
			kind: n.kind,
			title: n.title,
			body: n.body,
			href: n.href ?? null,
			readAt: n.readAt ?? null,
			createdAt: n.createdAt
		}));
	}
});

export const unreadCount = query({
	args: { token: v.string() },
	returns: v.number(),
	handler: async (ctx, { token }) => {
		const user = await requireUser(ctx, token);
		const rows = await ctx.db
			.query('notifications')
			.withIndex('by_user', (q) => q.eq('userId', user._id))
			.take(200);
		return rows.filter((n) => !n.readAt).length;
	}
});

export const markRead = mutation({
	args: { token: v.string(), id: v.id('notifications') },
	returns: v.null(),
	handler: async (ctx, { token, id }) => {
		const user = await requireUser(ctx, token);
		const row = await ctx.db.get(id);
		if (!row) return;
		// Object-level ownership: you can only mark your own notifications.
		if (String(row.userId) !== String(user._id)) throw new Error('Not found.');
		await ctx.db.patch(id, { readAt: Date.now() });
	}
});

export const markAllRead = mutation({
	args: { token: v.string() },
	returns: v.null(),
	handler: async (ctx, { token }) => {
		const user = await requireUser(ctx, token);
		const rows = await ctx.db
			.query('notifications')
			.withIndex('by_user', (q) => q.eq('userId', user._id))
			.take(200);
		for (const row of rows) if (!row.readAt) await ctx.db.patch(row._id, { readAt: Date.now() });
	}
});

export const preferences = query({
	args: { token: v.string() },
	returns: v.object({ inApp: v.boolean(), email: v.boolean(), product: v.boolean(), security: v.boolean() }),
	handler: async (ctx, { token }) => {
		const user = await requireUser(ctx, token);
		const prefs = await prefsFor(ctx, user._id);
		return { inApp: prefs.inApp, email: prefs.email, product: prefs.product, security: prefs.security };
	}
});

export const savePreferences = mutation({
	args: {
		token: v.string(),
		inApp: v.boolean(),
		email: v.boolean(),
		product: v.boolean(),
		security: v.boolean()
	},
	returns: v.null(),
	handler: async (ctx, { token, inApp, email, product, security }) => {
		const user = await requireUser(ctx, token);
		const existing = await ctx.db
			.query('notificationPreferences')
			.withIndex('by_user', (q) => q.eq('userId', user._id))
			.unique();
		const patch = { inApp, email, product, security };
		if (existing) await ctx.db.patch(existing._id, patch);
		else await ctx.db.insert('notificationPreferences', { userId: user._id, ...patch });
		await recordActivity(ctx, {
			userId: user._id,
			actor: user.email,
			eventType: 'notification.preferences.updated',
			targetType: 'notificationPreferences',
			targetId: String(user._id),
			metadata: patch
		});
	}
});

/** Internal: create a notification for a user (called by other backend modules). */
export const create = internalMutation({
	args: {
		userId: v.id('users'),
		kind: v.string(),
		title: v.string(),
		body: v.string(),
		href: v.optional(v.string())
	},
	returns: v.null(),
	handler: async (ctx, { userId, kind, title, body, href }) => {
		await ctx.db.insert('notifications', { userId, kind, title, body, href, createdAt: Date.now() });
	}
});

/* ------------------------------ admin broadcasts ------------------------------ */

/** Super-admin broadcast to every workspace owner, with a per-recipient row. */
export const broadcast = mutation({
	args: { adminToken: v.string(), title: v.string(), body: v.string(), href: v.optional(v.string()) },
	returns: v.object({ recipients: v.number() }),
	handler: async (ctx, { adminToken, title, body, href }) => {
		const session = await requireAdmin(ctx, adminToken);
		const t = title.trim();
		const b = body.trim();
		if (!t || !b) throw new Error('A broadcast needs a title and a message.');
		if (b.length > 2000) throw new Error('Broadcast messages are limited to 2000 characters.');
		const users = await ctx.db.query('users').take(1000);
		const now = Date.now();
		for (const user of users) {
			const prefs = await prefsFor(ctx, user._id);
			if (!prefs.inApp) continue;
			await ctx.db.insert('notifications', {
				userId: user._id,
				kind: 'admin',
				title: t,
				body: b,
				href,
				createdAt: now
			});
		}
		await recordActivity(ctx, {
			actor: session.email,
			eventType: 'admin.broadcast.sent',
			targetType: 'broadcast',
			targetId: String(now),
			metadata: { title: t, recipients: users.length }
		});
		return { recipients: users.length };
	}
});
