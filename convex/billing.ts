import { v } from 'convex/values';
import { mutationGeneric as mutation, queryGeneric as query, actionGeneric as action, internalMutationGeneric as internalMutation, internalQueryGeneric as internalQuery } from 'convex/server';
import { assertPermission } from './rbac';
import { anyApi } from 'convex/server';

const api = anyApi;

/**
 * Pay-as-you-use billing through the central E-WIN wallet (naira, kobo units).
 *
 * Contract (hub NAIRA-PAY-AS-YOU-USE v3.1 + live wallet bridge):
 *   platform fee: flat ₦100 (10,000 kobo) per billable action, editable hub-side
 *   service fee:  priced per action in the hub catalogue
 *   flow:         quote → in-app caution pop-up → hold → execute → release(resultId) | refund
 *   confirm:      quotes expire in 120 s; deposit/confirm happens in the central app
 *
 * This module stores only REFERENCES to central quotes — never balances.
 * Fail-closed rules: a charge is only taken through a verified central quote;
 * when the wallet integration is not configured the action is free and logged,
 * never silently billed.
 */

export const preflight = action({
	args: { token: v.string(), actionKey: v.string(), target: v.optional(v.string()) },
	returns: v.any(),
	handler: async (ctx, { token, actionKey, target }) => {
		const session = await ctx.runQuery(api.authInternal.byToken, { token });
		if (!session) throw new Error('Unauthorized: session expired or invalid');
		const user = await ctx.runQuery(api.authInternal.userById, { userId: session.userId });
		assertPermission(user, 'workspace.read');

		// Super-admin exemption — server-side, not a UI flag.
		const admin = await ctx.runQuery(api.adminInternal.superAdminEmail, {});
		if (admin && user.email.trim().toLowerCase() === String(admin).toLowerCase()) {
			return { exempt: true as const, reason: 'super_admin' };
		}

		const configured = await ctx.runAction(api.ewinWallet.walletRequest, {
			operation: 'balance', subject: user.ewinHubUserId ?? 'unlinked', key: `probe.${Date.now().toString(36)}`
		});
		if (!configured || configured.skipped) {
			// Wallet integration not configured on this deployment — free action, logged.
			return { billingEnabled: false as const, reason: 'wallet_not_configured' };
		}
		if (!user.ewinHubUserId) {
			return { linked: false as const, reason: 'Link your E-WIN account to use paid actions. Settings → E-WIN hub connection.' };
		}
		if (!configured.ok) {
			// Unlinked/needs harmonization — free action, logged; hub is authoritative.
			return { billingEnabled: false as const, reason: 'wallet_unavailable', detail: typeof configured.result === 'string' ? configured.result : undefined };
		}

		const quote = await ctx.runAction(api.ewinWallet.walletRequest, {
			operation: 'quote',
			subject: user.ewinHubUserId,
			key: `quote.${Date.now().toString(36)}.${Math.random().toString(36).slice(2, 8)}`,
			actionKey,
			target
		});
		const q = quote?.result ?? {};
		if (!quote.ok || !q.quoteId) {
			return { billingEnabled: false as const, reason: 'quote_unavailable', detail: String(q?.error ?? q ?? '').slice(0, 200) };
		}
		const refId = await ctx.runMutation(api.billing.insertRef, {
			userId: String(user._id), quoteId: String(q.quoteId), actionKey, target,
			totalKobo: Number(q.totalKobo ?? 0), balanceKobo: q.balanceKobo != null ? Number(q.balanceKobo) : undefined,
			expiresAt: Number(q.expiresAt ?? Date.now() + 120e3)
		});
		return {
			billingEnabled: true as const,
			refId: String(refId),
			quoteId: String(q.quoteId),
			totalKobo: Number(q.totalKobo ?? 0),
			platformFeeKobo: Number(q.platformFeeKobo ?? 0),
			serviceFeeKobo: Number(q.serviceFeeKobo ?? 0),
			balanceKobo: q.balanceKobo != null ? Number(q.balanceKobo) : undefined,
			balanceAfterKobo: q.balanceAfterKobo != null ? Number(q.balanceAfterKobo) : undefined,
			expiresAt: Number(q.expiresAt ?? 0)
		};
	}
});

