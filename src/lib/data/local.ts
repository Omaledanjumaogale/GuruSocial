/**
 * Local demo provider — a complete, in-browser implementation of the
 * GuruSocial data model. Used automatically when no Convex deployment URL is
 * configured, so the entire product renders and functions before you attach a
 * backend. Mirrors the Convex schema 1:1 and is seeded with the same demo
 * dataset as `convex/seed.ts`.
 */
import type { DataProvider } from '../types';

const DB_KEY = 'gurusocial.db.v1';
const SESSION_KEY = 'gurusocial.session.v1';

type Row = { _id: string } & Record<string, any>;

interface LocalDb {
	users: Row[];
	sessions: Row[];
	profiles: Row[];
	posts: Row[];
	queueSlots: Row[];
	analytics: Row[];
	audienceSnapshot: Row[];
	inboxItems: Row[];
	automations: Row[];
	agentRuns: Row[];
	campaigns: Row[];
	contacts: Row[];
	brandKits: Row[];
	visualTemplates: Row[];
	apiKeys: Row[];
	webhooks: Row[];
	apiLogs: Row[];
	competitors: Row[];
	harvestJobs: Row[];
	auditLog: Row[];
}

let uidCounter = 0;
function uid(): string {
	return `local_${Date.now().toString(36)}_${(uidCounter++).toString(36)}`;
}

function hash32(input: string): string {
	let h = 0xdeadbeef;
	for (let i = 0; i < input.length; i++) {
		h = Math.imul(h ^ input.charCodeAt(i), 2654435761);
	}
	h ^= h >>> 16;
	return (h >>> 0).toString(16);
}

function load(): LocalDb {
	const raw = localStorage.getItem(DB_KEY);
	if (raw) return JSON.parse(raw);
	return {
		users: [], sessions: [], profiles: [], posts: [], queueSlots: [], analytics: [],
		audienceSnapshot: [], inboxItems: [], automations: [], agentRuns: [], campaigns: [],
		contacts: [], brandKits: [], visualTemplates: [], apiKeys: [], webhooks: [], apiLogs: [],
		competitors: [], harvestJobs: [], auditLog: []
	};
}

function save(db: LocalDb) {
	localStorage.setItem(DB_KEY, JSON.stringify(db));
}

