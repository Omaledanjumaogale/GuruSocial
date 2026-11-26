import { v } from 'convex/values';
import {
	internalMutationGeneric as internalMutation,
	internalQueryGeneric as internalQuery
} from 'convex/server';
import { randomToken } from './lib';

/**
 * E-WIN hub ↔ GuruSocial identity synchronisation.
 *
 * The hub is the ecosystem's identity authority. When a person is already signed
 * in to E-WIN, the hub can mint a GuruSocial session over the signed service
 * channel (POST /integrations/ewin/session) instead of asking them to create a
 * second password. Accounts created this way carry a `hub:` password sentinel so
 * the local password path can never match them.
 *
 * Every account also carries `ewinHubUserId` so later sign-ins, reports and
 * revocations resolve the same person on both sides.
 */

const linkShape = v.object({
	status: v.string(),
	hubUserId: v.string(),
	hubEmail: v.string(),
	linkedAt: v.number(),
	lastReportAt: v.union(v.number(), v.null())
});

export const provisionFromHub = internalMutation({
	args: {
		hubUserId: v.string(),
		hubEmail: v.string(),
		name: v.optional(v.string()),
		role: v.optional(v.string())
	},
	returns: v.object({
		token: v.string(),
		sourceUserId: v.string(),
		email: v.string(),
		name: v.string(),
		role: v.string(),
		plan: v.string(),
		created: v.boolean()
	}),
	handler: async (ctx, { hubUserId, hubEmail, name, role }) => {
		const hubId = hubUserId.trim();
		const email = hubEmail.trim().toLowerCase();
		if (!hubId) throw new Error('hubUserId is required.');
		if (!email.includes('@')) throw new Error('A valid hubEmail is required.');

		let user = await ctx.db
			.query('users')
			.withIndex('by_email', (q) => q.eq('email', email))
			.unique();
		let created = false;

		if (!user) {
			const displayName = (name ?? '').trim() || email.split('@')[0];
			const userId = await ctx.db.insert('users', {
				email,
				name: displayName,
				// Hub-asserted accounts authenticate through the hub only.
				passwordHash: `hub:${hubId}`,
				role: 'owner',
				plan: 'free',
				createdAt: Date.now(),
				brandVoice: '',
				ewinHubUserId: hubId,
				ewinSyncedAt: Date.now()
			});
			await ctx.db.insert('brandKits', {
				userId,
				name: 'Default brand',
				tone: 'confident, plain-spoken, helpful',
				keyMessages: [],
				hashtags: [],
				colors: ['#6366f1', '#22c55e', '#f59e0b']
			});
			user = await ctx.db.get(userId);
			created = true;
		} else if (user.ewinHubUserId !== hubId) {
			await ctx.db.patch(user._id, { ewinHubUserId: hubId, ewinSyncedAt: Date.now() });
		}

		const existing = await ctx.db
			.query('ewinLinks')
			.withIndex('by_source_hub', (q) => q.eq('sourceUserId', user!._id))
			.filter((q) => q.eq(q.field('hubUserId'), hubId))
			.unique();
		if (existing) {
			await ctx.db.patch(existing._id, { status: 'active', hubEmail: email, revokedAt: undefined });
		} else {
			await ctx.db.insert('ewinLinks', {
				sourceUserId: user!._id,
				hubUserId: hubId,
				hubEmail: email,
				status: 'active',
				linkedAt: Date.now()
			});
		}

		const token = randomToken(48);
		await ctx.db.insert('sessions', {
			userId: user!._id,
			token,
			expiresAt: Date.now() + 7 * 864e5,
			createdAt: Date.now()
		});
		await ctx.db.insert('activityEvents', {
			userId: user!._id,
			actor: `hub:${hubId}`,
			eventType: created ? 'auth.hub.provisioned' : 'auth.hub.session',
			targetType: 'user',
			targetId: String(user!._id),
			outcome: 'succeeded',
			metadata: { role: role ?? 'owner' },
			createdAt: Date.now()
		});

		return {
			token,
			sourceUserId: String(user!._id),
			email: user!.email,
			name: user!.name,
			role: user!.role,
			plan: user!.plan,
			created
		};
	}
});

/** Identity + link state for one hub user (signed channel only). */
export const identityForHub = internalQuery({
	args: { hubUserId: v.string() },
	returns: v.any(),
	handler: async (ctx, { hubUserId }) => {
		const link = await ctx.db
			.query('ewinLinks')
			.withIndex('by_hub', (q) => q.eq('hubUserId', hubUserId))
			.first();
		if (!link) return null;
		const user = await ctx.db.get(link.sourceUserId);
		if (!user) return null;
		return {
			sourceUserId: String(user._id),
			hubUserId,
			email: user.email,
			name: user.name,
			role: user.role,
			plan: user.plan,
			linkStatus: link.status,
			linkedAt: link.linkedAt,
			lastReportAt: link.lastReportAt ?? null
		};
	}
});

/** Snapshot used for the outbound identity push to the hub. */
export const identityForSync = internalQuery({
	args: { userId: v.string() },
	returns: v.any(),
	handler: async (ctx, { userId }) => {
		const user = await ctx.db.get(userId as any);
		if (!user) return null;
		const links = await ctx.db
			.query('ewinLinks')
			.withIndex('by_source', (q) => q.eq('sourceUserId', userId as any))
			.collect();
		const active = links.find((l) => l.status === 'active') ?? null;
		return {
			sourceUserId: String(user._id),
			hubUserId: user.ewinHubUserId ?? active?.hubUserId ?? null,
			email: user.email,
			name: user.name,
			role: user.role,
			plan: user.plan,
			createdAt: user.createdAt,
			linked: !!active
		};
	}
});

export const recordSync = internalMutation({
	args: { userId: v.string(), delivered: v.boolean() },
	returns: v.null(),
	handler: async (ctx, { userId, delivered }) => {
		await ctx.db.patch(userId as any, { ewinSyncedAt: Date.now() });
		await ctx.db.insert('activityEvents', {
			userId: userId as any,
			actor: 'ewin-hub',
			eventType: 'ewin.identity.sync',
			targetType: 'user',
			targetId: userId,
			outcome: delivered ? 'delivered' : 'failed',
			createdAt: Date.now()
		});
	}
});

/** Link rows for the signed-in user (Settings / Ecosystem page). */
export const linksForUser = internalQuery({
	args: { userId: v.string() },
	returns: v.array(linkShape),
	handler: async (ctx, { userId }) => {
		const rows = await ctx.db
			.query('ewinLinks')
			.withIndex('by_source', (q) => q.eq('sourceUserId', userId as any))
			.collect();
		return rows
			.sort((a, b) => b.linkedAt - a.linkedAt)
			.map((l) => ({
				status: l.status,
				hubUserId: l.hubUserId,
				hubEmail: l.hubEmail,
				linkedAt: l.linkedAt,
				lastReportAt: l.lastReportAt ?? null
			}));
	}
});
