'use node';
import { v } from 'convex/values';
import { internalActionGeneric as internalAction } from 'convex/server';
import { anyApi } from 'convex/server';
import { createHmac } from 'node:crypto';

const api = anyApi;

/**
 * Push a user identity event to the E-WIN hub.
 *
 * Contract (mirrors the inbound signed channel):
 *   POST {EWIN_HUB_URL}/integrations/gurusocial/identity
 *   x-ewin-timestamp: <unix ms>
 *   x-ewin-signature: HMAC-SHA256(secret, `${path}\n${timestamp}\n${rawBody}`)
 *
 * Nothing is sent when EWIN_HUB_URL or the shared secret is unset, so a
 * deployment that is not part of the ecosystem behaves exactly as before.
 * Failures are recorded and swallowed: the hub must never be able to block
 * sign-in.
 */
export const syncIdentity = internalAction({
	args: { userId: v.string(), event: v.string() },
	returns: v.object({ delivered: v.boolean(), skipped: v.boolean(), status: v.number(), detail: v.string() }),
	handler: async (ctx, { userId, event }) => {
		const hub = process.env.EWIN_HUB_URL;
		const secret = process.env.EWIN_GURUSOCAL_SYNC_SECRET;
		if (!hub || !secret) {
			return { delivered: false, skipped: true, status: 0, detail: 'EWIN_HUB_URL is not configured.' };
		}

		let identity: any = null;
		try {
			identity = await ctx.runQuery(api.ewinAuth.identityForSync, { userId });
		} catch (e: any) {
			return { delivered: false, skipped: false, status: 0, detail: String(e?.message ?? e) };
		}
		if (!identity) {
			return { delivered: false, skipped: true, status: 0, detail: 'No such user.' };
		}

		const path = '/integrations/gurusocial/identity';
		const timestamp = String(Date.now());
		const raw = JSON.stringify({ ...identity, event, version: 1, sentAt: timestamp });
		const signature = createHmac('sha256', secret)
			.update(`${path}\n${timestamp}\n${raw}`)
			.digest('hex');

		try {
			const controller = new AbortController();
			const timer = setTimeout(() => controller.abort(), 8000);
			const res = await fetch(hub.replace(/\/$/, '') + path, {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
					'x-ewin-timestamp': timestamp,
					'x-ewin-signature': signature
				},
				body: raw,
				signal: controller.signal
			});
			clearTimeout(timer);
			await ctx.runMutation(api.ewinAuth.recordSync, { userId, delivered: res.ok });
			return {
				delivered: res.ok,
				skipped: false,
				status: res.status,
				detail: res.ok ? 'delivered' : `hub returned ${res.status}`
			};
		} catch (e: any) {
			await ctx.runMutation(api.ewinAuth.recordSync, { userId, delivered: false });
			return { delivered: false, skipped: false, status: 0, detail: String(e?.message ?? e) };
		}
	}
});
