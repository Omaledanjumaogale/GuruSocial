import { v } from 'convex/values';
import { queryGeneric as query, mutationGeneric as mutation } from 'convex/server';
import { requireUser, type Doc } from './lib';
import { requireAdmin, recordActivity } from './rbac';

/**
 * Private conversations.
 *
 * Access rules enforced here, not in the UI:
 *  - a user may list/read/write only conversations they participate in;
 *  - an operator (super-admin session) may read and reply, and that access is
 *    recorded as an admin activity event;
 *  - message bodies are never copied into activity/audit records.
 */

async function conversationForUser(ctx: any, conversationId: any, userId: any) {
	const convo = await ctx.db.get(conversationId);
	if (!convo) throw new Error('Conversation not found.');
	if (!convo.participantIds.includes(userId)) throw new Error('This conversation is not available to you.');
	return convo;
}

function summarize(ctx: any, convo: Doc<'conversations'>, userId: any) {
	return (async () => {
		const messages = await ctx.db
			.query('messages')
			.withIndex('by_conversation', (q: any) => q.eq('conversationId', convo._id))
			.order('asc')
			.take(500);
		const last = messages[messages.length - 1];
		const readAt = (convo.readAtBy as Record<string, number> | undefined)?.[String(userId)] ?? 0;
		return {
			_id: String(convo._id),
			subject: convo.subject,
			peerName: convo.staffChannel ? 'GuruSocial support' : 'Workspace conversation',
			peerRole: convo.staffChannel ? 'staff' : 'member',
			lastMessage: last?.body ?? '',
			unread: messages.filter((m: any) => String(m.senderId ?? '') !== String(userId) && m.createdAt > readAt).length,
			staffChannel: convo.staffChannel,
			updatedAt: convo.updatedAt
		};
	})();
}

export const conversations = query({
	args: { token: v.string() },
	returns: v.array(v.any()),
	handler: async (ctx, { token }) => {
		const user = await requireUser(ctx, token);
		const rows = await ctx.db
			.query('conversations')
			.withIndex('by_participant', (q) => q.eq('participantIds', user._id))
			.order('desc')
			.take(100);
		return await Promise.all(rows.map((c) => summarize(ctx, c as Doc<'conversations'>, user._id)));
	}
});

export const messages = query({
	args: { token: v.string(), conversationId: v.id('conversations') },
	returns: v.array(v.any()),
	handler: async (ctx, { token, conversationId }) => {
		const user = await requireUser(ctx, token);
		await conversationForUser(ctx, conversationId, user._id);
		const rows = await ctx.db
			.query('messages')
			.withIndex('by_conversation', (q) => q.eq('conversationId', conversationId))
			.order('asc')
			.take(500);
		return rows.map((m) => ({
			_id: String(m._id),
			conversationId: String(m.conversationId),
			senderId: String(m.senderId ?? ''),
			senderName: m.senderName,
			senderKind: m.senderKind,
			body: m.body,
			createdAt: m.createdAt
		}));
	}
});

export const unreadCount = query({
	args: { token: v.string() },
	returns: v.number(),
	handler: async (ctx, { token }) => {
		const user = await requireUser(ctx, token);
		const rows = await ctx.db
			.query('conversations')
			.withIndex('by_participant', (q) => q.eq('participantIds', user._id))
			.take(100);
		let total = 0;
		for (const convo of rows) {
			const readAt = (convo.readAtBy as Record<string, number> | undefined)?.[String(user._id)] ?? 0;
			const msgs = await ctx.db
				.query('messages')
				.withIndex('by_conversation', (q) => q.eq('conversationId', convo._id))
				.order('asc')
				.take(500);
			total += msgs.filter((m) => String(m.senderId ?? '') !== String(user._id) && m.createdAt > readAt).length;
		}
		return total;
	}
});

export const send = mutation({
	args: { token: v.string(), conversationId: v.id('conversations'), body: v.string() },
	returns: v.object({ messageId: v.string() }),
	handler: async (ctx, { token, conversationId, body }) => {
		const user = await requireUser(ctx, token);
		const convo = await conversationForUser(ctx, conversationId, user._id);
		const text = body.trim();
		if (!text) throw new Error('Write a message first.');
		if (text.length > 4000) throw new Error('Messages are limited to 4000 characters.');
		const messageId = await ctx.db.insert('messages', {
			conversationId,
			senderId: user._id,
			senderName: user.name,
			senderKind: 'user',
			body: text,
			createdAt: Date.now()
		});
		await ctx.db.patch(conversationId, {
			updatedAt: Date.now(),
			lastMessagePreview: text.slice(0, 140),
			readAtBy: { ...((convo.readAtBy as Record<string, number>) ?? {}), [String(user._id)]: Date.now() }
		});
		await recordActivity(ctx, {
			userId: user._id,
			actor: user.email,
			eventType: 'message.sent',
			targetType: 'conversation',
			targetId: conversationId
		});
		return { messageId: String(messageId) };
	}
});

