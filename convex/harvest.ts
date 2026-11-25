import { v } from 'convex/values';
import { mutationGeneric as mutation, queryGeneric as query } from 'convex/server';
import { requireUser } from './lib';

/**
 * Reverse API Engineer (kalil0321/reverse-api-engineer) harvest jobs.
 *
 * The engine itself runs in the RAE sidecar (`sidecar/reverse-api-bridge.py`):
 * it drives a browser over the target URL, captures HAR traffic, and generates
 * a typed API client in the language of your choice. GuruSocial records the
 * job, its endpoints, and any credential markers the audit reports (redacted
 * at rest — only the marker name, never the secret value) so the user can wire
 * the discovered keys into platform connectors with consent.
 */
export const list = query({
	args: { token: v.string() },
	returns: v.array(v.any()),
	handler: async (ctx, { token }) => {
		const user = await requireUser(ctx, token);
		return await ctx.db
			.query('harvestJobs')
			.withIndex('by_user', (q) => q.eq('userId', user._id))
			.collect();
	}
});

export const create = mutation({
	args: { token: v.string(), targetUrl: v.string(), goal: v.string(), mode: v.union(v.literal('agent'), v.literal('manual'), v.literal('engineer')) },
	returns: v.object({ jobId: v.string() }),
	handler: async (ctx, { token, targetUrl, goal, mode }) => {
		const user = await requireUser(ctx, token);
		if (!/^https?:\/\//.test(targetUrl)) throw new Error('Enter the full https:// URL of the target site.');
		const id = await ctx.db.insert('harvestJobs', {
			userId: user._id, targetUrl, goal, mode, status: 'queued',
			endpointsFound: 0, keysFound: [], notes: '', createdAt: Date.now(), updatedAt: Date.now()
		});
		return { jobId: String(id) };
	}
});

export const updateStatus = mutation({
	args: { token: v.string(), id: v.string(), status: v.union(v.literal('queued'), v.literal('capturing'), v.literal('generating'), v.literal('ready'), v.literal('failed')), endpointsFound: v.optional(v.number()), generatedClient: v.optional(v.string()), keysFound: v.optional(v.array(v.string())), notes: v.optional(v.string()) },
	returns: v.null(),
	handler: async (ctx, { token, id, status, endpointsFound, generatedClient, keysFound, notes }) => {
		const user = await requireUser(ctx, token);
		await ctx.db.patch(id as any, {
			status, updatedAt: Date.now(),
			...(endpointsFound !== undefined ? { endpointsFound } : {}),
			...(generatedClient !== undefined ? { generatedClient } : {}),
			...(keysFound !== undefined ? { keysFound } : {}),
			...(notes !== undefined ? { notes } : {})
		});
	}
});

export const remove = mutation({
	args: { token: v.string(), id: v.string() },
	returns: v.null(),
	handler: async (ctx, { token, id }) => {
		await requireUser(ctx, token);
		await ctx.db.delete(id as any);
	}
});
