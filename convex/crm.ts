import { v } from 'convex/values';
import { mutationGeneric as mutation, queryGeneric as query } from 'convex/server';
import { requireUser } from './lib';

export const list = query({
	args: { token: v.string(), stage: v.optional(v.string()) },
	returns: v.array(v.any()),
	handler: async (ctx, { token, stage }) => {
		const user = await requireUser(ctx, token);
		let rows = await ctx.db
			.query('contacts')
			.withIndex('by_user', (q) => q.eq('userId', user._id))
			.collect();
		if (stage) rows = rows.filter((c) => c.stage === stage);
		return rows.sort((a, b) => b.createdAt - a.createdAt).map((r) => ({ ...r, _id: String(r._id), sourceInboxItemId: r.sourceInboxItemId ? String(r.sourceInboxItemId) : null }));
	}
});

export const upsert = mutation({
	args: {
		token: v.string(), name: v.string(), handle: v.string(), platform: v.string(),
		email: v.optional(v.string()), phone: v.optional(v.string()),
		stage: v.union(v.literal('lead'), v.literal('engaged'), v.literal('opportunity'), v.literal('customer'), v.literal('advocate'), v.literal('lost')),
		value: v.number(), notes: v.optional(v.string())
	},
	returns: v.object({ contactId: v.string() }),
	handler: async (ctx, { token, name, handle, platform, email, phone, stage, value, notes }) => {
		const user = await requireUser(ctx, token);
		const id = await ctx.db.insert('contacts', {
			userId: user._id, name, handle, platform, email, phone, stage, value, notes: notes ?? '', createdAt: Date.now()
		});
		return { contactId: String(id) };
	}
});

export const moveStage = mutation({
	args: { token: v.string(), id: v.string(), stage: v.union(v.literal('lead'), v.literal('engaged'), v.literal('opportunity'), v.literal('customer'), v.literal('advocate'), v.literal('lost')) },
	returns: v.null(),
	handler: async (ctx, { token, id, stage }) => {
		await requireUser(ctx, token);
		await ctx.db.patch(id as any, { stage });
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

export const campaigns = query({
	args: { token: v.string() },
	returns: v.array(v.any()),
	handler: async (ctx, { token }) => {
		const user = await requireUser(ctx, token);
		return await ctx.db
			.query('campaigns')
			.withIndex('by_user', (q) => q.eq('userId', user._id))
			.collect();
	}
});

export const createCampaign = mutation({
	args: { token: v.string(), name: v.string(), goal: v.string(), startDate: v.number(), endDate: v.number(), platforms: v.array(v.string()), budget: v.optional(v.number()) },
	returns: v.object({ campaignId: v.string() }),
	handler: async (ctx, { token, name, goal, startDate, endDate, platforms, budget }) => {
		const user = await requireUser(ctx, token);
		const id = await ctx.db.insert('campaigns', { userId: user._id, name, goal, startDate, endDate, platforms, budget, createdAt: Date.now() });
		return { campaignId: String(id) };
	}
});

export const brandKits = query({
	args: { token: v.string() },
	returns: v.array(v.any()),
	handler: async (ctx, { token }) => {
		const user = await requireUser(ctx, token);
		return await ctx.db
			.query('brandKits')
			.withIndex('by_user', (q) => q.eq('userId', user._id))
			.collect();
	}
});

export const upsertBrandKit = mutation({
	args: { token: v.string(), name: v.string(), tone: v.string(), keyMessages: v.array(v.string()), hashtags: v.array(v.string()), colors: v.array(v.string()) },
	returns: v.object({ kitId: v.string() }),
	handler: async (ctx, { token, name, tone, keyMessages, hashtags, colors }) => {
		const user = await requireUser(ctx, token);
		const existing = await ctx.db
			.query('brandKits')
			.withIndex('by_user', (q) => q.eq('userId', user._id))
			.filter((q) => q.eq(q.field('name'), name))
			.collect();
		if (existing.length) {
			await ctx.db.patch(existing[0]._id, { tone, keyMessages, hashtags, colors });
			return { kitId: String(existing[0]._id) };
		}
		const id = await ctx.db.insert('brandKits', { userId: user._id, name, tone, keyMessages, hashtags, colors });
		return { kitId: String(id) };
	}
});

export const visualTemplates = query({
	args: { token: v.string() },
	returns: v.array(v.any()),
	handler: async (ctx, { token }) => {
		const user = await requireUser(ctx, token);
		return await ctx.db
			.query('visualTemplates')
			.withIndex('by_user', (q) => q.eq('userId', user._id))
			.collect();
	}
});

export const seedVisualTemplates = mutation({
	args: { token: v.string() },
	returns: v.null(),
	handler: async (ctx, { token }) => {
		const user = await requireUser(ctx, token);
		const existing = await ctx.db
			.query('visualTemplates')
			.withIndex('by_user', (q) => q.eq('userId', user._id))
			.collect();
		if (existing.length) return;
		const defaults = [
			{ name: 'Whiteboard infographic', kind: 'infographic', platform: 'linkedin', slots: 1, previewColors: ['#1f2937', '#f9fafb'], defaultPrompt: 'Turn these key points into a clean whiteboard explainer image.' },
			{ name: 'Instagram tutorial carousel', kind: 'carousel', platform: 'instagram', slots: 6, previewColors: ['#7c3aed', '#f472b6'], defaultPrompt: 'Create a step-by-step tutorial carousel from this topic.' },
			{ name: 'Quote card', kind: 'quote-card', platform: 'x', slots: 1, previewColors: ['#0f172a', '#38bdf8'], defaultPrompt: 'Turn this line into a bold quote card.' },
			{ name: 'Image slideshow', kind: 'slideshow', platform: 'tiktok', slots: 5, previewColors: ['#f59e0b', '#ef4444'], defaultPrompt: 'Build a punchy 5-frame slideshow with a hook on frame one.' },
			{ name: 'AI avatar video', kind: 'avatar-video', platform: 'youtube', slots: 1, previewColors: ['#111827', '#6366f1'], defaultPrompt: 'Script a 30-second avatar video with generated b-roll cues.' }
		];
		for (const t of defaults) {
			await ctx.db.insert('visualTemplates', { userId: user._id, ...t });
		}
	}
});