export const localProvider: DataProvider = {
	auth: {
		async signUp(email, name, password) {
			const db = load();
			const e = email.trim().toLowerCase();
			if (db.users.some((u) => u.email === e)) throw new Error('An account with this email already exists.');
			const user: Row = { _id: uid(), email: e, name: name.trim() || e.split('@')[0], passwordHash: hash32(e + ':' + password), role: 'owner', plan: 'free', createdAt: Date.now(), brandVoice: '' };
			db.users.push(user);
			db.brandKits.push({ _id: uid(), userId: user._id, name: 'Default brand', tone: 'confident, plain-spoken, helpful', keyMessages: [], hashtags: [], colors: ['#6366f1', '#22c55e', '#f59e0b'] });
			const token = uid() + uid();
			db.sessions.push({ _id: uid(), userId: user._id, token, expiresAt: Date.now() + 30 * 864e5, createdAt: Date.now() });
			save(db);
			return { token, userId: user._id };
		},
		async signIn(email, password) {
			const db = load();
			const e = email.trim().toLowerCase();
			const user = db.users.find((u) => u.email === e);
			if (!user || user.passwordHash !== hash32(e + ':' + password)) throw new Error('Incorrect email or password.');
			const token = uid() + uid();
			db.sessions.push({ _id: uid(), userId: user._id, token, expiresAt: Date.now() + 30 * 864e5, createdAt: Date.now() });
			save(db);
			return { token, userId: user._id };
		},
		async signOut(token) {
			const db = load();
			db.sessions = db.sessions.filter((s) => s.token !== token);
			save(db);
		},
		async me(token) {
			const db = load();
			const s = db.sessions.find((x) => x.token === token);
			const u = s && db.users.find((x) => x._id === s.userId);
			if (!u) throw new Error('Unauthorized');
			return { email: u.email, name: u.name, plan: u.plan, role: u.role, brandVoice: u.brandVoice ?? '' };
		},
		async updateProfile(token, patch) {
			const db = load();
			const s = db.sessions.find((x) => x.token === token);
			const u = s && db.users.find((x) => x._id === s.userId);
			if (!u) throw new Error('Unauthorized');
			Object.assign(u, patch);
			save(db);
		},
		async changePassword(token, current, next) {
			const db = load();
			const s = db.sessions.find((x) => x.token === token);
			const u = s && db.users.find((x) => x._id === s.userId);
			if (!u) throw new Error('Unauthorized');
			if (u.passwordHash !== hash32(u.email + ':' + current)) throw new Error('Current password is incorrect.');
			if (next.length < 8) throw new Error('New password must be at least 8 characters.');
			u.passwordHash = hash32(u.email + ':' + next);
			save(db);
		},
		async seedWorkspace(token) {
			const db = load();
			const s = db.sessions.find((x) => x.token === token);
			const u = s && db.users.find((x) => x._id === s.userId);
			if (!u) throw new Error('Unauthorized');
			if (db.posts.some((p) => p.userId === u._id)) return;
			const now = Date.now();
			const platforms = ['facebook', 'instagram', 'x', 'linkedin', 'tiktok', 'youtube', 'threads', 'bluesky', 'pinterest'];
			for (const platform of platforms) {
				db.profiles.push({
					_id: uid(), userId: u._id, platform,
					handle: `@${u.name.replace(/\s+/g, '').toLowerCase()}_${platform}`,
					displayName: `${u.name} · ${platform.toUpperCase()}`,
					status: platform === 'youtube' ? 'expiring' : 'connected',
					tokenExpiresAt: platform === 'youtube' ? now + 6 * 864e5 : null,
					scopes: ['publish', 'analytics', 'inbox'],
					avatarColor: ['#6366f1', '#ec4899', '#0f172a', '#f97316', '#ef4444', '#1877f2', '#a855f7', '#4169e1', '#e60023'][platforms.indexOf(platform)],
					connectedAt: now - 20 * 864e5
				});
			}
			const samplePosts = [
				{ content: 'We rebuilt our publishing pipeline to be per-platform aware — 40% fewer failed posts in the first week. Here is what changed and why it matters. 🧵', platforms: ['linkedin', 'x'], status: 'published', days: 12 },
				{ content: 'Behind the scenes of the new AI composer: hook formulas that actually convert, platform-tuned rewrites, and one-click scheduling. 🎬', platforms: ['instagram', 'tiktok'], status: 'published', days: 9 },
				{ content: 'Your unified inbox should feel like a cockpit, not a firehose. We shipped priority scoring: DMs from customers, comment spikes and reviews first.', platforms: ['facebook', 'x'], status: 'published', days: 6 },
				{ content: 'New: Reverse Studio. Point it at any website, capture its network traffic, and get a typed API client — then wire the discovered credentials into your connectors.', platforms: ['linkedin'], status: 'published', days: 3 },
				{ content: 'Consistency beats virality. Our queue now finds the next open slot across every recurring timeslot you define, so a 6-platform week plans itself.', platforms: ['instagram', 'threads'], status: 'published', days: 1 },
				{ content: 'Draft: the 2026 social stack — one API, one inbox, one CRM. A deep dive for teams who are tired of tab juggling.', platforms: ['linkedin', 'bluesky'], status: 'scheduled', days: -2 },
				{ content: 'Carousel: 7 posting rules that survived every algorithm update.', platforms: ['instagram'], status: 'draft', days: 0 },
				{ content: 'Rewatch our launch keynote — publishing, engagement and analytics in one call.', platforms: ['youtube'], status: 'published', days: 15 }
			];
			for (const s of samplePosts) {
				const when = s.status === 'scheduled' ? now + Math.abs(s.days) * 864e5 : now - s.days * 864e5;
				const post: Row = {
					_id: uid(), userId: u._id, content: s.content, platforms: s.platforms, status: s.status,
					scheduledAt: s.status === 'scheduled' ? when : null, publishedAt: s.status === 'published' ? when : null,
					mediaUrls: [], hashtags: [], tags: [], generatedBy: 'manual', perPlatformResults: null, createdAt: when, updatedAt: when
				};
				db.posts.push(post);
				if (s.status === 'published') {
					for (let wave = 0; wave < 3; wave++) {
						const base = 2000 + Math.floor(Math.random() * 14000);
						const decay = [1, 0.62, 0.35][wave];
						for (const platform of s.platforms) {
							db.analytics.push({
								_id: uid(), userId: u._id, postId: post._id, platform, capturedAt: when + wave * 864e5,
								impressions: Math.round(base * decay), reach: Math.round(base * decay * 0.72),
								likes: Math.round(base * decay * 0.061), comments: Math.round(base * decay * 0.009),
								shares: Math.round(base * decay * 0.014), saves: Math.round(base * decay * 0.018),
								clicks: Math.round(base * decay * 0.021), followersDelta: Math.round(base * decay * 0.004)
							});
						}
					}
				}
			}
			for (let day = 30; day >= 0; day -= 5) {
				for (const platform of platforms) {
					const followers = 4200 + Math.floor(Math.random() * 2600);
					db.audienceSnapshot.push({ _id: uid(), userId: u._id, platform, capturedAt: now - day * 864e5, followers, netChange: Math.round(followers * 0.004), engagementRate: 2.4 + Math.random() * 2.6 });
				}
			}
			const inboxSeeds: Array<[string, string, string, string]> = [
				['comment', 'instagram', 'maya.builds', 'This is exactly what our team needed — the approval flow is 🔥. Does it work with Threads too?'],
				['dm', 'linkedin', 'dara_k_analytics', 'Hi! We manage 40 client accounts. Can GuruSocial give each client its own API key?'],
				['review', 'google-business', 'Priya N.', '★★★★★ The scheduler alone saves our agency ~6 hours a week.'],
				['mention', 'x', 'growth_gabe', 'Everyone sleeping on GuruSocial MCP tooling is working too hard'],
				['comment', 'youtube', 'leo.templates', 'Could you cover the visual templates in a follow-up? Whiteboard infographic looks slick.']
			];
			for (const [type, platform, fromUser, message] of inboxSeeds) {
				db.inboxItems.push({ _id: uid(), userId: u._id, type, platform, profileHandle: `@${u.name.split(' ')[0].toLowerCase()}`, fromUser, message, status: 'unread', sentAt: now - Math.floor(Math.random() * 4) * 864e5 });
			}
			db.automations.push({ _id: uid(), userId: u._id, name: 'Welcome DM for new followers', kind: 'dm_reply', platforms: ['instagram', 'facebook'], trigger: { type: 'keyword', keywords: ['hi', 'hello', 'interested'] }, responseTemplate: 'Hi {{fromUser}}! Thanks for reaching out 👋 Reply "guide" and I will send the full playbook.', usesAi: true, enabled: true, runs: 42, createdAt: now - 12 * 864e5 });
			db.automations.push({ _id: uid(), userId: u._id, name: 'Pricing question auto-reply', kind: 'comment_reply', platforms: ['linkedin', 'x'], trigger: { type: 'keyword', keywords: ['price', 'pricing', 'cost'] }, responseTemplate: 'Great question! Plans start free. The comparison table is on our pricing page.', usesAi: false, enabled: true, runs: 18, createdAt: now - 9 * 864e5 });
			db.contacts.push({ _id: uid(), userId: u._id, name: 'Dara K.', handle: '@dara_k_analytics', platform: 'linkedin', stage: 'opportunity', value: 12000, notes: 'Agency: 40 client accounts, wants per-client API keys.', createdAt: now - 2 * 864e5 });
			db.contacts.push({ _id: uid(), userId: u._id, name: 'Maya (builder)', handle: '@maya.builds', platform: 'instagram', stage: 'engaged', value: 0, notes: 'Asked about Threads support.', createdAt: now - 1 * 864e5 });
			db.contacts.push({ _id: uid(), userId: u._id, name: 'Gabe (growth)', handle: '@growth_gabe', platform: 'x', stage: 'advocate', value: 0, notes: 'Public champion, mentions weekly.', createdAt: now - 5 * 864e5 });
			db.campaigns.push({ _id: uid(), userId: u._id, name: 'Q1 product launch', goal: 'awareness', startDate: now - 7 * 864e5, endDate: now + 21 * 864e5, platforms: ['instagram', 'linkedin', 'x', 'tiktok'], budget: 2500 });
			db.queueSlots.push({ _id: uid(), userId: u._id, platform: 'linkedin', dayOfWeek: 2, timeOfDay: '08:00', active: true });
			db.queueSlots.push({ _id: uid(), userId: u._id, platform: 'linkedin', dayOfWeek: 4, timeOfDay: '08:00', active: true });
			db.queueSlots.push({ _id: uid(), userId: u._id, platform: 'x', dayOfWeek: 1, timeOfDay: '12:00', active: true });
			db.queueSlots.push({ _id: uid(), userId: u._id, platform: 'instagram', dayOfWeek: 2, timeOfDay: '09:30', active: true });
			db.competitors.push({ _id: uid(), userId: u._id, name: 'Buffer', platform: 'x', handle: '@buffer', followers: 880000, postsPerWeek: 14, engagementRate: 1.2 });
			db.competitors.push({ _id: uid(), userId: u._id, name: 'Sprout Social', platform: 'linkedin', handle: 'sproutsocial', followers: 420000, postsPerWeek: 6, engagementRate: 2.1 });
			db.auditLog.push({ _id: uid(), userId: u._id, actor: 'system', action: 'workspace.seeded', target: 'demo-data', detail: 'starter dataset', createdAt: now });
			save(db);
		}
	},
	profiles: {
		async list(token) {
			const db = load();
			const s = db.sessions.find((x) => x.token === token);
			return db.profiles.filter((p) => p.userId === s?.userId) as any;
		},
		async connect(token, platform, mode, credential, handle) {
			const db = load();
			const s = db.sessions.find((x) => x.token === token);
			const colors = ['#6366f1', '#ec4899', '#f97316', '#22c55e', '#0ea5e9', '#a855f7', '#ef4444', '#eab308'];
			const id = uid();
			db.profiles.push({ _id: id, userId: s!.userId, platform, handle: handle ?? `@owner_${platform}`, displayName: handle ?? platform, status: 'connected', scopes: mode === 'native_oauth' ? ['publish', 'analytics', 'inbox'] : ['publish', 'analytics'], credentialsRef: credential, avatarColor: colors[Math.floor(Math.random() * colors.length)], connectedAt: Date.now() });
			db.auditLog.push({ _id: uid(), userId: s!.userId, actor: 'owner', action: 'profile.connected', target: platform, detail: `mode=${mode}`, createdAt: Date.now() });
			save(db);
			return { profileId: id };
		},
		async disconnect(token, profileId) {
			const db = load();
			db.profiles = db.profiles.filter((p) => p._id !== profileId);
			save(db);
		}
	},
	posts: {
		async create(token, post) {
			const db = load();
			const s = db.sessions.find((x) => x.token === token);
			const now = Date.now();
			const status = post.draft ? 'draft' : post.pendingApproval ? 'pending_approval' : post.scheduledAt ? 'scheduled' : 'published';
			const row: Row = {
				_id: uid(), userId: s!.userId, content: post.content, platforms: post.platforms,
				status, scheduledAt: post.scheduledAt ?? null, publishedAt: status === 'published' ? now : null,
				mediaUrls: post.mediaUrls ?? [], mediaType: post.mediaType ?? null, firstComment: post.firstComment ?? null,
				hashtags: post.hashtags ?? [], tags: post.tags ?? [], generatedBy: post.generatedBy ?? 'manual',
				perPlatformResults: status === 'published' ? post.platforms.map((p) => ({ platform: p, status: 'published', message: 'Delivered natively', attempts: 1 })) : null,
				approvalState: null, campaignId: post.campaignId ?? null, createdAt: now, updatedAt: now
			};
			db.posts.push(row);
			if (status === 'published') {
				for (const platform of post.platforms) {
					db.analytics.push({ _id: uid(), userId: s!.userId, postId: row._id, platform, capturedAt: now, impressions: 0, reach: 0, likes: 0, comments: 0, shares: 0, saves: 0, clicks: 0, followersDelta: 0 });
				}
			}
			db.auditLog.push({ _id: uid(), userId: s!.userId, actor: 'owner', action: `post.${status}`, target: row._id, detail: post.platforms.join(','), createdAt: now });
			save(db);
			return { postId: row._id };
		},
		async update(token, postId, patch) {
			const db = load();
			const p = db.posts.find((x) => x._id === postId);
			if (p) {
				Object.assign(p, patch, { updatedAt: Date.now() });
				if (patch.status === 'published' && !p.publishedAt) p.publishedAt = Date.now();
				save(db);
			}
		},
		async approve(token, postId, approve, note) {
			const db = load();
			const p = db.posts.find((x) => x._id === postId);
			if (p) {
				p.status = approve ? 'approved' : 'pending_approval';
				p.approvalState = approve ? 'approved' : 'changes_requested';
				p.updatedAt = Date.now();
				save(db);
			}
		},
		async remove(token, postId, deleteOnPlatform) {
			const db = load();
			const p = db.posts.find((x) => x._id === postId);
			if (!p) return;
			if (p.status === 'published' && deleteOnPlatform) {
				p.status = 'deleted';
				p.updatedAt = Date.now();
			} else {
				db.posts = db.posts.filter((x) => x._id !== postId);
			}
			save(db);
		},
		async list(token, filters) {
			const db = load();
			const s = db.sessions.find((x) => x.token === token);
			let rows = db.posts.filter((p) => p.userId === s?.userId);
			if (filters?.status) rows = rows.filter((p) => p.status === filters.status);
			if (filters?.platform) rows = rows.filter((p) => p.platforms.includes(filters.platform!));
			if (filters?.from) rows = rows.filter((p) => (p.scheduledAt ?? p.createdAt) >= filters.from!);
			if (filters?.to) rows = rows.filter((p) => (p.scheduledAt ?? p.createdAt) <= filters.to!);
			return rows.sort((a, b) => (b.scheduledAt ?? b.createdAt) - (a.scheduledAt ?? a.createdAt)) as any;
		},
		async get(token, postId) {
			const db = load();
			return (db.posts.find((x) => x._id === postId) ?? null) as any;
		},
		async nextFreeSlot(token) {
			const db = load();
			const s = db.sessions.find((x) => x.token === token);
			const slots = db.queueSlots.filter((q) => q.userId === s?.userId && q.active);
			const taken = new Set(db.posts.filter((p) => p.userId === s?.userId && p.status === 'scheduled' && p.scheduledAt).map((p) => new Date(p.scheduledAt).toISOString().slice(0, 16)));
			const now = new Date();
			for (let day = 0; day < 14; day++) {
				for (const slot of slots) {
					if (slot.dayOfWeek !== now.getDay()) continue;
					const [h, m] = slot.timeOfDay.split(':').map(Number);
					const c = new Date(now);
					c.setDate(c.getDate() + day);
					c.setHours(h, m, 0, 0);
					if (c.getTime() < Date.now()) continue;
					if (!taken.has(c.toISOString().slice(0, 16))) return c.getTime();
				}
				now.setDate(now.getDate() + 1);
			}
			return Date.now() + 864e5;
		},
		async queueSlots(token) {
			const db = load();
			const s = db.sessions.find((x) => x.token === token);
			return db.queueSlots.filter((q) => q.userId === s?.userId) as any;
		},
		async upsertQueueSlot(token, platform, dayOfWeek, timeOfDay, active) {
			const db = load();
			const s = db.sessions.find((x) => x.token === token);
			const existing = db.queueSlots.find((q) => q.userId === s?.userId && q.platform === platform && q.dayOfWeek === dayOfWeek && q.timeOfDay === timeOfDay);
			if (existing) existing.active = active;
			else db.queueSlots.push({ _id: uid(), userId: s!.userId, platform, dayOfWeek, timeOfDay, active });
			save(db);
		}
	},
	analytics: {
		async overview(token, days = 30) {
			const db = load();
			const s = db.sessions.find((x) => x.token === token);
			const since = Date.now() - days * 864e5;
			const rows = db.analytics.filter((a) => a.userId === s?.userId && a.capturedAt >= since);
			const totals = rows.reduce((acc, a) => ({ impressions: acc.impressions + a.impressions, reach: acc.reach + a.reach, likes: acc.likes + a.likes, comments: acc.comments + a.comments, shares: acc.shares + a.shares, saves: acc.saves + a.saves, clicks: acc.clicks + a.clicks, followersDelta: acc.followersDelta + a.followersDelta }), { impressions: 0, reach: 0, likes: 0, comments: 0, shares: 0, saves: 0, clicks: 0, followersDelta: 0 });
			const byPlatformMap: Record<string, any> = {};
			for (const a of rows) {
				(byPlatformMap[a.platform] ??= { platform: a.platform, impressions: 0, reach: 0, engagement: 0, posts: 0 });
				byPlatformMap[a.platform].impressions += a.impressions;
				byPlatformMap[a.platform].reach += a.reach;
				byPlatformMap[a.platform].engagement += a.likes + a.comments + a.shares + a.saves;
				byPlatformMap[a.platform].posts += 1;
			}
			const byDayMap: Record<string, { day: string; impressions: number; engagement: number }> = {};
			for (let i = days - 1; i >= 0; i--) {
				const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
				byDayMap[d] = { day: d, impressions: 0, engagement: 0 };
			}
			for (const a of rows) {
				const key = new Date(a.capturedAt).toISOString().slice(0, 10);
				if (byDayMap[key]) { byDayMap[key].impressions += a.impressions; byDayMap[key].engagement += a.likes + a.comments + a.shares; }
			}
			const followers: Record<string, { followers: number }> = {};
			for (const a of db.audienceSnapshot.filter((a) => a.userId === s?.userId && a.capturedAt >= since)) {
				(followers[a.platform] ??= { followers: 0 }).followers += a.followers;
			}
			const topPostIds = Object.entries(rows.reduce((acc, a) => { acc[a.postId] = (acc[a.postId] ?? 0) + a.impressions; return acc; }, {} as Record<string, number>)).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id]) => id);
			return { totals, byPlatform: Object.values(byPlatformMap), byDay: Object.values(byDayMap), followers, topPostIds };
		},
		async topPosts(token, metric = 'impressions', limit = 8) {
			const db = load();
			const s = db.sessions.find((x) => x.token === token);
			const rows = db.analytics.filter((a) => a.userId === s?.userId);
			const totals: Record<string, number> = {};
			for (const a of rows) totals[a.postId] = (totals[a.postId] ?? 0) + ((a as any)[metric] ?? 0);
			return Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, limit).map(([id, value]) => {
				const p = db.posts.find((x) => x._id === id);
				return { _id: id, content: p?.content ?? '', platforms: p?.platforms ?? [], status: p?.status ?? '', publishedAt: p?.publishedAt ?? null, metricValue: value };
			}) as any;
		},
		async audience(token) {
			const db = load();
			const s = db.sessions.find((x) => x.token === token);
			return db.audienceSnapshot.filter((a) => a.userId === s?.userId) as any;
		},
		async competitors(token) {
			const db = load();
			const s = db.sessions.find((x) => x.token === token);
			return db.competitors.filter((c) => c.userId === s?.userId) as any;
		},
		async addCompetitor(token, c) {
			const db = load();
			const s = db.sessions.find((x) => x.token === token);
			db.competitors.push({ _id: uid(), userId: s!.userId, ...c, createdAt: Date.now() });
			save(db);
		},
		async removeCompetitor(token, id) {
			const db = load();
			db.competitors = db.competitors.filter((c) => c._id !== id);
			save(db);
		}
	},
	inbox: {
		async list(token, filters) {
			const db = load();
			const s = db.sessions.find((x) => x.token === token);
			let rows = db.inboxItems.filter((i) => i.userId === s?.userId);
			if (filters?.type) rows = rows.filter((i) => i.type === filters.type);
			if (filters?.status) rows = rows.filter((i) => i.status === filters.status);
			return rows.sort((a, b) => b.sentAt - a.sentAt) as any;
		},
		async mark(token, id, status) {
			const db = load();
			const i = db.inboxItems.find((x) => x._id === id);
			if (i) { i.status = status; save(db); }
		},
		async reply(token, id, message) {
			const db = load();
			const i = db.inboxItems.find((x) => x._id === id);
			if (i) { i.status = 'replied'; i.repliedMessage = message; i.repliedAt = Date.now(); save(db); }
		},
		async toContact(token, id) {
			const db = load();
			const i = db.inboxItems.find((x) => x._id === id);
			const s = db.sessions.find((x) => x.token === token);
			const cid = uid();
			db.contacts.push({ _id: cid, userId: s!.userId, name: i!.fromUser, handle: i!.profileHandle, platform: i!.platform, stage: 'lead', value: 0, notes: i!.message, createdAt: Date.now() });
			save(db);
			return { contactId: cid };
		}
	},
	automations: {
		async list(token) {
			const db = load();
			const s = db.sessions.find((x) => x.token === token);
			return db.automations.filter((a) => a.userId === s?.userId).sort((a, b) => b.createdAt - a.createdAt) as any;
		},
		async create(token, a) {
			const db = load();
			const s = db.sessions.find((x) => x.token === token);
			const id = uid();
			db.automations.push({ _id: id, userId: s!.userId, ...a, enabled: a.enabled ?? true, runs: 0, createdAt: Date.now(), trigger: { type: a.triggerType, keywords: a.keywords ?? [] } });
			save(db);
			return { automationId: id };
		},
		async toggle(token, id, enabled) {
			const db = load();
			const a = db.automations.find((x) => x._id === id);
			if (a) { a.enabled = enabled; save(db); }
		},
		async remove(token, id) {
			const db = load();
			db.automations = db.automations.filter((a) => a._id !== id);
			save(db);
		},
		async run(token, automationId, inboxItemId) {
			const db = load();
			const a = db.automations.find((x) => x._id === automationId);
			const i = db.inboxItems.find((x) => x._id === inboxItemId);
			if (!a || !i) throw new Error('Automation or inbox item not found.');
			const text = i.message.toLowerCase();
			const keywords = a.trigger.keywords ?? [];
			const matched = a.trigger.type === 'keyword' ? keywords.some((k: string) => text.includes(k.toLowerCase())) : true;
			if (!matched) return { reply: '', matched: false };
			const reply = a.responseTemplate.replace(/\{\{fromUser\}\}/g, i.fromUser);
			i.status = 'replied'; i.repliedMessage = reply; i.repliedAt = Date.now();
			a.runs += 1;
			db.agentRuns.push({ _id: uid(), userId: i.userId, automationId, agent: 'engagement', input: i.message.slice(0, 200), output: reply.slice(0, 400), status: 'succeeded', createdAt: Date.now() });
			save(db);
			return { reply, matched: true };
		},
		async agentRuns(token, limit = 20) {
			const db = load();
			const s = db.sessions.find((x) => x.token === token);
			return db.agentRuns.filter((r) => r.userId === s?.userId).sort((a, b) => b.createdAt - a.createdAt).slice(0, limit) as any;
		}
	},
	crm: {
		async contacts(token, stage) {
			const db = load();
			const s = db.sessions.find((x) => x.token === token);
			let rows = db.contacts.filter((c) => c.userId === s?.userId);
			if (stage) rows = rows.filter((c) => c.stage === stage);
			return rows.sort((a, b) => b.createdAt - a.createdAt) as any;
		},
		async upsertContact(token, c) {
			const db = load();
			const s = db.sessions.find((x) => x.token === token);
			const id = uid();
			db.contacts.push({ _id: id, userId: s!.userId, ...c, notes: c.notes ?? '', createdAt: Date.now() });
			save(db);
			return { contactId: id };
		},
		async moveStage(token, id, stage) {
			const db = load();
			const c = db.contacts.find((x) => x._id === id);
			if (c) { c.stage = stage; save(db); }
		},
		async removeContact(token, id) {
			const db = load();
			db.contacts = db.contacts.filter((c) => c._id !== id);
			save(db);
		},
		async campaigns(token) {
			const db = load();
			const s = db.sessions.find((x) => x.token === token);
			return db.campaigns.filter((c) => c.userId === s?.userId) as any;
		},
		async createCampaign(token, c) {
			const db = load();
			const s = db.sessions.find((x) => x.token === token);
			const id = uid();
			db.campaigns.push({ _id: id, userId: s!.userId, ...c });
			save(db);
			return { campaignId: id };
		},
		async brandKits(token) {
			const db = load();
			const s = db.sessions.find((x) => x.token === token);
			return db.brandKits.filter((k) => k.userId === s?.userId) as any;
		},
		async upsertBrandKit(token, k) {
			const db = load();
			const s = db.sessions.find((x) => x.token === token);
			const existing = db.brandKits.find((x) => x.userId === s?.userId && x.name === k.name);
			if (existing) Object.assign(existing, k);
			else db.brandKits.push({ _id: uid(), userId: s!.userId, ...k });
			save(db);
		},
		async visualTemplates(token) {
			const db = load();
			const s = db.sessions.find((x) => x.token === token);
			return db.visualTemplates.filter((t) => t.userId === s?.userId) as any;
		},
		async seedVisualTemplates(token) {
			const db = load();
			const s = db.sessions.find((x) => x.token === token);
			if (db.visualTemplates.some((t) => t.userId === s?.userId)) return;
			const defaults = [
				{ name: 'Whiteboard infographic', kind: 'infographic', platform: 'linkedin', slots: 1, previewColors: ['#1f2937', '#f9fafb'], defaultPrompt: 'Turn these key points into a clean whiteboard explainer image.' },
				{ name: 'Instagram tutorial carousel', kind: 'carousel', platform: 'instagram', slots: 6, previewColors: ['#7c3aed', '#f472b6'], defaultPrompt: 'Create a step-by-step tutorial carousel from this topic.' },
				{ name: 'Quote card', kind: 'quote-card', platform: 'x', slots: 1, previewColors: ['#0f172a', '#38bdf8'], defaultPrompt: 'Turn this line into a bold quote card.' },
				{ name: 'Image slideshow', kind: 'slideshow', platform: 'tiktok', slots: 5, previewColors: ['#f59e0b', '#ef4444'], defaultPrompt: 'Build a punchy 5-frame slideshow with a hook on frame one.' },
				{ name: 'AI avatar video', kind: 'avatar-video', platform: 'youtube', slots: 1, previewColors: ['#111827', '#6366f1'], defaultPrompt: 'Script a 30-second avatar video with generated b-roll cues.' }
			];
			for (const t of defaults) db.visualTemplates.push({ _id: uid(), userId: s!.userId, ...t });
			save(db);
		}
	},
	keys: {
		async listKeys(token) {
			const db = load();
			const s = db.sessions.find((x) => x.token === token);
			return db.apiKeys.filter((k) => k.userId === s?.userId).sort((a, b) => b.createdAt - a.createdAt) as any;
		},
		async createKey(token, name, scopes, mode) {
			const db = load();
			const s = db.sessions.find((x) => x.token === token);
			const body = uid() + uid();
			const prefix = `gs_${mode}_` + body.slice(0, 4);
			const full = `gs_${mode}_` + body;
			db.apiKeys.push({ _id: uid(), userId: s!.userId, name, keyPrefix: prefix, keyHash: hash32(full), scopes, mode, createdAt: Date.now() });
			db.auditLog.push({ _id: uid(), userId: s!.userId, actor: 'owner', action: 'apikey.created', target: prefix, detail: scopes.join(','), createdAt: Date.now() });
			save(db);
			return { key: full, prefix };
		},
		async revokeKey(token, id) {
			const db = load();
			const k = db.apiKeys.find((x) => x._id === id);
			if (k) { k.revokedAt = Date.now(); save(db); }
		},
		async webhooks(token) {
			const db = load();
			const s = db.sessions.find((x) => x.token === token);
			return db.webhooks.filter((w) => w.userId === s?.userId) as any;
		},
		async addWebhook(token, url, events) {
			const db = load();
			const s = db.sessions.find((x) => x.token === token);
			db.webhooks.push({ _id: uid(), userId: s!.userId, url, events, active: true });
			save(db);
		},
		async removeWebhook(token, id) {
			const db = load();
			db.webhooks = db.webhooks.filter((w) => w._id !== id);
			save(db);
		},
		async logs(token, limit = 50) {
			const db = load();
			const s = db.sessions.find((x) => x.token === token);
			return db.apiLogs.filter((l) => l.userId === s?.userId).sort((a, b) => b.createdAt - a.createdAt).slice(0, limit) as any;
		},
		async auditTrail(token, limit = 50) {
			const db = load();
			const s = db.sessions.find((x) => x.token === token);
			return db.auditLog.filter((a) => a.userId === s?.userId).sort((a, b) => b.createdAt - a.createdAt).slice(0, limit) as any;
		}
	},
	ewin: {
		async issueCode() {
			throw new Error('The E-WIN hub connection requires the live Convex backend.');
		}
	},
	ai: {
		async generate(token, req) {
			// Deterministic local engine — mirrors src/lib/ai/generator.ts heuristics.
			const { generateDrafts } = await import('../ai/generator');
			return generateDrafts({ topic: req.topic, sourceText: req.sourceText, platforms: req.platforms, hashtags: ['gurusocial'], variantSeed: Math.floor(Math.random() * 997) });
		}
	},
	media: {
		async presignUpload(token, fileName, contentType) {
			// Demo mode: inline the file as a data URL so previews keep working offline.
			return new Promise((resolve, reject) => {
				const input = document.createElement('input');
				input.type = 'file';
				input.onchange = () => {
					const file = input.files?.[0];
					if (!file) return reject(new Error('No file selected.'));
					const reader = new FileReader();
					reader.onload = () => resolve({ uploadUrl: String(reader.result), publicUrl: String(reader.result), key: file.name });
					reader.onerror = () => reject(new Error('Could not read file.'));
					reader.readAsDataURL(file);
				};
				input.click();
			});
		}
	},
	harvest: {
		async list(token) {
			const db = load();
			const s = db.sessions.find((x) => x.token === token);
			return db.harvestJobs.filter((h) => h.userId === s?.userId).sort((a, b) => b.createdAt - a.createdAt) as any;
		},
		async create(token, j) {
			const db = load();
			const s = db.sessions.find((x) => x.token === token);
			const id = uid();
			db.harvestJobs.push({ _id: id, userId: s!.userId, ...j, status: 'queued', endpointsFound: 0, keysFound: [], notes: '', createdAt: Date.now(), updatedAt: Date.now() });
			save(db);
			return { jobId: id };
		},
		async updateStatus(token, id, status, patch) {
			const db = load();
			const j = db.harvestJobs.find((x) => x._id === id);
			if (j) { j.status = status; Object.assign(j, patch ?? {}, { updatedAt: Date.now() }); save(db); }
		},
		async remove(token, id) {
			const db = load();
			db.harvestJobs = db.harvestJobs.filter((h) => h._id !== id);
			save(db);
		}
	}
};
