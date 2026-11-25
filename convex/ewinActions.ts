"use node";
import { v } from 'convex/values';
import { internalActionGeneric as internalAction } from 'convex/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { requireNodeEnv } from './lib';
import { anyApi } from 'convex/server';

const api = anyApi;

/**
 * E-WIN ↔ GuruSocial signed service channel.
 * Protocol matches the ecosystem contract documented in the hub:
 *   signature = lowercase hex HMAC-SHA256( path + "\n" + timestamp + "\n" + exactRawBody, sharedSecret )
 *   headers:  x-ewin-timestamp (epoch ms), x-ewin-signature
 * Requests outside a five-minute clock window fail. Browser cookies and
 * client-supplied URLs are never accepted as authentication.
 */
export const verifySignature = internalAction({
	args: { path: v.string(), timestamp: v.string(), rawBody: v.string(), signature: v.string() },
	returns: v.boolean(),
	handler: async (ctx, { path, timestamp, rawBody, signature }) => {
		const secret = requireNodeEnv('EWIN_GURUSOCAL_SYNC_SECRET');
		const ts = Number(timestamp);
		if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > 5 * 60e3) return false;
		const expected = createHmac('sha256', secret).update(`${path}\n${timestamp}\n${rawBody}`).digest('hex');
		const a = Buffer.from(expected, 'hex');
		const b = Buffer.from(String(signature).toLowerCase(), 'hex');
		if (a.length !== b.length) return false;
		return timingSafeEqual(a, b);
	}
});

export const buildReport = internalAction({
	args: { sourceUserId: v.string(), hubUserId: v.string() },
	returns: v.any(),
	handler: async (ctx, { sourceUserId, hubUserId }) => {
		const link = await ctx.runQuery(api.ewin.linkByPair, { sourceUserId, hubUserId });
		if (!link || link.status !== 'active') {
			// Revoked or unavailable link → null snapshot per contract.
			return null;
		}
		const snapshot = await ctx.runQuery(api.ewin.snapshotForSource, { sourceUserId });
		const plan = await ctx.runQuery(api.ewin.planForSource, { sourceUserId });
		await ctx.runMutation(api.ewin.markReported, { linkId: link._id, at: Date.now() });
		return { ...snapshot, plan, snapshotVersion: 1 };
	}
});

export const completeLink = internalAction({
	args: { code: v.string(), hubUserId: v.string(), hubEmail: v.string() },
	returns: v.any(),
	handler: async (ctx, { code, hubUserId, hubEmail }) => {
		const { ewinHash } = await import('./ewin');
		const codeRow = await ctx.runQuery(api.ewin.byCodeHash, { codeHash: ewinHash(code.trim().toUpperCase()) });
		if (!codeRow) throw new Error('Invalid, expired or already-used connection code.');
		const link = await ctx.runMutation(api.ewin.bindLink, {
			sourceUserId: String(codeRow.userId), hubUserId, hubEmail: String(hubEmail).toLowerCase()
		});
		await ctx.runMutation(api.ewin.markCodeUsed, { codeId: codeRow._id });
		return { sourceUserId: String(codeRow.userId), hubUserId, sourceEmail: codeRow.email };
	}
});

export const revoke = internalAction({
	args: { sourceUserId: v.string(), hubUserId: v.string() },
	returns: v.any(),
	handler: async (ctx, { sourceUserId, hubUserId }) => {
		return await ctx.runMutation(api.ewin.revokeLink, { sourceUserId, hubUserId });
	}
});
