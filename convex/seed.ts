import { v } from 'convex/values';
import { mutationGeneric as mutation } from 'convex/server';
import { requireUser, PLATFORMS } from './lib';

/**
 * One-click onboarding: seeds a fresh workspace with connected profiles, a full
 * content calendar, analytics history, inbox threads, automations, CRM pipeline
 * and a campaign so every dashboard renders meaningfully on first sign-in.
 */
export const seedWorkspace = mutation({
	args: { token: v.string() },
	returns: v.null(),
	handler: async (ctx, { token }) => {
		const user = await requireUser(ctx, token);
		const existing = await ctx.db
			.query('posts')
			.withIndex('by_user', (q) => q.eq('userId', user._id))
			.collect();
		if (existing.length) return; // already seeded
		const now = Date.now();
		const platforms = PLATFORMS as readonly string[];

		const profiles = ['instagram', 'linkedin', 'x', 'tiktok', 'youtube', 'facebook', 'threads', 'bluesky', 'pinterest'];
		for (const platform of profiles) {
			await ctx.db.insert('profiles', {
				userId: user._id,
				platform,
				handle: `@${user.name.replace(/\s+/g, '').toLowerCase()}_${platform === 'google-business' ? 'gbp' : platform}`,
				displayName: `${user.name} · ${platform.replace('-', ' ').toUpperCase()}`,
				status: platform === 'youtube' ? 'expiring' : 'connected',
				tokenExpiresAt: platform === 'youtube' ? now + 6 * 864e5 : undefined,
				scopes: ['publish', 'analytics', 'inbox'],
				avatarColor: ['#6366f1', '#ec4899', '#0f172a', '#f97316', '#ef4444', '#1877f2', '#a855f7', '#4169e1', '#e60023'][Math.floor(Math.random() * 9)],
				connectedAt: now - 20 * 864e5,
				lastSyncedAt: now - 3600e3
			});
		}

		const samplePosts = [
			{ content: 'We rebuilt our publishing pipeline to be per-platform aware — 40% fewer failed posts in the first week. Here is what changed and why it matters. 🧵', platforms: ['linkedin', 'x'], status: 'published', days: 12, mediaUrls: [], hashtags: ['buildinpublic'] },
			{ content: 'Behind the scenes of the new AI composer: hook formulas that actually convert, platform-tuned rewrites, and one-click scheduling. 🎬', platforms: ['instagram', 'tiktok'], status: 'published', days: 9, mediaUrls: ['https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=1200'], hashtags: ['contentstrategy'] },
			{ content: 'Your unified inbox should feel like a cockpit, not a firehose. We shipped priority scoring: DMs from customers, comment spikes and reviews first.', platforms: ['facebook', 'x'], status: 'published', days: 6, mediaUrls: [], hashtags: ['socialmediamarketing'] },
			{ content: 'New: Reverse Studio. Point it at any website, capture its network traffic, and get a typed API client — then wire the discovered credentials into your connectors.', platforms: ['linkedin'], status: 'published', days: 3, mediaUrls: [], hashtags: ['api'] },
			{ content: 'Consistency beats virality. Our queue now finds the next open slot across every recurring timeslot you define, so a 6-platform week plans itself.', platforms: ['instagram', 'threads'], status: 'published', days: 1, mediaUrls: [], hashtags: ['smm'] },
			{ content: 'Draft: the 2026 social stack — one API, one inbox, one CRM. A deep dive for teams who are tired of tab juggling.', platforms: ['linkedin', 'bluesky'], status: 'scheduled', days: -2, mediaUrls: [], hashtags: [] },
			{ content: 'Carousel: 7 posting rules that survived every algorithm update.', platforms: ['instagram'], status: 'draft', days: 0, mediaUrls: [], hashtags: ['carousel'] },
			{ content: 'Rewatch our launch keynote — publishing, engagement and analytics in one call.', platforms: ['youtube'], status: 'published', days: 15, mediaUrls: ['https://images.unsplash.com/photo-1611162616475-46b635cb6868?w=1200'], hashtags: [] }
		];

		for (const s of samplePosts) {
			const when = s.status === 'scheduled' ? now + Math.abs(s.days) * 864e5 : now - s.days * 864e5;
			const postId = await ctx.db.insert('posts', {
				userId: user._id,
				content: s.content,
				platforms: s.platforms,
				status: s.status as any,
				scheduledAt: s.status === 'scheduled' ? when : undefined,
				publishedAt: s.status === 'published' ? when : undefined,
				mediaUrls: s.mediaUrls,
				hashtags: s.hashtags,
				tags: [],
				generatedBy: 'manual',
				perPlatformResults: s.status === 'published' ? s.platforms.map((p) => ({ platform: p, status: 'published', message: 'Delivered natively', attempts: 1 })) : undefined,
				createdAt: when - 3600e3,
				updatedAt: when
			});
			if (s.status === 'published') {
				// Three analytics waves per post with organic decay + occasional spikes.
				for (let wave = 0; wave < 3; wave++) {
					const base = 2000 + Math.floor(Math.random() * 14000);
					const decay = [1, 0.62, 0.35][wave];
					for (const platform of s.platforms) {
						await ctx.db.insert('analytics', {
							userId: user._id, postId, platform, capturedAt: when + wave * 864e5,
							impressions: Math.round(base * decay),
							reach: Math.round(base * decay * 0.72),
							likes: Math.round(base * decay * 0.061),
							comments: Math.round(base * decay * 0.009),
							shares: Math.round(base * decay * 0.014),
							saves: Math.round(base * decay * 0.018),
							clicks: Math.round(base * decay * 0.021),
							followersDelta: Math.round(base * decay * 0.004)
						});
					}
				}
			}
		}

		// Audience snapshots across 30 days.
		for (let day = 30; day >= 0; day -= 5) {
			for (const platform of profiles) {
				const followers = 4200 + Math.floor(Math.random() * 2600);
				await ctx.db.insert('audienceSnapshot', {
					userId: user._id, platform, capturedAt: now - day * 864e5,
					followers, netChange: Math.round(followers * 0.004),
					engagementRate: 2.4 + Math.random() * 2.6
				});
			}
		}

		const inboxSeeds = [
			{ type: 'comment' as const, platform: 'instagram', fromUser: 'maya.builds', message: 'This is exactly what our team needed — the approval flow is 🔥. Does it work with Threads too?' },
			{ type: 'dm' as const, platform: 'linkedin', fromUser: 'dara_k_analytics', message: 'Hi! We manage 40 client accounts. Can GuruSocial give each client its own API key?' },
			{ type: 'review' as const, platform: 'google-business', fromUser: 'Priya N.', message: '★★★★★ The scheduler alone saves our agency ~6 hours a week.' },
			{ type: 'mention' as const, platform: 'x', fromUser: 'growth_gabe', message: 'Everyone sleeping on GuruSocial MCP tooling is working too hard' },
			{ type: 'comment' as const, platform: 'youtube', fromUser: 'leo.templates', message: 'Could you cover the visual templates in a follow-up? Whiteboard infographic looks slick.' }
		];
		for (const i of inboxSeeds) {
			await ctx.db.insert('inboxItems', {
				userId: user._id, type: i.type, platform: i.platform,
				profileHandle: `@${user.name.split(' ')[0].toLowerCase()}`, fromUser: i.fromUser,
				message: i.message, status: 'unread', sentAt: now - Math.floor(Math.random() * 4) * 864e5
			});
		}

		await ctx.db.insert('automations', {
			userId: user._id, name: 'Welcome DM for new followers', kind: 'dm_reply',
			platforms: ['instagram', 'facebook'], trigger: { type: 'keyword', keywords: ['hi', 'hello', 'interested'] },
			responseTemplate: 'Hi {{fromUser}}! Thanks for reaching out 👋 Here is our 60-second tour: https://demo.gurusocial.app — reply "guide" and I will send the full playbook.',
			usesAi: true, enabled: true, runs: 42, createdAt: now - 12 * 864e5
		});
		await ctx.db.insert('automations', {
			userId: user._id, name: 'Pricing question auto-reply', kind: 'comment_reply',
			platforms: ['linkedin', 'x'], trigger: { type: 'keyword', keywords: ['price', 'pricing', 'cost'] },
			responseTemplate: 'Great question! Plans start free. The comparison table is here: https://demo.gurusocial.app/pricing',
			usesAi: false, enabled: true, runs: 18, createdAt: now - 9 * 864e5
		});

		await ctx.db.insert('contacts', { userId: user._id, name: 'Dara K.', handle: '@dara_k_analytics', platform: 'linkedin', stage: 'opportunity', value: 12000, notes: 'Agency: 40 client accounts, wants per-client API keys.', createdAt: now - 2 * 864e5 });
		await ctx.db.insert('contacts', { userId: user._id, name: 'Maya (builder)', handle: '@maya.builds', platform: 'instagram', stage: 'engaged', value: 0, notes: 'Asked about Threads support.', createdAt: now - 1 * 864e5 });
		await ctx.db.insert('contacts', { userId: user._id, name: 'Gabe (growth)', handle: '@growth_gabe', platform: 'x', stage: 'advocate', value: 0, notes: 'Public champion, mentions weekly.', createdAt: now - 5 * 864e5 });

		await ctx.db.insert('campaigns', {
			userId: user._id, name: 'Q1 product launch', goal: 'awareness', startDate: now - 7 * 864e5,
			endDate: now + 21 * 864e5, platforms: ['instagram', 'linkedin', 'x', 'tiktok'], budget: 2500
		});

		await ctx.db.insert('queueSlots', { userId: user._id, platform: 'instagram', dayOfWeek: 2, timeOfDay: '09:30', active: true });
		await ctx.db.insert('queueSlots', { userId: user._id, platform: 'linkedin', dayOfWeek: 2, timeOfDay: '08:00', active: true });
		await ctx.db.insert('queueSlots', { userId: user._id, platform: 'linkedin', dayOfWeek: 4, timeOfDay: '08:00', active: true });
		await ctx.db.insert('queueSlots', { userId: user._id, platform: 'x', dayOfWeek: 1, timeOfDay: '12:00', active: true });
		await ctx.db.insert('queueSlots', { userId: user._id, platform: 'x', dayOfWeek: 3, timeOfDay: '12:00', active: true });
		await ctx.db.insert('queueSlots', { userId: user._id, platform: 'x', dayOfWeek: 5, timeOfDay: '12:00', active: true });

		await ctx.db.insert('brandKits', {
			userId: user._id, name: 'Default brand', tone: 'confident, plain-spoken, helpful',
			keyMessages: ['One API, one inbox, one CRM', 'Own your social stack'],
			hashtags: ['gurusocial', 'socialmediamarketing'], colors: ['#6366f1', '#22c55e', '#f59e0b']
		});
		await ctx.db.insert('auditLog', { userId: user._id, actor: 'system', action: 'workspace.seeded', target: 'demo-data', detail: 'starter dataset', createdAt: now });
	}
});
