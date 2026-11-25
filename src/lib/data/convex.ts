/**
 * Convex provider — the production data path. Talks to a deployed Convex
 * backend (set VITE_CONVEX_URL, then run `npx convex deploy`). Function names
 * mirror `src/lib/data/local.ts` and the `convex/` modules.
 */
import { ConvexHttpClient } from 'convex/browser';
import { anyApi } from 'convex/server';
import type { DataProvider } from '../types';

const api = anyApi;

export function createConvexProvider(url: string): DataProvider {
	const client = new ConvexHttpClient(url);

	const wrap = async <T>(fn: () => Promise<T>): Promise<T> => {
		try {
			return await fn();
		} catch (e: any) {
			throw new Error(String(e?.message ?? e).replace(/^Error: /, ''));
		}
	};

	return {
		auth: {
			signUp: (email, name, password) => wrap(() => client.mutation(api.auth.signUp, { email, name, password })),
			signIn: (email, password) => wrap(() => client.mutation(api.auth.signIn, { email, password })),
			signOut: (token) => wrap(() => client.mutation(api.auth.signOut, { token })),
			me: (token) => wrap(() => client.mutation(api.auth.me, { token })),
			updateProfile: (token, patch) => wrap(() => client.mutation(api.auth.updateProfile, { token, ...patch })),
			changePassword: (token, current, next) => wrap(() => client.mutation(api.auth.changePassword, { token, current, next })),
			seedWorkspace: (token) => wrap(() => client.mutation(api.seed.seedWorkspace, { token }))
		},
		profiles: {
			list: (token) => wrap(() => client.query(api.profiles.list, { token })),
			connect: (token, platform, mode, credential, handle, displayName) =>
				wrap(() => client.mutation(api.profiles.connect, { token, platform, mode, credential, handle, displayName })),
			disconnect: (token, profileId) => wrap(() => client.mutation(api.profiles.disconnect, { token, profileId }))
		},
		posts: {
			create: (token, post) =>
				wrap(() =>
					client.mutation(api.posts.create, {
						token, content: post.content, platforms: post.platforms,
						scheduledAt: post.scheduledAt ?? undefined, mediaUrls: post.mediaUrls,
						mediaType: post.mediaType ?? undefined, firstComment: post.firstComment ?? undefined,
						hashtags: post.hashtags, draft: post.draft, pendingApproval: post.pendingApproval,
						campaignId: post.campaignId ?? undefined, tags: post.tags, generatedBy: post.generatedBy
					})
				),
			update: (token, postId, patch) => wrap(() => client.mutation(api.posts.update, { token, postId, ...patch })),
			approve: (token, postId, approve, note) => wrap(() => client.mutation(api.posts.approve, { token, postId, approve, note })),
			remove: (token, postId, deleteOnPlatform) => wrap(() => client.mutation(api.posts.remove, { token, postId, deleteOnPlatform })),
			list: (token, filters) => wrap(() => client.query(api.posts.list, { token, ...filters })),
			get: (token, postId) => wrap(() => client.query(api.posts.get, { token, postId })),
			nextFreeSlot: (token) => wrap(() => client.query(api.posts.nextFreeSlot, { token })),
			queueSlots: (token) => wrap(() => client.query(api.posts.listQueueSlots, { token })),
			upsertQueueSlot: (token, platform, dayOfWeek, timeOfDay, active) =>
				wrap(() => client.mutation(api.posts.upsertQueueSlot, { token, platform, dayOfWeek, timeOfDay, active }))
		},
		analytics: {
			overview: (token, days) => wrap(() => client.query(api.analytics.overview, { token, days })),
			topPosts: (token, metric, limit) => wrap(() => client.query(api.analytics.topPosts, { token, metric: metric as any, limit })),
			audience: (token) => wrap(() => client.query(api.analytics.audience, { token })),
			competitors: (token) => wrap(() => client.query(api.analytics.competitors, { token })),
			addCompetitor: (token, c) => wrap(() => client.mutation(api.analytics.addCompetitor, { token, ...c })),
			removeCompetitor: (token, id) => wrap(() => client.mutation(api.analytics.removeCompetitor, { token, id }))
		},
		inbox: {
			list: (token, filters) => wrap(() => client.query(api.inbox.list, { token, ...filters })),
			mark: (token, id, status) => wrap(() => client.mutation(api.inbox.mark, { token, id, status: status as any })),
			reply: (token, id, message) => wrap(() => client.mutation(api.inbox.reply, { token, id, message })),
			toContact: (token, id) => wrap(() => client.mutation(api.inbox.toContact, { token, id }))
		},
		automations: {
			list: (token) => wrap(() => client.query(api.automations.list, { token })),
			create: (token, a) =>
				wrap(() =>
					client.mutation(api.automations.create, {
						token, name: a.name, kind: a.kind as any, platforms: a.platforms,
						triggerType: a.triggerType, keywords: a.keywords, minSentiment: undefined,
						responseTemplate: a.responseTemplate, usesAi: a.usesAi, enabled: a.enabled
					})
				),
			toggle: (token, id, enabled) => wrap(() => client.mutation(api.automations.toggle, { token, id, enabled })),
			remove: (token, id) => wrap(() => client.mutation(api.automations.remove, { token, id })),
			run: (token, automationId, inboxItemId) => wrap(() => client.mutation(api.automations.run, { token, automationId, inboxItemId })),
			agentRuns: (token, limit) => wrap(() => client.query(api.automations.agentRuns, { token, limit }))
		},
		crm: {
			contacts: (token, stage) => wrap(() => client.query(api.crm.list, { token, stage })),
			upsertContact: (token, c) =>
				wrap(() =>
					client.mutation(api.crm.upsert, {
						token, name: c.name, handle: c.handle, platform: c.platform,
						stage: c.stage as any, value: c.value, notes: c.notes
					})
				),
			moveStage: (token, id, stage) => wrap(() => client.mutation(api.crm.moveStage, { token, id, stage: stage as any })),
			removeContact: (token, id) => wrap(() => client.mutation(api.crm.remove, { token, id })),
			campaigns: (token) => wrap(() => client.query(api.crm.campaigns, { token })),
			createCampaign: (token, c) => wrap(() => client.mutation(api.crm.createCampaign, { token, ...c })),
			brandKits: (token) => wrap(() => client.query(api.crm.brandKits, { token })),
			upsertBrandKit: (token, k) => wrap(() => client.mutation(api.crm.upsertBrandKit, { token, ...k })),
			visualTemplates: (token) => wrap(() => client.query(api.crm.visualTemplates, { token })),
			seedVisualTemplates: (token) => wrap(() => client.mutation(api.crm.seedVisualTemplates, { token }))
		},
		keys: {
			listKeys: (token) => wrap(() => client.query(api.keys.listKeys, { token })),
			createKey: (token, name, scopes, mode) => wrap(() => client.mutation(api.keys.createKey, { token, name, scopes, mode })),
			revokeKey: (token, id) => wrap(() => client.mutation(api.keys.revokeKey, { token, id })),
			webhooks: (token) => wrap(() => client.query(api.keys.webhooks, { token })),
			addWebhook: (token, url, events) => wrap(() => client.mutation(api.keys.addWebhook, { token, url, events })),
			removeWebhook: (token, id) => wrap(() => client.mutation(api.keys.removeWebhook, { token, id })),
			logs: (token, limit) => wrap(() => client.query(api.keys.logs, { token, limit })),
			auditTrail: (token, limit) => wrap(() => client.query(api.keys.auditTrail, { token, limit }))
		},
		ewin: {
			issueCode: (token) => wrap(() => client.mutation(api.ewin.issueCode, { token }))
		},
		ai: {
			generate: (token, req) => wrap(() => client.action(api.ai.generate, { token, topic: req.topic, sourceText: req.sourceText ?? undefined, platforms: req.platforms }))
		},
		media: {
			presignUpload: (token, fileName, contentType) => wrap(() => client.action(api.media.presignUpload, { token, fileName, contentType }))
		},
		harvest: {
			list: (token) => wrap(() => client.query(api.harvest.list, { token })),
			create: (token, j) => wrap(() => client.mutation(api.harvest.create, { token, ...j } as any)),
			updateStatus: (token, id, status, patch) => wrap(() => client.mutation(api.harvest.updateStatus, { token, id, status: status as any, ...patch })),
			remove: (token, id) => wrap(() => client.mutation(api.harvest.remove, { token, id }))
		}
	};
}
