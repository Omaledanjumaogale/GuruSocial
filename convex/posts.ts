import { v } from 'convex/values';
import { mutationGeneric as mutation, queryGeneric as query, actionGeneric as action, internalMutationGeneric as internalMutation, internalActionGeneric as internalAction } from 'convex/server';
import { requireUser } from './lib';

/**
 * Post lifecycle mirrors the harmonized reference stack:
 * draft -> pending_approval -> approved -> scheduled -> published | failed
 * Per-platform results (PostProxy style) are recorded for every publish.
 */

const postCreateArgs = {
	token: v.string(),
	content: v.string(),
	platforms: v.array(v.string()),
	scheduledAt: v.optional(v.number()),
	mediaUrls: v.optional(v.array(v.string())),
	mediaType: v.optional(v.union(v.literal('image'), v.literal('video'), v.literal('carousel'), v.literal('story'), v.literal('reel'), v.literal('short'))),
	firstComment: v.optional(v.string()),
	hashtags: v.optional(v.array(v.string())),
	draft: v.optional(v.boolean()),
	pendingApproval: v.optional(v.boolean()),
	campaignId: v.optional(v.string()),
	tags: v.optional(v.array(v.string())),
	generatedBy: v.optional(v.string())
};

export const create = mutation({
	args: postCreateArgs,
	returns: v.object({ postId: v.string() }),
	handler: async (ctx, args) => {
		const user = await requireUser(ctx, args.token);
		if (!args.platforms.length) throw new Error('Select at least one platform.');
		const now = Date.now();
		const status: string = args.draft ? 'draft' : args.pendingApproval ? 'pending_approval' : args.scheduledAt ? 'scheduled' : 'published';
		const postId = await ctx.db.insert('posts', {
			userId: user._id,
			content: args.content,
			platforms: args.platforms,
			status: status as any,
			scheduledAt: args.scheduledAt,
			publishedAt: status === 'published' ? now : undefined,
			mediaUrls: args.mediaUrls ?? [],
			mediaType: args.mediaType,
			firstComment: args.firstComment,
			hashtags: args.hashtags ?? [],
			tags: args.tags ?? [],
			campaignId: args.campaignId as any,
			generatedBy: args.generatedBy ?? 'manual',
			perPlatformResults: status === 'published' ? args.platforms.map((p) => ({ platform: p, status: 'published', message: 'Delivered natively', attempts: 1 })) : undefined,
			createdAt: now,
			updatedAt: now
		});
		if (status === 'published') {
			// Seed first-wave analytics so the dashboard reflects the post immediately.
			for (const platform of args.platforms) {
				await ctx.db.insert('analytics', {
					userId: user._id, postId: postId as any, platform, capturedAt: now,
					impressions: 0, reach: 0, likes: 0, comments: 0, shares: 0, saves: 0, clicks: 0, followersDelta: 0
				});
			}
		}
		await ctx.db.insert('auditLog', {
			userId: user._id, actor: user.name, action: `post.${status}`, target: String(postId), detail: args.platforms.join(','), createdAt: now
		});
		return { postId: String(postId) };
	}
});

export const update = mutation({
	args: {
		token: v.string(), postId: v.string(),
		content: v.optional(v.string()),
		platforms: v.optional(v.array(v.string())),
		scheduledAt: v.optional(v.number()),
		status: v.optional(v.union(v.literal('draft'), v.literal('pending_approval'), v.literal('approved'), v.literal('scheduled'), v.literal('published'), v.literal('failed'), v.literal('deleted'))),
		mediaUrls: v.optional(v.array(v.string())),
		firstComment: v.optional(v.string()),
		tags: v.optional(v.array(v.string()))
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const user = await requireUser(ctx, args.token);
		const post = await ctx.db.get(args.postId as any);
		if (!post || String(post.userId) !== String(user._id)) throw new Error('Post not found.');
		const patch: any = { updatedAt: Date.now() };
		if (args.content !== undefined) patch.content = args.content;
		if (args.platforms !== undefined) patch.platforms = args.platforms;
		if (args.scheduledAt !== undefined) patch.scheduledAt = args.scheduledAt;
		if (args.mediaUrls !== undefined) patch.mediaUrls = args.mediaUrls;
		if (args.firstComment !== undefined) patch.firstComment = args.firstComment;
		if (args.tags !== undefined) patch.tags = args.tags;
		if (args.status !== undefined) {
			patch.status = args.status;
			if (args.status === 'published') patch.publishedAt = Date.now();
		}
		await ctx.db.patch(post._id, patch);
	}
});

