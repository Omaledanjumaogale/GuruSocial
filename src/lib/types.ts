// Shared types for the GuruSocial frontend data layer.
export interface User {
	email: string;
	name: string;
	plan: string;
	role: string;
	brandVoice: string;
	settings?: Record<string, unknown>;
}

export interface Profile {
	_id: string;
	platform: string;
	handle: string;
	displayName: string;
	status: 'connected' | 'expiring' | 'disconnected' | 'needs_action';
	scopes: string[];
	connectedAt: number;
	avatarColor: string;
	tokenExpiresAt?: number | null;
}

export interface Post {
	_id: string;
	content: string;
	platforms: string[];
	status: 'draft' | 'pending_approval' | 'approved' | 'scheduled' | 'published' | 'failed' | 'deleted';
	scheduledAt?: number | null;
	publishedAt?: number | null;
	mediaUrls: string[];
	mediaType?: string | null;
	firstComment?: string | null;
	hashtags: string[];
	tags: string[];
	generatedBy?: string | null;
	perPlatformResults?: Array<{ platform: string; status: string; message?: string; attempts?: number }> | null;
	approvalState?: string | null;
	campaignId?: string | null;
	createdAt: number;
	updatedAt: number;
}

export interface AnalyticsRow {
	_id?: string;
	platform: string;
	postId?: string;
	capturedAt: number;
	impressions: number;
	reach: number;
	likes: number;
	comments: number;
	shares: number;
	saves: number;
	clicks: number;
	followersDelta: number;
}

export interface AnalyticsOverview {
	totals: { impressions: number; reach: number; likes: number; comments: number; shares: number; saves: number; clicks: number; followersDelta: number };
	byPlatform: Array<{ platform: string; impressions: number; reach: number; engagement: number; posts: number }>;
	byDay: Array<{ day: string; impressions: number; engagement: number }>;
	followers: Record<string, { followers: number }>;
	topPostIds: string[];
}

export interface InboxItem {
	_id: string;
	type: 'comment' | 'dm' | 'review' | 'mention';
	platform: string;
	profileHandle: string;
	fromUser: string;
	message: string;
	postId?: string | null;
	status: 'unread' | 'read' | 'replied' | 'hidden' | 'spam';
	sentAt: number;
	repliedMessage?: string | null;
	repliedAt?: number | null;
}

export interface Automation {
	_id: string;
	name: string;
	kind: string;
	platforms: string[];
	trigger: { type: string; keywords?: string[] };
	responseTemplate: string;
	usesAi: boolean;
	enabled: boolean;
	runs: number;
	createdAt: number;
}

export interface AgentRun {
	_id: string;
	agent: string;
	input: string;
	output: string;
	status: string;
	createdAt: number;
}

export interface Contact {
	_id: string;
	name: string;
	handle: string;
	platform: string;
	email?: string | null;
	phone?: string | null;
	stage: 'lead' | 'engaged' | 'opportunity' | 'customer' | 'advocate' | 'lost';
	value: number;
	notes: string;
	createdAt: number;
}

export interface Campaign {
	_id: string;
	name: string;
	goal: string;
	startDate: number;
	endDate: number;
	platforms: string[];
	budget?: number | null;
}

export interface BrandKit {
	_id: string;
	name: string;
	tone: string;
	keyMessages: string[];
	hashtags: string[];
	colors: string[];
}

export interface VisualTemplate {
	_id: string;
	name: string;
	kind: string;
	platform: string;
	slots: number;
	previewColors: string[];
	defaultPrompt: string;
}

export interface ApiKey {
	_id: string;
	name: string;
	keyPrefix: string;
	scopes: string[];
	mode: 'live' | 'sandbox';
	revokedAt?: number | null;
	lastUsedAt?: number | null;
	createdAt: number;
}

export interface Webhook {
	_id: string;
	url: string;
	events: string[];
	active: boolean;
}

export interface ApiLog {
	_id: string;
	method: string;
	path: string;
	status: number;
	durationMs: number;
	requestSummary: string;
	createdAt: number;
}

export interface AuditEntry {
	_id: string;
	actor: string;
	action: string;
	target: string;
	detail: string;
	createdAt: number;
}

export interface HarvestJob {
	_id: string;
	targetUrl: string;
	goal: string;
	mode: 'agent' | 'manual' | 'engineer';
	status: 'queued' | 'capturing' | 'generating' | 'ready' | 'failed';
	endpointsFound: number;
	generatedClient?: string | null;
	keysFound: string[];
	notes: string;
	createdAt: number;
	updatedAt: number;
}

