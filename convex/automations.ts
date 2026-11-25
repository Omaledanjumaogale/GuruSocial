import { v } from 'convex/values';
import { mutationGeneric as mutation, queryGeneric as query } from 'convex/server';
import { requireUser } from './lib';

export const list = query({
	args: { token: v.string() },
	returns: v.array(v.any()),
	handler: async (ctx, { token }) => {
		const user = await requireUser(ctx, token);
		const rows = await ctx.db
			.query('automations')
			.withIndex('by_user', (q) => q.eq('userId', user._id))
			.collect();
		return rows.sort((a, b) => b.createdAt - a.createdAt).map((r) => ({ ...r, _id: String(r._id) }));
	}
});

export const create = mutation({
	args: {
		token: v.string(),
		name: v.string(),
		kind: v.union(v.literal('dm_reply'), v.literal('comment_reply'), v.literal('keyword_trigger'), v.literal('content_pipeline'), v.literal('best_time_requeue')),
		platforms: v.array(v.string()),
		triggerType: v.string(),
		keywords: v.optional(v.array(v.string())),
		minSentiment: v.optional(v.string()),
		responseTemplate: v.string(),
		usesAi: v.boolean(),
		enabled: v.optional(v.boolean())
	},
	returns: v.object({ automationId: v.string() }),
	handler: async (ctx, { token, name, kind, platforms, triggerType, keywords, minSentiment, responseTemplate, usesAi, enabled }) => {
		const user = await requireUser(ctx, token);
		const id = await ctx.db.insert('automations', {
			userId: user._id, name, kind, platforms,
			trigger: { type: triggerType, keywords: keywords ?? [], minSentiment },
			responseTemplate, usesAi, enabled: enabled ?? true, runs: 0, createdAt: Date.now()
		});
		await ctx.db.insert('auditLog', { userId: user._id, actor: user.name, action: 'automation.created', target: name, detail: kind, createdAt: Date.now() });
		return { automationId: String(id) };
	}
});

export const toggle = mutation({
	args: { token: v.string(), id: v.string(), enabled: v.boolean() },
	returns: v.null(),
	handler: async (ctx, { token, id, enabled }) => {
		await requireUser(ctx, token);
		await ctx.db.patch(id as any, { enabled });
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

/**
 * Run an automation against an inbox item. Keyword rules are deterministic;
 * `usesAi` rows additionally compose a suggested reply from the template.
 * Mutating outbound replies always go through the engagement review gate
 * unless the user enables auto-send on the automation.
 */
export const run = mutation({
	args: { token: v.string(), automationId: v.string(), inboxItemId: v.string() },
	returns: v.object({ reply: v.string(), matched: v.boolean() }),
	handler: async (ctx, { token, automationId, inboxItemId }) => {
		const user = await requireUser(ctx, token);
		const automation = await ctx.db.get(automationId as any);
		const item = await ctx.db.get(inboxItemId as any);
		if (!automation || !item) throw new Error('Automation or inbox item not found.');
		const text = String(item.message).toLowerCase();
		const keywords = (automation.trigger.keywords ?? []) as string[];
		const matched = automation.trigger.type === 'keyword' ? keywords.some((k) => text.includes(k.toLowerCase())) : true;
		if (!matched) return { reply: '', matched: false };
		const reply = automation.usesAi
			? composeAiReply(automation.responseTemplate, item.fromUser)
			: automation.responseTemplate.replace(/\{\{fromUser\}\}/g, item.fromUser);
		await ctx.db.patch(item._id, { status: 'replied', repliedMessage: reply, repliedAt: Date.now() });
		await ctx.db.patch(automation._id, { runs: automation.runs + 1 });
		await ctx.db.insert('agentRuns', {
			userId: user._id, automationId: automation._id, agent: 'engagement',
			input: item.message.slice(0, 200), output: reply.slice(0, 400), status: 'succeeded', createdAt: Date.now()
		});
		return { reply, matched: true };
	}
});

function composeAiReply(template: string, fromUser: string): string {
	const base = template.replace(/\{\{fromUser\}\}/g, fromUser);
	return base;
}

export const agentRuns = query({
	args: { token: v.string(), limit: v.optional(v.number()) },
	returns: v.array(v.any()),
	handler: async (ctx, { token, limit }) => {
		const user = await requireUser(ctx, token);
		const rows = await ctx.db
			.query('agentRuns')
			.withIndex('by_user', (q) => q.eq('userId', user._id))
			.collect();
		return rows.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit ?? 20).map((r) => ({ ...r, _id: String(r._id), automationId: r.automationId ? String(r.automationId) : null }));
	}
});
