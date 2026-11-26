"use node";
import { v } from 'convex/values';
import { internalActionGeneric as internalAction, actionGeneric as action } from 'convex/server';
import { anyApi } from 'convex/server';

const api = anyApi;

/**
 * E-WIN central wallet bridge — GuruSocial platform side.
 *
 * Implements the hub's documented server-to-server contract exactly:
 *   POST {hub}/wallet/v1
 *   body:  {version:1, platformId, operation, subject, key, actionKey?, target?, quoteId?, resultId?}
 *   auth:  X-Ewin-Timestamp (ms) + X-Ewin-Signature = hex HMAC-SHA256(timestamp + '.' + rawBody, platformServiceKey)
 * Money is held, quoted and settled ONLY by the central hub ledger; this
 * platform stores references, never balances. Amounts are integer kobo.
 */
const PLATFORM_ID = 'gurusocial';

function hubOrigin(): string {
	const explicit = process.env.EWIN_WALLET_HUB_URL;
	if (explicit) return explicit.replace(/\/$/, '');
	const hub = process.env.EWIN_HUB_URL;
	if (hub) return hub.replace(/\/$/, '');
	return 'https://affable-dragon-883.eu-west-1.convex.site';
}

async function hmac(secret: string, message: string): Promise<string> {
	const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
	const bytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
	return Array.from(new Uint8Array(bytes)).map((x) => x.toString(16).padStart(2, '0')).join('');
}

export const walletRequest = internalAction({
	args: {
		operation: v.union(v.literal('heartbeat'), v.literal('balance'), v.literal('quote'), v.literal('hold'), v.literal('release'), v.literal('refund')),
		subject: v.string(),
		key: v.string(),
		actionKey: v.optional(v.string()),
		target: v.optional(v.string()),
		quoteId: v.optional(v.string()),
		resultId: v.optional(v.string())
	},
	returns: v.any(),
	handler: async (ctx, { operation, subject, key, actionKey, target, quoteId, resultId }) => {
		const secret = process.env.EWIN_WALLET_SERVICE_KEY;
		if (!secret || secret.length < 32) {
			return { ok: false, skipped: true, detail: 'EWIN_WALLET_SERVICE_KEY is not configured on this deployment.' };
		}
		const body = JSON.stringify({
			version: 1,
			platformId: PLATFORM_ID,
			operation,
			subject,
			key,
			...(actionKey ? { actionKey } : {}),
			...(target ? { target } : {}),
			...(quoteId ? { quoteId } : {}),
			...(resultId ? { resultId } : {})
		});
		const timestamp = String(Date.now());
		const signature = await hmac(secret, timestamp + '.' + body);
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), 15000);
		try {
			const res = await fetch(new URL('/wallet/v1', hubOrigin()), {
				method: 'POST',
				headers: { 'content-type': 'application/json', 'x-ewin-timestamp': timestamp, 'x-ewin-signature': signature },
				body,
				signal: controller.signal
			});
			const text = await res.text();
			let parsed: any = null;
			try { parsed = JSON.parse(text); } catch { parsed = text.slice(0, 300); }
			return { ok: res.ok, status: res.status, result: parsed };
		} catch (e: any) {
			return { ok: false, status: 0, result: null, detail: String(e?.message ?? e) };
		} finally {
			clearTimeout(timer);
		}
	}
});

/** Idempotency key format the hub accepts: [A-Za-z0-9_.:-]{8,150} */
export function idemKey(prefix: string): string {
	return `${prefix}.${Date.now().toString(36)}.${Math.random().toString(36).slice(2, 8)}`;
}

/** Super-admin exemption: the platform owner's own account never pays for the platform's own features. */
export const isSuperAdminEmail = action({
	args: { token: v.string() },
	returns: v.boolean(),
	handler: async (ctx, { token }) => {
		const session = await ctx.runQuery(api.authInternal.byToken, { token });
		if (!session) return false;
		const user = await ctx.runQuery(api.authInternal.userById, { userId: session.userId });
		const adminEmail = (process.env.SUPER_ADMIN_EMAIL ?? '').trim().toLowerCase();
		return Boolean(adminEmail) && String(user.email).trim().toLowerCase() === adminEmail;
	}
});
