import { defineSchema, defineTable } from 'convex/server';
import { v as s } from 'convex/values';

/**
 * GuruSocial — harmonized enterprise schema.
 *
 * Built from the audited capabilities of the reference stack:
 *  - Ayrshare / PostMCP / SocialAPI.ai / Blotato / PostProxy  -> unified publishing,
 *    profiles, queues, analytics, engagement, webhooks, API keys, MCP tools.
 *  - Buffer / Sprout Social / Agorapulse / Sendible / Metricool -> calendar, composer,
 *    approvals, campaigns, competitors, reports, inbox, best-time suggestions.
 *  - ManyChat / GoHighLevel / Blotato AI                       -> automation flows,
 *    CRM pipelines, brand kits, AI drafts, visual templates.
 *  - Reverse API Engineer (kalil0321)                          -> integration studio
 *    harvest jobs that capture a site's traffic and generate typed API clients.
 */
export default defineSchema({
	users: defineTable({
		email: s.string(),
		name: s.string(),
		passwordHash: s.string(), // sha256(email + ':' + password) via node crypto at signup action
		role: s.union(s.literal('owner'), s.literal('admin'), s.literal('approver'), s.literal('member')),
		createdAt: s.number(),
		plan: s.union(s.literal('free'), s.literal('starter'), s.literal('pro'), s.literal('agency'), s.literal('enterprise')),
		brandVoice: s.optional(s.string()),
		settings: s.optional(
			s.object({
				bestTimeSuggestions: s.optional(s.boolean()),
				weeklyReportEmail: s.optional(s.boolean()),
				llmProvider: s.optional(s.string()),
				llmApiKey: s.optional(s.string()) // stored for optional model-backed generation; never returned to clients
			})
		)
	}).index('by_email', ['email']),

	sessions: defineTable({
		userId: s.id('users'),
		token: s.string(),
		expiresAt: s.number(),
		createdAt: s.number()
	}).index('by_token', ['token']),

	workspaces: defineTable({
		name: s.string(),
		ownerId: s.id('users'),
		plan: s.string(),
		createdAt: s.number()
	}),

	members: defineTable({
		workspaceId: s.id('workspaces'),
		userId: s.id('users'),
		role: s.string()
	}).index('by_workspace', ['workspaceId']),

	// Connected social accounts (Channel drawer / platform connectors)
	profiles: defineTable({
		userId: s.id('users'),
		platform: s.string(), // facebook | instagram | x | linkedin | tiktok | youtube | threads | bluesky | pinterest | telegram | whatsapp | google-business | zalo | slack | discord
		handle: s.string(),
		displayName: s.string(),
		status: s.union(s.literal('connected'), s.literal('expiring'), s.literal('disconnected'), s.literal('needs_action')),
		tokenExpiresAt: s.optional(s.number()),
		scopes: s.array(s.string()),
		credentialsRef: s.optional(s.string()), // never the raw secret; pointer into secret store
		avatarColor: s.string(),
		connectedAt: s.number(),
		lastSyncedAt: s.optional(s.number())
	}).index('by_user', ['userId']).index('by_platform', ['platform']),

	posts: defineTable({
		userId: s.id('users'),
		content: s.string(),
		platforms: s.array(s.string()), // platform slugs selected
		status: s.union(s.literal('draft'), s.literal('pending_approval'), s.literal('approved'), s.literal('scheduled'), s.literal('published'), s.literal('failed'), s.literal('deleted')),
		scheduledAt: s.optional(s.number()),
		publishedAt: s.optional(s.number()),
		mediaUrls: s.array(s.string()),
		mediaType: s.optional(s.union(s.literal('image'), s.literal('video'), s.literal('carousel'), s.literal('story'), s.literal('reel'), s.literal('short'))),
		firstComment: s.optional(s.string()),
		hashtags: s.array(s.string()),
		approvalState: s.optional(s.string()),
		approvalHistory: s.optional(s.array(s.string())),
		generatedBy: s.optional(s.string()), // ai:composer | manual | reverse-studio
		perPlatformResults: s.optional(s.array(s.object({ platform: s.string(), status: s.string(), message: s.optional(s.string()), externalId: s.optional(s.string()), attempts: s.optional(s.number()) }))),
		tags: s.array(s.string()),
		campaignId: s.optional(s.id('campaigns')),
		createdAt: s.number(),
		updatedAt: s.number()
	}).index('by_user', ['userId']).index('by_status', ['status']).index('by_scheduled', ['scheduledAt']).index('by_campaign', ['campaignId']),

	// Recurring queue slots (Buffer-style queue / Blotato schedule slots)
	queueSlots: defineTable({
		userId: s.id('users'),
		platform: s.string(),
		dayOfWeek: s.number(), // 0-6
		timeOfDay: s.string(), // "09:30"
		active: s.boolean()
	}).index('by_user', ['userId']),

	analytics: defineTable({
		userId: s.id('users'),
		postId: s.id('posts'),
		platform: s.string(),
		capturedAt: s.number(),
		impressions: s.number(),
		reach: s.number(),
		likes: s.number(),
		comments: s.number(),
		shares: s.number(),
		saves: s.number(),
		clicks: s.number(),
		followersDelta: s.number(),
		videoViews: s.optional(s.number())
	}).index('by_user', ['userId']).index('by_post', ['postId']).index('by_platform', ['platform']),

	audienceSnapshot: defineTable({
		userId: s.id('users'),
		platform: s.string(),
		capturedAt: s.number(),
		followers: s.number(),
		netChange: s.number(),
		engagementRate: s.number()
	}).index('by_user', ['userId']),

	// Unified inbox: comments + DMs + reviews (SocialAPI.ai / Blotato engagement, Metricool reviews)
	inboxItems: defineTable({
		userId: s.id('users'),
		type: s.union(s.literal('comment'), s.literal('dm'), s.literal('review'), s.literal('mention')),
		platform: s.string(),
		profileHandle: s.string(),
		fromUser: s.string(),
		message: s.string(),
		postId: s.optional(s.id('posts')),
		threadId: s.optional(s.string()),
		status: s.union(s.literal('unread'), s.literal('read'), s.literal('replied'), s.literal('hidden'), s.literal('spam')),
		sentiment: s.optional(s.union(s.literal('positive'), s.literal('neutral'), s.literal('negative'))),
		sentAt: s.number(),
		repliedMessage: s.optional(s.string()),
		repliedAt: s.optional(s.number())
	}).index('by_user', ['userId']).index('by_status', ['status']).index('by_type', ['type']),

	// Automation flows (ManyChat keyword/comment triggers, agent rules)
	automations: defineTable({
		userId: s.id('users'),
		name: s.string(),
		kind: s.union(s.literal('dm_reply'), s.literal('comment_reply'), s.literal('keyword_trigger'), s.literal('content_pipeline'), s.literal('best_time_requeue')),
		platforms: s.array(s.string()),
		trigger: s.object({ type: s.string(), keywords: s.optional(s.array(s.string())), minSentiment: s.optional(s.string()) }),
		responseTemplate: s.string(),
		enabled: s.boolean(),
		usesAi: s.boolean(),
		runs: s.number(),
		createdAt: s.number()
	}).index('by_user', ['userId']),

	agentRuns: defineTable({
		userId: s.id('users'),
		automationId: s.optional(s.id('automations')),
		agent: s.string(), // orchestrator | composer | engagement | analytics | publisher
		input: s.string(),
		output: s.string(),
		status: s.union(s.literal('succeeded'), s.literal('failed'), s.literal('awaiting_approval')),
		createdAt: s.number()
	}).index('by_user', ['userId']),

	campaigns: defineTable({
		userId: s.id('users'),
		name: s.string(),
		goal: s.string(),
		startDate: s.number(),
		endDate: s.number(),
		platforms: s.array(s.string()),
		budget: s.optional(s.number()),
		createdAt: s.number()
	}).index('by_user', ['userId']),

	// CRM (GoHighLevel-style contacts & pipelines)
	contacts: defineTable({
		userId: s.id('users'),
		name: s.string(),
		handle: s.string(),
		platform: s.string(),
		email: s.optional(s.string()),
		phone: s.optional(s.string()),
		stage: s.union(s.literal('lead'), s.literal('engaged'), s.literal('opportunity'), s.literal('customer'), s.literal('advocate'), s.literal('lost')),
		value: s.number(),
		notes: s.string(),
		sourceInboxItemId: s.optional(s.id('inboxItems')),
		createdAt: s.number()
	}).index('by_user', ['userId']).index('by_stage', ['stage']),

	// Brand kits (voice, palette, hashtags) — Blotato/Sendible brand direction
	brandKits: defineTable({
		userId: s.id('users'),
		name: s.string(),
		tone: s.string(),
		keyMessages: s.array(s.string()),
		hashtags: s.array(s.string()),
		colors: s.array(s.string()),
		logoUrl: s.optional(s.string())
	}).index('by_user', ['userId']),

	// Visual templates (whiteboard infographic, carousels, quote cards, slideshows)
	visualTemplates: defineTable({
		userId: s.id('users'),
		name: s.string(),
		kind: s.string(), // infographic | carousel | slideshow | quote-card | tweet-card | avatar-video
		platform: s.string(),
		slots: s.number(),
		previewColors: s.array(s.string()),
		defaultPrompt: s.string()
	}).index('by_user', ['userId']),

	// Developer API keys (Developer portal)
	apiKeys: defineTable({
		userId: s.id('users'),
		name: s.string(),
		keyPrefix: s.string(), // shown in UI, e.g. gs_live_ab12
		keyHash: s.string(), // sha256 of full key; full key shown once at creation
		scopes: s.array(s.string()), // posts:write analytics:read inbox:read crm:write mcp:use
		mode: s.union(s.literal('live'), s.literal('sandbox')),
		lastUsedAt: s.optional(s.number()),
		revokedAt: s.optional(s.number()),
		createdAt: s.number()
	}).index('by_user', ['userId']).index('by_hash', ['keyHash']),

	webhooks: defineTable({
		userId: s.id('users'),
		url: s.string(),
		events: s.array(s.string()), // post.published post.failed inbox.received automation.ran
		active: s.boolean(),
		createdAt: s.number()
	}).index('by_user', ['userId']),

	apiLogs: defineTable({
		userId: s.id('users'),
		method: s.string(),
		path: s.string(),
		status: s.number(),
		durationMs: s.number(),
		platforms: s.optional(s.array(s.string())),
		requestSummary: s.string(),
		createdAt: s.number()
	}).index('by_user', ['userId']),

	competitors: defineTable({
		userId: s.id('users'),
		name: s.string(),
		platform: s.string(),
		handle: s.string(),
		followers: s.number(),
		postsPerWeek: s.number(),
		engagementRate: s.number(),
		createdAt: s.number()
	}).index('by_user', ['userId']),

	// Reverse API Engineer (kalil0321/reverse-api-engineer) harvest jobs
	harvestJobs: defineTable({
		userId: s.id('users'),
		targetUrl: s.string(),
		goal: s.string(),
		mode: s.union(s.literal('agent'), s.literal('manual'), s.literal('engineer')),
		status: s.union(s.literal('queued'), s.literal('capturing'), s.literal('generating'), s.literal('ready'), s.literal('failed')),
		endpointsFound: s.number(),
		generatedClient: s.optional(s.string()), // language of generated client
		keysFound: s.array(s.string()), // credential markers reported by the audit, redacted at rest
		notes: s.string(),
		createdAt: s.number(),
		updatedAt: s.number()
	}).index('by_user', ['userId']),

	// Connector adapters for real platform delivery (configured with user credentials)
	connectors: defineTable({
		userId: s.id('users'),
		platform: s.string(),
		apiKeyRef: s.optional(s.string()),
		appIdRef: s.optional(s.string()),
		mode: s.union(s.literal('native_oauth'), s.literal('user_api_key')),
		enabled: s.boolean(),
		healthStatus: s.string(),
		checkedAt: s.optional(s.number())
	}).index('by_user', ['userId']),

	mcpSessions: defineTable({
		sessionId: s.string(),
		apiKeyId: s.optional(s.id('apiKeys')),
		transport: s.string(),
		lastSeenAt: s.number()
	}).index('by_session', ['sessionId']),

	auditLog: defineTable({
		userId: s.id('users'),
		actor: s.string(),
		action: s.string(),
		target: s.string(),
		detail: s.string(),
		createdAt: s.number()
	}).index('by_user', ['userId']),

	// Super-admin console sessions (EWIN ecosystem operator)
	adminSessions: defineTable({
		token: s.string(),
		email: s.string(),
		createdAt: s.number(),
		expiresAt: s.number()
	}).index('by_token', ['token']),

	// OAuth identities linked to users (Google / GitHub)
	oauthAccounts: defineTable({
		provider: s.string(), // google | github
		providerAccountId: s.string(),
		email: s.string(),
		userId: s.id('users'),
		linkedAt: s.number()
	}).index('by_provider_account', ['provider', 'providerAccountId']).index('by_email', ['email']),

	// EWIN hub connection codes (issued from Settings, verified by E-WIN with HMAC)
	ewinCodes: defineTable({
		userId: s.id('users'),
		codeHash: s.string(),
		email: s.string(),
		expiresAt: s.number(),
		usedAt: s.optional(s.number())
	}).index('by_hash', ['codeHash']),

	// Established EWIN ↔ GuruSocial source links (one-to-one, re-bindable)
	ewinLinks: defineTable({
		sourceUserId: s.id('users'),
		hubUserId: s.string(),
		hubEmail: s.string(),
		status: s.union(s.literal('active'), s.literal('revoked')),
		lastReportAt: s.optional(s.number()),
		linkedAt: s.number(),
		revokedAt: s.optional(s.number())
	}).index('by_source_hub', ['sourceUserId', 'hubUserId']).index('by_hub', ['hubUserId']),

	// Private support/workspace conversations. Participants (users) may read and
	// reply; staff access is a separate, permission-scoped admin path.
	conversations: defineTable({
		subject: s.string(),
		participantIds: s.array(s.id('users')),
		createdById: s.id('users'),
		staffChannel: s.boolean(),
		lastMessagePreview: s.optional(s.string()),
		readAtBy: s.optional(s.any()), // { [userId]: timestamp }
		createdAt: s.number(),
		updatedAt: s.number()
	})
		.index('by_updated', ['updatedAt'])
		.index('by_participant', ['participantIds']),

	messages: defineTable({
		conversationId: s.id('conversations'),
		// Null for staff/operator replies (an operator session is not a user row).
		senderId: s.optional(s.id('users')),
		senderName: s.string(),
		senderKind: s.union(s.literal('user'), s.literal('staff')),
		body: s.string(),
		createdAt: s.number()
	}).index('by_conversation', ['conversationId']),

	// In-app notifications (outbox pattern: event → row → optional channel).
	notifications: defineTable({
		userId: s.id('users'),
		kind: s.string(), // account | security | product | message | admin
		title: s.string(),
		body: s.string(),
		href: s.optional(s.string()),
		readAt: s.optional(s.number()),
		createdAt: s.number()
	})
		.index('by_user', ['userId'])
		.index('by_user_created', ['userId', 'createdAt']),

	notificationPreferences: defineTable({
		userId: s.id('users'),
		inApp: s.boolean(),
		email: s.boolean(),
		product: s.boolean(),
		security: s.boolean()
	}).index('by_user', ['userId']),

	// Privacy-aware activity/audit events. No message bodies or secrets.
	activityEvents: defineTable({
		userId: s.optional(s.id('users')),
		actor: s.string(),
		eventType: s.string(),
		targetType: s.string(),
		targetId: s.string(),
		outcome: s.string(),
		metadata: s.optional(s.any()),
		createdAt: s.number()
	})
		.index('by_created', ['createdAt'])
		.index('by_user', ['userId'])
});
