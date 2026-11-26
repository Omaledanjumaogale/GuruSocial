"use node";
import { v } from 'convex/values';
import { actionGeneric as action } from 'convex/server';
import { anyApi } from 'convex/server';

const api = anyApi;

/**
 * Bootstrap the operator's workspace login.
 *
 * Guarded by the operator password stored in the Convex environment, so this
 * cannot be used to mint an owner account without already holding that secret.
 * Safe to run repeatedly.
 */
export const ensureSuperAdmin = action({
	args: { email: v.string(), password: v.string(), name: v.optional(v.string()) },
	returns: v.object({ created: v.boolean(), userId: v.string() }),
	handler: async (ctx, { email, password, name }) => {
		const adminEmail = (process.env.SUPER_ADMIN_EMAIL ?? '').trim().toLowerCase();
		const adminPassword = process.env.SUPER_ADMIN_PASSWORD ?? '';
		if (!adminEmail || !adminPassword) {
			throw new Error('SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD are not set on this deployment.');
		}
		if (email.trim().toLowerCase() !== adminEmail || password !== adminPassword) {
			throw new Error('Operator credentials do not match this deployment.');
		}
		return await ctx.runMutation(api.bootstrapInternal.ensureSuperAdminUser, {
			email: adminEmail,
			password: adminPassword,
			name: name ?? 'E-WIN Super Admin'
		});
	}
});
