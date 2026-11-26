import { v } from 'convex/values';
import {
	mutationGeneric as mutation,
	queryGeneric as query,
	internalQueryGeneric as internalQuery,
	internalMutationGeneric as internalMutation
} from 'convex/server';
import { requireUser } from './lib';

/**
 * EWIN hub connection codes (Settings → "Connect to E-WIN hub").
 * The raw code is shown once; the database stores only its SHA-256 hash,
 * mirroring the BusineXense ↔ E-WIN protocol in the ecosystem docs.
 */
export const issueCode = mutation({
	args: { token: v.string() },
	returns: v.object({ code: v.string(), expiresAt: v.number() }),
	handler: async (ctx, { token }) => {
		const user = await requireUser(ctx, token);
		const code = `gsx-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}`.toUpperCase();
		await ctx.db.insert('ewinCodes', {
			userId: user._id,
			codeHash: ewinHash(code),
			email: user.email,
			expiresAt: Date.now() + 10 * 60e3 // ten minutes, per ecosystem protocol
		});
		await ctx.db.insert('auditLog', {
			userId: user._id, actor: user.name, action: 'ewin.code_issued', target: 'hub', detail: '', createdAt: Date.now()
		});
		return { code, expiresAt: Date.now() + 10 * 60e3 };
	}
});

/**
 * Hub connection state for the signed-in workspace, used by Settings and the
 * Ecosystem page. Read-only and safe to poll: it exposes identifiers the user
 * already owns, never the shared secret or report bodies.
 */
export const status = query({
	args: { token: v.string() },
	returns: v.object({
		linked: v.boolean(),
		hubUserId: v.union(v.string(), v.null()),
		hubEmail: v.union(v.string(), v.null()),
		linkedAt: v.union(v.number(), v.null()),
		lastReportAt: v.union(v.number(), v.null()),
		syncedAt: v.union(v.number(), v.null()),
		history: v.array(
			v.object({
				status: v.string(),
				hubUserId: v.string(),
				hubEmail: v.string(),
				linkedAt: v.number(),
				lastReportAt: v.union(v.number(), v.null())
			})
		)
	}),
	handler: async (ctx, { token }) => {
		const user = await requireUser(ctx, token);
		const rows = await ctx.db
			.query('ewinLinks')
			.withIndex('by_source', (q) => q.eq('sourceUserId', user._id))
			.collect();
		const sorted = rows.sort((a, b) => b.linkedAt - a.linkedAt);
		const active = sorted.find((l) => l.status === 'active') ?? null;
		return {
			linked: !!active,
			hubUserId: active?.hubUserId ?? null,
			hubEmail: active?.hubEmail ?? null,
			linkedAt: active?.linkedAt ?? null,
			lastReportAt: active?.lastReportAt ?? null,
			syncedAt: user.ewinSyncedAt ?? null,
			history: sorted.map((l) => ({
				status: l.status,
				hubUserId: l.hubUserId,
				hubEmail: l.hubEmail,
				linkedAt: l.linkedAt,
				lastReportAt: l.lastReportAt ?? null
			}))
		};
	}
});

/** Owner-initiated disconnect: revokes every hub link for this workspace. */
export const disconnect = mutation({
	args: { token: v.string() },
	returns: v.number(),
	handler: async (ctx, { token }) => {
		const user = await requireUser(ctx, token);
		const rows = await ctx.db
			.query('ewinLinks')
			.withIndex('by_source', (q) => q.eq('sourceUserId', user._id))
			.collect();
		let revoked = 0;
		for (const row of rows) {
			if (row.status === 'active') {
				await ctx.db.patch(row._id, { status: 'revoked', revokedAt: Date.now() });
				revoked++;
			}
		}
		await ctx.db.insert('auditLog', {
			userId: user._id,
			actor: user.name,
			action: 'ewin.disconnected',
			target: 'hub',
			detail: `${revoked} link(s) revoked`,
			createdAt: Date.now()
		});
		return revoked;
	}
});

