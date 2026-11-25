import { v } from 'convex/values';
import { mutationGeneric as mutation, queryGeneric as query } from 'convex/server';
import { requireUser } from './lib';

export const list = query({
	args: { token: v.string(), type: v.optional(v.string()), status: v.optional(v.string()) },
	returns: v.array(v.any()),
	handler: async (ctx, { token, type, status }) => {
		const user = await requireUser(ctx, token);
		let items = await ctx.db
			.query('inboxItems')
			.withIndex('by_user', (q) => q.eq('userId', user._id))
			.collect();
		if (type) items = items.filter((i) => i.type === type);
		if (status) items = items.filter((i) => i.status === status);
		return items
			.sort((a, b) => b.sentAt - a.sentAt)
			.map((i) => ({ ...i, _id: String(i._id), postId: i.postId ? String(i.postId) : null }));
	}
});

export const mark = mutation({
	args: { token: v.string(), id: v.string(), status: v.union(v.literal('unread'), v.literal('read'), v.literal('replied'), v.literal('hidden'), v.literal('spam')) },
	returns: v.null(),
	handler: async (ctx, { token, id, status }) => {
		await requireUser(ctx, token);
		await ctx.db.patch(id as any, { status });
	}
});

export const reply = mutation({
	args: { token: v.string(), id: v.string(), message: v.string(), viaAutomation: v.optional(v.boolean()) },
	returns: v.null(),
	handler: async (ctx, { token, id, message, viaAutomation }) => {
		const user = await requireUser(ctx, token);
		await ctx.db.patch(id as any, { status: 'replied', repliedMessage: message, repliedAt: Date.now() });
		await ctx.db.insert('auditLog', {
			userId: user._id, actor: viaAutomation ? 'automation' : user.name, action: 'inbox.replied',
			target: id, detail: message.slice(0, 80), createdAt: Date.now()
		});
	}
});

export const toContact = mutation({
	args: { token: v.string(), id: v.string(), stage: v.optional(v.string()) },
	returns: v.object({ contactId: v.string() }),
	handler: async (ctx, { token, id, stage }) => {
		const user = await requireUser(ctx, token);
		const item = await ctx.db.get(id as any);
		if (!item) throw new Error('Inbox item not found.');
		const contactId = await ctx.db.insert('contacts', {
			userId: user._id,
			name: item.fromUser,
			handle: item.profileHandle,
			platform: item.platform,
			stage: (stage ?? 'lead') as any,
			value: 0,
			notes: item.message,
			sourceInboxItemId: item._id,
			createdAt: Date.now()
		});
		return { contactId: String(contactId) };
	}
});