/** Confirm + hold the central quote, then run the caller's action. */
export const hold = action({
	args: { token: v.string(), refId: v.string() },
	returns: v.any(),
	handler: async (ctx, { token, refId }) => {
		const session = await ctx.runQuery(api.authInternal.byToken, { token });
		if (!session) throw new Error('Unauthorized: session expired or invalid');
		const user = await ctx.runQuery(api.authInternal.userById, { userId: session.userId });
		const ref = await ctx.runQuery(api.billing.refById, { refId });
		if (!ref || String(ref.userId) !== String(user._id)) throw new Error('Quote reference not found.');
		if (ref.status !== 'quoted') throw new Error('Quote already used or expired.');
		if (ref.expiresAt < Date.now()) {
			await ctx.runMutation(api.billing.markFailed, { refId });
			throw new Error('The price quote expired. Request a fresh quote.');
		}
		const res = await ctx.runAction(api.ewinWallet.walletRequest, {
			operation: 'hold',
			subject: user.ewinHubUserId ?? 'unlinked',
			key: `hold.${ref.quoteId}`,
			quoteId: ref.quoteId
		});
		if (!res.ok) {
			await ctx.runMutation(api.billing.markFailed, { refId });
			const detail = typeof res.result === 'string' ? res.result : (res.result?.error ?? res.detail ?? `hold failed (${res.status})`);
			throw new Error(String(detail).slice(0, 200));
		}
		await ctx.runMutation(api.billing.markHeld, { refId, receipt: res.result?.receipt ? String(res.result.receipt) : undefined });
		return { held: true as const };
	}
});

/** Settle after verified successful delivery. */
export const release = action({
	args: { token: v.string(), refId: v.string(), resultId: v.string() },
	returns: v.null(),
	handler: async (ctx, { token, refId, resultId }) => {
		const session = await ctx.runQuery(api.authInternal.byToken, { token });
		if (!session) return;
		const user = await ctx.runQuery(api.authInternal.userById, { userId: session.userId });
		const ref = await ctx.runQuery(api.billing.refById, { refId });
		if (!ref || String(ref.userId) !== String(user._id)) return;
		if (ref.status !== 'held') return;
		const res = await ctx.runAction(api.ewinWallet.walletRequest, {
			operation: 'release',
			subject: user.ewinHubUserId ?? 'unlinked',
			key: `release.${ref.quoteId}`,
			quoteId: ref.quoteId,
			resultId
		});
		if (res.ok) {
			await ctx.runMutation(api.billing.markReleased, { refId, resultId });
		}
	}
});

/** Refund on failure — funds return to the user's central wallet. */
export const refund = action({
	args: { token: v.string(), refId: v.string(), reason: v.optional(v.string()) },
	returns: v.null(),
	handler: async (ctx, { token, refId }) => {
		const session = await ctx.runQuery(api.authInternal.byToken, { token });
		if (!session) return;
		const user = await ctx.runQuery(api.authInternal.userById, { userId: session.userId });
		const ref = await ctx.runQuery(api.billing.refById, { refId });
		if (!ref || String(ref.userId) !== String(user._id)) return;
		if (ref.status !== 'held' && ref.status !== 'failed') return;
		const res = await ctx.runAction(api.ewinWallet.walletRequest, {
			operation: 'refund',
			subject: user.ewinHubUserId ?? 'unlinked',
			key: `refund.${ref.quoteId}.${(ref.updatedAt ?? 0).toString(36)}`,
			quoteId: ref.quoteId
		});
		await ctx.runMutation(api.billing.markRefunded, { refId });
		void res;
	}
});

/** Central wallet balance read (display only — the hub ledger is authoritative). */
export const balance = query({
	args: { token: v.string() },
	returns: v.any(),
	handler: async (ctx, { token }) => {
		const session = await ctx.runQuery(api.authInternal.byToken, { token });
		if (!session) return { linked: false as const };
		const user = await ctx.runQuery(api.authInternal.userById, { userId: session.userId });
		if (!user.ewinHubUserId) return { linked: false as const };
		return { linked: true as const, ewinHubUserId: user.ewinHubUserId };
	}
});