export interface QueueSlot {
	_id: string;
	platform: string;
	dayOfWeek: number;
	timeOfDay: string;
	active: boolean;
}

export interface ConversationSummary {
	_id: string;
	subject: string;
	peerName: string;
	peerRole: string;
	lastMessage: string;
	unread: number;
	staffChannel: boolean;
	updatedAt: number;
}

export interface ChatMessage {
	_id: string;
	conversationId: string;
	senderId: string;
	senderName: string;
	senderKind: 'user' | 'staff';
	body: string;
	createdAt: number;
}

export interface NotificationRow {
	_id: string;
	kind: string;
	title: string;
	body: string;
	href?: string | null;
	readAt?: number | null;
	createdAt: number;
}

export interface NotificationPrefs {
	inApp: boolean;
	email: boolean;
	product: boolean;
	security: boolean;
}

export interface EwinStatus {
	linked: boolean;
	hubUserId: string | null;
	hubEmail: string | null;
	linkedAt: number | null;
	lastReportAt: number | null;
	syncedAt: number | null;
	history: Array<{
		status: string;
		hubUserId: string;
		hubEmail: string;
		linkedAt: number;
		lastReportAt: number | null;
	}>;
}

export interface DataProvider {
	auth: {
		signUp(email: string, name: string, password: string): Promise<{ token: string; userId: string; user?: User }>;
		signIn(email: string, password: string): Promise<{ token: string; userId: string; user?: User }>;
		signOut(token: string): Promise<void>;
		me(token: string): Promise<User>;
		updateProfile(token: string, patch: Partial<{ name: string; brandVoice: string; bestTimeSuggestions: boolean; weeklyReportEmail: boolean }>): Promise<void>;
		changePassword(token: string, current: string, next: string): Promise<void>;
		seedWorkspace(token: string): Promise<void>;
	};
	profiles: {
		list(token: string): Promise<Profile[]>;
		connect(token: string, platform: string, mode: 'native_oauth' | 'user_api_key', credential?: string, handle?: string, displayName?: string): Promise<{ profileId: string }>;
		disconnect(token: string, profileId: string): Promise<void>;
	};
	posts: {
		create(token: string, post: Partial<Post> & { content: string; platforms: string[]; draft?: boolean; pendingApproval?: boolean; hashtags?: string[]; generatedBy?: string; firstComment?: string | null; mediaType?: string | null; mediaUrls?: string[]; tags?: string[]; campaignId?: string | null; scheduledAt?: number | null }): Promise<{ postId: string }>;
		update(token: string, postId: string, patch: Partial<Post>): Promise<void>;
		approve(token: string, postId: string, approve: boolean, note?: string): Promise<void>;
		remove(token: string, postId: string, deleteOnPlatform?: boolean): Promise<void>;
		list(token: string, filters?: { status?: string; platform?: string; from?: number; to?: number }): Promise<Post[]>;
		get(token: string, postId: string): Promise<Post | null>;
		nextFreeSlot(token: string): Promise<number>;
		queueSlots(token: string): Promise<QueueSlot[]>;
		upsertQueueSlot(token: string, platform: string, dayOfWeek: number, timeOfDay: string, active: boolean): Promise<void>;
	};
	analytics: {
		overview(token: string, days?: number): Promise<AnalyticsOverview>;
		topPosts(token: string, metric?: string, limit?: number): Promise<Array<{ _id: string; content: string; platforms: string[]; metricValue: number }>>;
		audience(token: string): Promise<Array<{ platform: string; capturedAt: number; followers: number; netChange: number; engagementRate: number }>>;
		competitors(token: string): Promise<Array<{ _id: string; name: string; platform: string; handle: string; followers: number; postsPerWeek: number; engagementRate: number }>>;
		addCompetitor(token: string, c: { name: string; platform: string; handle: string; followers: number; postsPerWeek: number; engagementRate: number }): Promise<void>;
		removeCompetitor(token: string, id: string): Promise<void>;
	};
	inbox: {
		list(token: string, filters?: { type?: string; status?: string }): Promise<InboxItem[]>;
		mark(token: string, id: string, status: string): Promise<void>;
		reply(token: string, id: string, message: string): Promise<void>;
		toContact(token: string, id: string): Promise<{ contactId: string }>;
	};
	automations: {
		list(token: string): Promise<Automation[]>;
		create(token: string, a: { name: string; kind: string; platforms: string[]; triggerType: string; keywords?: string[]; responseTemplate: string; usesAi: boolean; enabled?: boolean }): Promise<{ automationId: string }>;
		toggle(token: string, id: string, enabled: boolean): Promise<void>;
		remove(token: string, id: string): Promise<void>;
		run(token: string, automationId: string, inboxItemId: string): Promise<{ reply: string; matched: boolean }>;
		agentRuns(token: string, limit?: number): Promise<AgentRun[]>;
	};
	crm: {
		contacts(token: string, stage?: string): Promise<Contact[]>;
		upsertContact(token: string, c: { name: string; handle: string; platform: string; stage: string; value: number; notes?: string }): Promise<{ contactId: string }>;
		moveStage(token: string, id: string, stage: string): Promise<void>;
		removeContact(token: string, id: string): Promise<void>;
		campaigns(token: string): Promise<Campaign[]>;
		createCampaign(token: string, c: { name: string; goal: string; startDate: number; endDate: number; platforms: string[]; budget?: number }): Promise<{ campaignId: string }>;
		brandKits(token: string): Promise<BrandKit[]>;
		upsertBrandKit(token: string, k: { name: string; tone: string; keyMessages: string[]; hashtags: string[]; colors: string[] }): Promise<void>;
		visualTemplates(token: string): Promise<VisualTemplate[]>;
		seedVisualTemplates(token: string): Promise<void>;
	};
	keys: {
		listKeys(token: string): Promise<ApiKey[]>;
		createKey(token: string, name: string, scopes: string[], mode: 'live' | 'sandbox'): Promise<{ key: string; prefix: string }>;
		revokeKey(token: string, id: string): Promise<void>;
		webhooks(token: string): Promise<Webhook[]>;
		addWebhook(token: string, url: string, events: string[]): Promise<void>;
		removeWebhook(token: string, id: string): Promise<void>;
		logs(token: string, limit?: number): Promise<ApiLog[]>;
		auditTrail(token: string, limit?: number): Promise<AuditEntry[]>;
	};
	ewin: {
		issueCode(token: string): Promise<{ code: string; expiresAt: number }>;
		status(token: string): Promise<EwinStatus>;
		disconnect(token: string): Promise<number>;
	};
	ai: {
		generate(token: string, req: { topic: string; sourceText?: string; platforms: string[] }): Promise<Array<{ platform: string; content: string; hashtags: string[]; warnings: string[]; charCount: number; charLimit: number }>>;
	};
	media: {
		presignUpload(token: string, fileName: string, contentType: string): Promise<{ uploadUrl: string; publicUrl: string; key: string }>;
		registerAsset(token: string, a: { name: string; contentType: string; size: number; url: string }): Promise<string>;
		listAssets(token: string): Promise<Array<{ _id: string; name: string; contentType: string; size: number; url: string; createdAt: number }>>;
		removeAsset(token: string, id: string): Promise<void>;
		approvals(token: string): Promise<Array<{ _id: string; content: string; platforms: string[]; status: string; scheduledAt: number | null; createdAt: number }>>;
		decideApproval(token: string, postId: string, decision: 'approved' | 'rejected' | 'changes_requested', note?: string): Promise<void>;
		listening(token: string): Promise<Array<{ _id: string; keyword: string; platforms: string[]; mentions: number; velocity: number; sentiment: string; active: boolean }>>;
		addKeyword(token: string, keyword: string, platforms: string[]): Promise<string>;
		removeKeyword(token: string, id: string): Promise<void>;
	};
	harvest: {
		list(token: string): Promise<HarvestJob[]>;
		create(token: string, j: { targetUrl: string; goal: string; mode: string }): Promise<{ jobId: string }>;
		updateStatus(token: string, id: string, status: string, patch?: Partial<HarvestJob>): Promise<void>;
		remove(token: string, id: string): Promise<void>;
	};
	messaging: {
		conversations(token: string): Promise<ConversationSummary[]>;
		messages(token: string, conversationId: string): Promise<ChatMessage[]>;
		send(token: string, conversationId: string, body: string): Promise<{ messageId: string }>;
		start(token: string, subject: string, body: string): Promise<{ conversationId: string }>;
		unreadCount(token: string): Promise<number>;
		markRead(token: string, conversationId: string): Promise<void>;
	};
	notifications: {
		list(token: string, limit?: number): Promise<NotificationRow[]>;
		unreadCount(token: string): Promise<number>;
		markRead(token: string, id: string): Promise<void>;
		markAllRead(token: string): Promise<void>;
		preferences(token: string): Promise<NotificationPrefs>;
		savePreferences(token: string, prefs: NotificationPrefs): Promise<void>;
	};
}