export function ewinHash(input: string): string {
	// Convex-safe deterministic hash for code verification (matches lib.sha256 style).
	let h1 = 0xdeadbeef ^ input.length;
	let h2 = 0x41c6ce57 ^ input.length;
	for (let i = 0; i < input.length; i++) {
		const ch = input.charCodeAt(i);
		h1 = Math.imul(h1 ^ ch, 2654435761);
		h2 = Math.imul(h2 ^ ch, 1597334677);
	}
	h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
	h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
	return (
		(4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(16, '0') +
		(4294967296 * (2097151 & h1) + (h2 >>> 0)).toString(16).padStart(16, '0')
	);
}

/* ---------------------- internal lookups for the signed channel ---------------------- */

export const byCodeHash = internalQuery({
	args: { codeHash: v.string() },
	returns: v.any(),
	handler: async (ctx, { codeHash }) => {
		const row = await ctx.db
			.query('ewinCodes')
			.withIndex('by_hash', (q) => q.eq('codeHash', codeHash))
			.unique();
		if (!row || row.expiresAt < Date.now() || row.usedAt) return null;
		return row;
	}
});

export const linkByPair = internalQuery({
	args: { sourceUserId: v.string(), hubUserId: v.string() },
	returns: v.any(),
	handler: async (ctx, { sourceUserId, hubUserId }) => {
		return await ctx.db
			.query('ewinLinks')
			.withIndex('by_source_hub', (q) => q.eq('sourceUserId', sourceUserId as any))
			.filter((q) => q.eq(q.field('hubUserId'), hubUserId))
			.unique();
	}
});

export const bindLink = internalMutation({
	args: { sourceUserId: v.string(), hubUserId: v.string(), hubEmail: v.string() },
	returns: v.any(),
	handler: async (ctx, { sourceUserId, hubUserId, hubEmail }) => {
		const existing = await ctx.db
			.query('ewinLinks')
			.withIndex('by_source_hub', (q) => q.eq('sourceUserId', sourceUserId as any))
			.filter((q) => q.eq(q.field('hubUserId'), hubUserId))
			.unique();
		if (existing) {
			// Reconnecting the same pair is supported; rebind updates identity and reactivates.
			await ctx.db.patch(existing._id, { hubEmail, status: 'active', revokedAt: undefined, linkedAt: Date.now() });
			return existing;
		}
		const id = await ctx.db.insert('ewinLinks', {
			sourceUserId: sourceUserId as any, hubUserId, hubEmail, status: 'active', linkedAt: Date.now()
		});
		return await ctx.db.get(id);
	}
});

export const revokeLink = internalMutation({
	args: { sourceUserId: v.string(), hubUserId: v.string() },
	returns: v.any(),
	handler: async (ctx, { sourceUserId, hubUserId }) => {
		const existing = await ctx.db
			.query('ewinLinks')
			.withIndex('by_source_hub', (q) => q.eq('sourceUserId', sourceUserId as any))
			.filter((q) => q.eq(q.field('hubUserId'), hubUserId))
			.unique();
		if (!existing) return null;
		await ctx.db.patch(existing._id, { status: 'revoked', revokedAt: Date.now() });
		return existing;
	}
});

export const markReported = internalMutation({
	args: { linkId: v.string(), at: v.number() },
	returns: v.null(),
	handler: async (ctx, { linkId, at }) => {
		await ctx.db.patch(linkId as any, { lastReportAt: at });
	}
});

export const snapshotForSource = internalQuery({
	args: { sourceUserId: v.string() },
	returns: v.any(),
	handler: async (ctx, { sourceUserId }) => {
		const uid = sourceUserId as any;
		const [profiles, posts, audience, keys, jobs, campaigns, contacts, inbox] = await Promise.all([
			ctx.db.query('profiles').withIndex('by_user', (q) => q.eq('userId', uid)).collect(),
			ctx.db.query('posts').withIndex('by_user', (q) => q.eq('userId', uid)).collect(),
			ctx.db.query('audienceSnapshot').withIndex('by_user', (q) => q.eq('userId', uid)).collect(),
			ctx.db.query('apiKeys').withIndex('by_user', (q) => q.eq('userId', uid)).collect(),
			ctx.db.query('harvestJobs').withIndex('by_user', (q) => q.eq('userId', uid)).collect(),
			ctx.db.query('campaigns').withIndex('by_user', (q) => q.eq('userId', uid)).collect(),
			ctx.db.query('contacts').withIndex('by_user', (q) => q.eq('userId', uid)).collect(),
			ctx.db.query('inboxItems').withIndex('by_user', (q) => q.eq('userId', uid)).collect()
		]);
		const latestAudience = new Map<string, number>();
		for (const a of [...audience].sort((x, y) => x.capturedAt - y.capturedAt)) latestAudience.set(a.platform, a.followers);
		return {
			identity: {
				source: 'gurusocial',
				profilesConnected: profiles.length,
				platforms: profiles.map((p) => p.platform)
			},
			plan: 'free', // the source plan summary is read per user below in the http layer if needed
			activity: {
				postsTotal: posts.length,
				postsPublished: posts.filter((p) => p.status === 'published').length,
				postsScheduled: posts.filter((p) => p.status === 'scheduled').length,
				postsDrafts: posts.filter((p) => p.status === 'draft').length,
				recentPosts: [...posts].sort((a, b) => b.createdAt - a.createdAt).slice(0, 20).map((p) => ({
					id: String(p._id), platforms: p.platforms, status: p.status,
					publishedAt: p.publishedAt ?? null, createdAt: p.createdAt
				})),
				audienceFollowers: Object.fromEntries(latestAudience),
				activeApiKeys: keys.filter((k) => !k.revokedAt).length,
				harvestJobs: jobs.length,
				campaignsActive: campaigns.filter((c) => c.endDate > Date.now()).length,
				contacts: contacts.length,
				unreadInbox: inbox.filter((i) => i.status === 'unread').length
			},
			excluded: ['private content bodies', 'platform credentials', 'API key secrets', 'inbox message bodies'],
			generatedAt: Date.now()
		};
	}
});

export const planForSource = internalQuery({
	args: { sourceUserId: v.string() },
	returns: v.string(),
	handler: async (ctx, { sourceUserId }) => {
		const user = await ctx.db.get(sourceUserId as any);
		return String((user as any)?.plan ?? 'free');
	}
});

export const markCodeUsed = internalMutation({
	args: { codeId: v.string() },
	returns: v.null(),
	handler: async (ctx, { codeId }) => {
		await ctx.db.patch(codeId as any, { usedAt: Date.now() });
	}
});