export const start = mutation({
	args: { token: v.string(), subject: v.string(), body: v.string() },
	returns: v.object({ conversationId: v.string() }),
	handler: async (ctx, { token, subject, body }) => {
		const user = await requireUser(ctx, token);
		const text = body.trim();
		if (!text) throw new Error('Describe what you need help with.');
		if (text.length > 4000) throw new Error('Messages are limited to 4000 characters.');
		const now = Date.now();
		const conversationId = await ctx.db.insert('conversations', {
			subject: subject.trim() || 'Support request',
			participantIds: [user._id],
			createdById: user._id,
			staffChannel: true,
			lastMessagePreview: text.slice(0, 140),
			readAtBy: { [String(user._id)]: now },
			createdAt: now,
			updatedAt: now
		});
		await ctx.db.insert('messages', {
			conversationId,
			senderId: user._id,
			senderName: user.name,
			senderKind: 'user',
			body: text,
			createdAt: now
		});
		await ctx.db.insert('notifications', {
			userId: user._id,
			kind: 'message',
			title: 'Message sent to support',
			body: 'Your message reached the GuruSocial team. Replies appear in Messages.',
			href: '/dashboard/messages',
			createdAt: now
		});
		await recordActivity(ctx, {
			userId: user._id,
			actor: user.email,
			eventType: 'conversation.started',
			targetType: 'conversation',
			targetId: conversationId
		});
		return { conversationId: String(conversationId) };
	}
});

export const markRead = mutation({
	args: { token: v.string(), conversationId: v.id('conversations') },
	returns: v.null(),
	handler: async (ctx, { token, conversationId }) => {
		const user = await requireUser(ctx, token);
		const convo = await conversationForUser(ctx, conversationId, user._id);
		await ctx.db.patch(conversationId, {
			readAtBy: { ...((convo.readAtBy as Record<string, number>) ?? {}), [String(user._id)]: Date.now() }
		});
	}
});

/* ------------------------- operator (super admin) side ------------------------- */

export const adminList = query({
	args: { adminToken: v.string() },
	returns: v.array(v.any()),
	handler: async (ctx, { adminToken }) => {
		await requireAdmin(ctx, adminToken);
		const rows = await ctx.db.query('conversations').withIndex('by_updated').order('desc').take(100);
		return rows.map((c) => ({
			_id: String(c._id),
			subject: c.subject,
			unread: 0,
			participantIds: c.participantIds.map(String),
			lastMessagePreview: c.lastMessagePreview ?? '',
			staffChannel: c.staffChannel,
			updatedAt: c.updatedAt
		}));
	}
});

export const adminMessages = query({
	args: { adminToken: v.string(), conversationId: v.id('conversations') },
	returns: v.array(v.any()),
	handler: async (ctx, { adminToken, conversationId }) => {
		await requireAdmin(ctx, adminToken);
		const rows = await ctx.db
			.query('messages')
			.withIndex('by_conversation', (q) => q.eq('conversationId', conversationId))
			.order('asc')
			.take(500);
		return rows.map((m) => ({
			_id: String(m._id),
			senderId: String(m.senderId ?? ''),
			senderName: m.senderName,
			senderKind: m.senderKind,
			body: m.body,
			createdAt: m.createdAt
		}));
	}
});

export const adminReply = mutation({
	args: { adminToken: v.string(), conversationId: v.id('conversations'), body: v.string() },
	returns: v.object({ messageId: v.string() }),
	handler: async (ctx, { adminToken, conversationId, body }) => {
		const session = await requireAdmin(ctx, adminToken);
		const convo = await ctx.db.get(conversationId);
		if (!convo) throw new Error('Conversation not found.');
		const text = body.trim();
		if (!text) throw new Error('Write a reply first.');
		if (text.length > 4000) throw new Error('Messages are limited to 4000 characters.');
		const messageId = await ctx.db.insert('messages', {
			conversationId,
			senderName: 'GuruSocial support',
			senderKind: 'staff',
			body: text,
			createdAt: Date.now()
		});
		await ctx.db.patch(conversationId, {
			updatedAt: Date.now(),
			lastMessagePreview: text.slice(0, 140)
		});
		for (const participantId of convo.participantIds) {
			await ctx.db.insert('notifications', {
				userId: participantId,
				kind: 'message',
				title: 'New reply from GuruSocial support',
				body: text.slice(0, 140),
				href: '/dashboard/messages',
				createdAt: Date.now()
			});
		}
		await recordActivity(ctx, {
			actor: session.email,
			eventType: 'admin.messaging.reply',
			targetType: 'conversation',
			targetId: conversationId
		});
		return { messageId: String(messageId) };
	}
});

/** Operator-initiated conversation with a user (permission-scoped). */
export const adminStart = mutation({
	args: { adminToken: v.string(), userId: v.id('users'), subject: v.string(), body: v.string() },
	returns: v.object({ conversationId: v.string() }),
	handler: async (ctx, { adminToken, userId, subject, body }) => {
		const session = await requireAdmin(ctx, adminToken);
		const user = await ctx.db.get(userId);
		if (!user) throw new Error('User not found.');
		const text = body.trim();
		if (!text) throw new Error('Write a message first.');
		const now = Date.now();
		const conversationId = await ctx.db.insert('conversations', {
			subject: subject.trim() || 'Message from GuruSocial',
			participantIds: [userId],
			createdById: userId,
			staffChannel: true,
			lastMessagePreview: text.slice(0, 140),
			readAtBy: {},
			createdAt: now,
			updatedAt: now
		});
		await ctx.db.insert('messages', {
			conversationId,
			senderName: 'GuruSocial support',
			senderKind: 'staff',
			body: text,
			createdAt: now
		});
		await ctx.db.insert('notifications', {
			userId,
			kind: 'message',
			title: 'Message from GuruSocial',
			body: text.slice(0, 140),
			href: '/dashboard/messages',
			createdAt: now
		});
		await recordActivity(ctx, {
			actor: session.email,
			eventType: 'admin.messaging.start',
			targetType: 'user',
			targetId: userId
		});
		return { conversationId: String(conversationId) };
	}
});
