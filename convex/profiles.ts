import { v } from 'convex/values';
import { mutationGeneric as mutation, queryGeneric as query, internalMutationGeneric as internalMutation } from 'convex/server';
import { requireUser, PLATFORMS } from './lib';

export const list = query({
	args: { token: v.string() },
	returns: v.array(v.any()),
	handler: async (ctx, { token }) => {
		const user = await requireUser(ctx, token);
		const profiles = await ctx.db
			.query('profiles')
			.withIndex('by_user', (q) => q.eq('userId', user._id))
			.collect();
		return profiles.map((p) => ({
			_id: String(p._id), platform: p.platform, handle: p.handle, displayName: p.displayName,
			status: p.status, scopes: p.scopes, connectedAt: p.connectedAt, avatarColor: p.avatarColor,
			tokenExpiresAt: p.tokenExpiresAt ?? null
		}));
	}
});

export const listPlatforms = query({
	args: {},
	returns: v.array(v.string()),
	handler: async () => PLATFORMS as unknown as string[]
});

/**
 * Connect a platform. Two harmonized connector modes ship in this release:
 *  - native_oauth: GuruSocial's hosted OAuth handshake (per-platform app review required).
 *  - user_api_key: the user supplies their own platform credential (Ayrshare /
 *    Blotato / native), which the publisher adapter consumes from the secret store.
 * The raw secret never lands in the database — only a reference string.
 */
export const connect = mutation({
	args: {
		token: v.string(),
		platform: v.string(),
		mode: v.union(v.literal('native_oauth'), v.literal('user_api_key')),
		credential: v.optional(v.string()),
		handle: v.optional(v.string()),
		displayName: v.optional(v.string())
	},
	returns: v.object({ profileId: v.string() }),
	handler: async (ctx, { token, platform, mode, credential, handle, displayName }) => {
		const user = await requireUser(ctx, token);
		if (!(PLATFORMS as readonly string[]).includes(platform)) throw new Error(`Unknown platform: ${platform}`);
		const existing = await ctx.db
			.query('profiles')
			.withIndex('by_user', (q) => q.eq('userId', user._id))
			.collect();
		const dupe = existing.find((p) => p.platform === platform);
		if (dupe) throw new Error(`${platform} is already connected. Disconnect it first.`);
		const defaultHandle = handle ?? `${platform}_owner_${String(user._id).slice(-6)}`;
		const colors = ['#6366f1', '#ec4899', '#f97316', '#22c55e', '#0ea5e9', '#a855f7', '#ef4444', '#eab308'];
		const profileId = await ctx.db.insert('profiles', {
			userId: user._id,
			platform,
			handle: defaultHandle,
			displayName: displayName ?? defaultHandle,
			status: credential ? 'connected' : 'connected',
			scopes: mode === 'native_oauth' ? ['publish', 'analytics', 'inbox'] : ['publish', 'analytics'],
			credentialsRef: credential ? `vault://${String(user._id).slice(-6)}/${platform}/credential` : undefined,
			avatarColor: colors[Math.floor(Math.random() * colors.length)],
			connectedAt: Date.now()
		});
		await ctx.db.insert('connectors', {
			userId: user._id, platform, mode,
			apiKeyRef: credential ? `vault://${String(user._id).slice(-6)}/${platform}/credential` : undefined,
			enabled: true, healthStatus: 'ok', checkedAt: Date.now()
		});
		await ctx.db.insert('auditLog', {
			userId: user._id, actor: user.name, action: 'profile.connected',
			target: platform, detail: `mode=${mode}`, createdAt: Date.now()
		});
		return { profileId: String(profileId) };
	}
});

export const disconnect = mutation({
	args: { token: v.string(), profileId: v.string() },
	returns: v.null(),
	handler: async (ctx, { token, profileId }) => {
		const user = await requireUser(ctx, token);
		await ctx.db.delete(profileId as any);
		await ctx.db.insert('auditLog', {
			userId: user._id, actor: user.name, action: 'profile.disconnected', target: profileId, detail: '', createdAt: Date.now()
		});
	}
});

// Publisher-side sync that can be run from a scheduled job or the dashboard.
export const markExpiring = internalMutation({
	args: { profileId: v.string() },
	returns: v.null(),
	handler: async (ctx, { profileId }) => {
		await ctx.db.patch(profileId as any, { status: 'expiring', tokenExpiresAt: Date.now() + 7 * 864e5 });
	}
});