/** Live balance via the bridge (action — call from the wallet badge on demand). */
export const liveBalance = action({
	args: { token: v.string() },
	returns: v.any(),
	handler: async (ctx, { token }) => {
		const session = await ctx.runQuery(api.authInternal.byToken, { token });
		if (!session) throw new Error('Unauthorized: session expired or invalid');
		const user = await ctx.runQuery(api.authInternal.userById, { userId: session.userId });
		const admin = await ctx.runQuery(api.adminInternal.superAdminEmail, {});
		if (admin && user.email.trim().toLowerCase() === String(admin).toLowerCase()) {
			return { exempt: true as const };
		}
		if (!user.ewinHubUserId) return { linked: false as const };
		const res = await ctx.runAction(api.ewinWallet.walletRequest, {
			operation: 'balance',
			subject: user.ewinHubUserId,
			key: `balance.${Date.now().toString(36)}`
		});
		if (!res.ok) return { linked: true as const, available: false as const, detail: typeof res.result === 'string' ? res.result : (res.detail ?? `unavailable (${res.status})`) };
		return { linked: true as const, available: true as const, availableKobo: Number(res.result?.availableKobo ?? 0), currency: String(res.result?.currency ?? 'NGN'), asOf: Date.now() };
	}
});

/** Platform heartbeat to the hub (registry liveness). */
export const heartbeat = action({
	args: { token: v.string() },
	returns: v.any(),
	handler: async (ctx, { token }) => {
		const session = await ctx.runQuery(api.authInternal.byToken, { token });
		if (!session) throw new Error('Unauthorized: session expired or invalid');
		const res = await ctx.runAction(api.ewinWallet.walletRequest, {
			operation: 'heartbeat',
			subject: 'platform',
			key: `hb.${Date.now().toString(36)}`
		});
		return res;
	}
});

export const insertRef = internalMutation({
	args: { userId: v.string(), quoteId: v.string(), actionKey: v.string(), target: v.optional(v.string()), totalKobo: v.number(), balanceKobo: v.optional(v.number()), expiresAt: v.number() },
	returns: v.string(),
	handler: async (ctx, { userId, quoteId, actionKey, target, totalKobo, balanceKobo, expiresAt }) => {
		return String(await ctx.db.insert('ewinWalletRefs', {
			userId: userId as any, quoteId, actionKey, target, totalKobo, balanceKobo, expiresAt,
			status: 'quoted' as const, createdAt: Date.now(), updatedAt: Date.now()
		}));
	}
});

export const refById = internalQuery({
	args: { refId: v.string() },
	returns: v.any(),
	handler: async (ctx, { refId }) => ctx.db.get(refId as any)
});

export const markHeld = internalMutation({
	args: { refId: v.string(), receipt: v.optional(v.string()) },
	returns: v.null(),
	handler: async (ctx, { refId, receipt }) => {
		await ctx.db.patch(refId as any, { status: 'held', ...(receipt ? { receipt } : {}), updatedAt: Date.now() });
	}
});

export const markReleased = internalMutation({
	args: { refId: v.string(), resultId: v.string() },
	returns: v.null(),
	handler: async (ctx, { refId, resultId }) => {
		await ctx.db.patch(refId as any, { status: 'released', resultId, updatedAt: Date.now() });
	}
});

export const markRefunded = internalMutation({
	args: { refId: v.string() },
	returns: v.null(),
	handler: async (ctx, { refId }) => {
		await ctx.db.patch(refId as any, { status: 'refunded', updatedAt: Date.now() });
	}
});

export const markFailed = internalMutation({
	args: { refId: v.string() },
	returns: v.null(),
	handler: async (ctx, { refId }) => {
		await ctx.db.patch(refId as any, { status: 'failed', updatedAt: Date.now() });
	}
});