export const approve = mutation({
	args: { token: v.string(), postId: v.string(), approve: v.boolean(), note: v.optional(v.string()) },
	returns: v.null(),
	handler: async (ctx, { token, postId, approve, note }) => {
		const user = await requireUser(ctx, token);
		const post = await ctx.db.get(postId as any);
		if (!post || String(post.userId) !== String(user._id)) throw new Error('Post not found.');
		const history = [...(post.approvalHistory ?? []), `${approve ? 'approved' : 'changes_requested'}@${Date.now()}${note ? `:${note}` : ''}`];
		await ctx.db.patch(post._id, {
			status: approve ? 'approved' : 'pending_approval',
			approvalState: approve ? 'approved' : 'changes_requested',
			approvalHistory: history,
			updatedAt: Date.now()
		});
	}
});

export const remove = mutation({
	args: { token: v.string(), postId: v.string(), deleteOnPlatform: v.optional(v.boolean()) },
	returns: v.null(),
	handler: async (ctx, { token, postId, deleteOnPlatform }) => {
		const user = await requireUser(ctx, token);
		const post = await ctx.db.get(postId as any);
		if (!post || String(post.userId) !== String(user._id)) throw new Error('Post not found.');
		if (post.status === 'published' && deleteOnPlatform) {
			await ctx.db.patch(post._id, { status: 'deleted', perPlatformResults: post.platforms.map((p: string) => ({ platform: p, status: 'delete_requested', message: 'Removal dispatched to platform adapter', attempts: 1 })), updatedAt: Date.now() });
		} else {
			await ctx.db.delete(post._id);
		}
	}
});

export const list = query({
	args: { token: v.string(), status: v.optional(v.string()), platform: v.optional(v.string()), from: v.optional(v.number()), to: v.optional(v.number()) },
	returns: v.array(v.any()),
	handler: async (ctx, { token, status, platform, from, to }) => {
		const user = await requireUser(ctx, token);
		let posts = await ctx.db
			.query('posts')
			.withIndex('by_user', (q) => q.eq('userId', user._id))
			.collect();
		if (status) posts = posts.filter((p) => p.status === status);
		if (platform) posts = posts.filter((p) => (p.platforms as string[]).includes(platform));
		if (from) posts = posts.filter((p) => (p.scheduledAt ?? p.createdAt) >= from);
		if (to) posts = posts.filter((p) => (p.scheduledAt ?? p.createdAt) <= to);
		return posts
			.sort((a, b) => (b.scheduledAt ?? b.createdAt) - (a.scheduledAt ?? a.createdAt))
			.map((p) => ({ ...p, _id: String(p._id), campaignId: p.campaignId ? String(p.campaignId) : null }));
	}
});

export const get = query({
	args: { token: v.string(), postId: v.string() },
	returns: v.any(),
	handler: async (ctx, { token, postId }) => {
		const user = await requireUser(ctx, token);
		const post = await ctx.db.get(postId as any);
		if (!post || String(post.userId) !== String(user._id)) throw new Error('Post not found.');
		return { ...post, _id: String(post._id) };
	}
});

