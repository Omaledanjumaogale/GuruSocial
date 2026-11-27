"use node";
import { v } from 'convex/values';
import { actionGeneric as action } from 'convex/server';
import { requireNodeEnv, sha256 } from './lib';
import { anyApi } from 'convex/server';

const api = anyApi;

/**
 * Super-admin sign-in. Credentials are compared against the encrypted Convex
 * environment variables; a short-lived signed session token is stored server-side.
 */
export const signIn = action({
	args: { email: v.string(), password: v.string() },
	returns: v.object({
		ok: v.boolean(),
		token: v.optional(v.string()),
		email: v.optional(v.string()),
		error: v.optional(v.string())
	}),
	handler: async (ctx, { email, password }) => {
		const adminEmail = (process.env.SUPER_ADMIN_EMAIL ?? '').trim().toLowerCase();
		const adminPassword = process.env.SUPER_ADMIN_PASSWORD ?? '';
		const secret = process.env.ADMIN_SESSION_SECRET ?? 'gurusocial';
		if (!adminEmail || !adminPassword) {
			return { ok: false, error: 'The admin console is not configured on this deployment.' };
		}
		if (email.trim().toLowerCase() !== adminEmail || password !== adminPassword) {
			return { ok: false, error: 'Invalid admin credentials. Check the email and password, then try again.' };
		}
		const token = sha256(`${adminEmail}:${adminPassword}:${secret}:${Date.now()}:${Math.random()}`);
		await ctx.runMutation(api.adminInternal.createSession, { email: adminEmail, token });
		return { ok: true, token, email: adminEmail };
	}
});

export const stats = action({
	args: { adminToken: v.string() },
	returns: v.any(),
	handler: async (ctx, { adminToken }) => {
		const session = await ctx.runQuery(api.adminInternal.byToken, { token: adminToken });
		if (!session) throw new Error('Admin session invalid or expired. Sign in again.');
		return await ctx.runQuery(api.adminInternal.globalStats, {});
	}
});

export const signOut = action({
	args: { adminToken: v.string() },
	returns: v.null(),
	handler: async (ctx, { adminToken }) => {
		await ctx.runMutation(api.adminInternal.endSession, { token: adminToken });
	}
});
