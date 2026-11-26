<script lang="ts">
	import { data, session } from '$lib/data';
	import StatCard from '$lib/components/StatCard.svelte';
	import AreaChart from '$lib/components/AreaChart.svelte';
	import BarList from '$lib/components/BarList.svelte';
	import PlatformBadge from '$lib/components/PlatformBadge.svelte';
	import StatusPill from '$lib/components/StatusPill.svelte';
	import { PLATFORM_SPECS } from '$lib/ai/generator';
	import { onMount } from 'svelte';
	import { toast } from '$lib/stores/toast';
	import PageHeader from '$lib/components/PageHeader.svelte';

	let overview = $state<any>(null);
	let audience = $state<any[]>([]);
	let topPosts = $state<any[]>([]);
	let inboxUnread = $state<any[]>([]);
	let needsApproval = $state<any[]>([]);
	let profiles = $state<any[]>([]);
	let loading = $state(true);

	onMount(async () => {
		try {
			const token = $session.token!;
			const t = $session.token!;
			[overview, audience, topPosts, inboxUnread, needsApproval, profiles] = await Promise.all([
				data.analytics.overview(token, 30),
				data.analytics.audience(token),
				data.analytics.topPosts(token, 'impressions', 5),
				data.inbox.list(token, { status: 'unread' }),
				data.posts.list(token, { status: 'pending_approval' }),
				data.profiles.list(token)
			]);
			if (!profiles.length) {
				await data.auth.seedWorkspace(t);
				profiles = await data.profiles.list(token);
				[overview, audience, topPosts, inboxUnread, needsApproval] = await Promise.all([
					data.analytics.overview(token, 30), data.analytics.audience(token), data.analytics.topPosts(token, 'impressions', 5),
					data.inbox.list(token, { status: 'unread' }), data.posts.list(token, { status: 'pending_approval' })
				]);
			}
		} catch (e: any) {
			toast(e.message, 'error');
		} finally {
			loading = false;
		}
	});

	const chartPoints = $derived((overview?.byDay ?? []).map((d: any) => ({ v: d.impressions })));
	const engagementPoints = $derived((overview?.byDay ?? []).map((d: any) => ({ v: d.engagement })));
	const platformRows = $derived((overview?.byPlatform ?? []).map((p: any) => ({ label: p.platform, value: p.impressions, color: '#6366f1' })).sort((a: any, b: any) => b.value - a.value).slice(0, 8));
	const totalFollowers = $derived(Object.values(overview?.followers ?? {} as Record<string, { followers: number }>).reduce((acc: number, f: any) => acc + f.followers, 0));
	const engagementRate = $derived.by(() => {
		if (!overview) return '—';
		const { impressions, likes, comments, shares, saves } = overview.totals;
		return impressions ? ((likes + comments + shares + saves) / impressions * 100).toFixed(2) + '%' : '0%';
	});

	const expiring = $derived(profiles.filter((p: any) => p.status === 'expiring'));
</script>