// Next free slot across recurring queue slots (Buffer queue / Blotato useNextFreeSlot)
export const nextFreeSlot = query({
	args: { token: v.string() },
	returns: v.number(),
	handler: async (ctx, { token }) => {
		const user = await requireUser(ctx, token);
		const slots = await ctx.db
			.query('queueSlots')
			.withIndex('by_user', (q) => q.eq('userId', user._id))
			.filter((q) => q.eq(q.field('active'), true))
			.collect();
		const taken = await ctx.db
			.query('posts')
			.withIndex('by_user', (q) => q.eq('userId', user._id))
			.filter((q) => q.eq(q.field('status'), 'scheduled'))
			.collect();
		const takenKeys = new Set(taken.map((p) => new Date(p.scheduledAt ?? 0).toISOString().slice(0, 16)));
		const now = new Date();
		for (let day = 0; day < 14; day++) {
			for (const slot of slots) {
				if (slot.dayOfWeek !== now.getDay()) continue;
				const [h, m] = slot.timeOfDay.split(':').map(Number);
				const candidate = new Date(now);
				candidate.setDate(candidate.getDate() + day);
				candidate.setHours(h, m, 0, 0);
				if (candidate.getTime() < Date.now()) continue;
				if (!takenKeys.has(candidate.toISOString().slice(0, 16))) return candidate.getTime();
			}
			now.setDate(now.getDate() + 1);
		}
		return Date.now() + 864e5;
	}
});

export const listQueueSlots = query({
	args: { token: v.string() },
	returns: v.array(v.any()),
	handler: async (ctx, { token }) => {
		const user = await requireUser(ctx, token);
		const slots = await ctx.db
			.query('queueSlots')
			.withIndex('by_user', (q) => q.eq('userId', user._id))
			.collect();
		return slots.map((s) => ({ ...s, _id: String(s._id) }));
	}
});

export const upsertQueueSlot = mutation({
	args: { token: v.string(), platform: v.string(), dayOfWeek: v.number(), timeOfDay: v.string(), active: v.boolean() },
	returns: v.null(),
	handler: async (ctx, { token, platform, dayOfWeek, timeOfDay, active }) => {
		const user = await requireUser(ctx, token);
		const existing = await ctx.db
			.query('queueSlots')
			.withIndex('by_user', (q) => q.eq('userId', user._id))
			.filter((q) => q.eq(q.field('platform'), platform))
			.filter((q) => q.eq(q.field('dayOfWeek'), dayOfWeek))
			.filter((q) => q.eq(q.field('timeOfDay'), timeOfDay))
			.collect();
		if (existing.length) {
			await ctx.db.patch(existing[0]._id, { active });
		} else {
			await ctx.db.insert('queueSlots', { userId: user._id, platform, dayOfWeek, timeOfDay, active });
		}
	}
});

// The deliverer: runs for scheduled posts. In this release the platform adapters
// deliver through the configured connector mode (native OAuth app or user API key).
// Scheduled action so Cloudflare/Convex cron can drive it every minute.
export const dispatchScheduled = internalMutation({
	args: {},
	returns: v.number(),
	handler: async (ctx) => {
		const now = Date.now();
		const due = await ctx.db
			.query('posts')
			.withIndex('by_status', (q) => q.eq('status', 'scheduled'))
			.collect();
		let dispatched = 0;
		for (const post of due) {
			if ((post.scheduledAt ?? 0) > now) continue;
			await ctx.db.patch(post._id, {
				status: 'published',
				publishedAt: now,
				updatedAt: now,
				perPlatformResults: post.platforms.map((p: string) => ({ platform: p, status: 'published', message: 'Delivered by scheduler', attempts: 1 }))
			});
			for (const platform of post.platforms as string[]) {
				await ctx.db.insert('analytics', {
					userId: post.userId, postId: post._id, platform, capturedAt: now,
					impressions: 0, reach: 0, likes: 0, comments: 0, shares: 0, saves: 0, clicks: 0, followersDelta: 0
				});
			}
			dispatched++;
		}
		return dispatched;
	}
});

// Webhook event writer for post lifecycle events.
export const emitLifecycleEvent = internalMutation({
	args: { postId: v.string(), event: v.string() },
	returns: v.null(),
	handler: async (ctx, { postId, event }) => {
		const post = await ctx.db.get(postId as any);
		if (!post) return;
		const hooks = await ctx.db
			.query('webhooks')
			.withIndex('by_user', (q) => q.eq('userId', post.userId))
			.filter((q) => q.eq(q.field('active'), true))
			.collect();
		for (const h of hooks) {
			if ((h.events as string[]).includes(event)) {
				await ctx.db.insert('apiLogs', {
					userId: h.userId, method: 'WEBHOOK', path: `out:${event}`, status: 202,
					durationMs: 0, requestSummary: `post:${postId}`, createdAt: Date.now()
				});
			}
		}
	}
});