<div>
	<PageHeader
		eyebrow="Command center"
		title={`Good to see you, ${$session.user?.name ?? 'there'}`}
		description="The last 30 days across every connected channel — publishing, engagement and audience in one view."
	>
		<a href="/dashboard/composer" class="btn btn-primary btn-sm">✦ New post</a>
		<a href="/dashboard/inbox" class="btn btn-ghost btn-sm">
			✉ Inbox{#if inboxUnread.length > 0}<span class="ml-1 rounded-full bg-guru-600 px-1.5 text-[10px] text-white">{inboxUnread.length}</span>{/if}
		</a>
	</PageHeader>

	{#if loading}
		<div class="grid animate-pulse gap-4 sm:grid-cols-2 lg:grid-cols-4">
			{#each Array(4) as _}<div class="card h-24"></div>{/each}
		</div>
	{:else}
		<!-- Alerts -->
		{#if expiring.length}
			<div class="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
				⚠ {expiring.length} connected platform{expiring.length > 1 ? 's' : ''} will need re-authorization within a week:
				{#each expiring as p: any}<span class="font-semibold">{p.platform}</span>{/each}
				<a href="/dashboard/channels" class="underline">Fix in Channels →</a>
			</div>
		{/if}

		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
			<StatCard label="Impressions" value={(overview?.totals.impressions ?? 0).toLocaleString()} hint="all connected platforms" />
			<StatCard label="Engagements" value={((overview?.totals.likes ?? 0) + (overview?.totals.comments ?? 0) + (overview?.totals.shares ?? 0)).toLocaleString()} hint={`rate ${engagementRate}`} />
			<StatCard label="Followers" value={totalFollowers.toLocaleString()} hint={`+${(overview?.totals.followersDelta ?? 0).toLocaleString()} this period`} />
			<StatCard label="Awaiting approval" value={String(needsApproval.length)} hint={needsApproval.length ? 'review in Posts' : 'queue is clean'} />
		</div>

		<div class="mt-4 grid gap-4 lg:grid-cols-3">
			<div class="card p-5 lg:col-span-2">
				<div class="mb-2 flex items-center justify-between">
					<h3 class="text-sm font-bold text-white">Impressions — last 30 days</h3>
					<span class="chip bg-ink-700 text-slate-400">daily</span>
				</div>
				<AreaChart points={chartPoints} height={190} color="#6366f1" />
				<div class="mt-1 flex items-center justify-between">
					<h3 class="text-sm font-bold text-white">Engagements</h3>
					<span class="text-xs text-mint-400">▲ trending</span>
				</div>
				<AreaChart points={engagementPoints} height={110} color="#34d399" />
			</div>
			<div class="card p-5">
				<h3 class="mb-4 text-sm font-bold text-white">Top platforms by impressions</h3>
				<BarList rows={platformRows} />
			</div>
		</div>

		<div class="mt-4 grid gap-4 lg:grid-cols-3">
			<div class="card p-5">
				<h3 class="mb-3 text-sm font-bold text-white">Top posts</h3>
				{#each topPosts as p: any}
					<a href="/dashboard/posts" class="mb-2 flex items-start gap-2.5 rounded-xl p-2 transition hover:bg-ink-700/40">
						{#each p.platforms.slice(0, 3) as plat}<PlatformBadge platform={plat} size="sm" />{/each}
						<span class="line-clamp-2 text-xs text-slate-300">{p.content}</span>
						<span class="ml-auto shrink-0 text-xs font-bold tabular-nums text-slate-400">{p.metricValue.toLocaleString()}</span>
					</a>
				{:else}
					<p class="text-sm text-slate-500">Publish your first post to see rankings.</p>
				{/each}
			</div>
			<div class="card p-5">
				<h3 class="mb-3 text-sm font-bold text-white">Inbox — unread</h3>
				{#each inboxUnread.slice(0, 5) as i: any}
					<a href="/dashboard/inbox" class="mb-2 block rounded-xl p-2 transition hover:bg-ink-700/40">
						<div class="flex items-center gap-2">
							<PlatformBadge platform={i.platform} size="sm" />
							<span class="text-xs font-semibold text-white">{i.fromUser}</span>
							<span class="chip bg-ink-700 text-[10px] text-slate-400">{i.type}</span>
						</div>
						<p class="mt-1 line-clamp-2 text-xs text-slate-400">{i.message}</p>
					</a>
				{:else}
					<p class="text-sm text-slate-500">All caught up. 🎉</p>
				{/each}
			</div>
			<div class="card p-5">
				<h3 class="mb-3 text-sm font-bold text-white">Connected channels</h3>
				<div class="flex flex-wrap gap-1.5">
					{#each profiles as p: any}
						<span class="chip bg-ink-700 text-slate-300"><PlatformBadge platform={p.platform} size="sm" /> {p.platform}</span>
					{/each}
				</div>
				<a href="/dashboard/channels" class="btn btn-ghost mt-4 w-full">Manage channels</a>
				<p class="mt-3 text-[10px] leading-relaxed text-slate-600">{PLATFORM_SPECS.length} platforms supported in total — Facebook, Instagram, X, LinkedIn, TikTok, YouTube, Threads, Bluesky, Pinterest, Telegram, WhatsApp, Google Business, Zalo, Slack, Discord.</p>
			</div>
		</div>
	{/if}
</div>
