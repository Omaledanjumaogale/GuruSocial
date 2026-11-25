<script lang="ts">
	import { data, session } from '$lib/data';
	import StatCard from '$lib/components/StatCard.svelte';
	import AreaChart from '$lib/components/AreaChart.svelte';
	import BarList from '$lib/components/BarList.svelte';
	import PlatformBadge from '$lib/components/PlatformBadge.svelte';
	import { toast } from '$lib/stores/toast';
	import { onMount } from 'svelte';

	let overview = $state<any>(null);
	let audience = $state<any[]>([]);
	let competitors = $state<any[]>([]);
	let topPosts = $state<any[]>([]);
	let metric = $state('impressions');
	let days = $state(30);
	let loading = $state(true);

	async function load() {
		const token = $session.token!;
		[overview, audience, competitors, topPosts] = await Promise.all([
			data.analytics.overview(token, days),
			data.analytics.audience(token),
			data.analytics.competitors(token),
			data.analytics.topPosts(token, metric, 6)
		]);
		loading = false;
	}
	onMount(load);

	const METRICS = [
		['impressions', 'Impressions'],
		['reach', 'Reach'],
		['likes', 'Likes'],
		['comments', 'Comments'],
		['shares', 'Shares']
	];

	const platformRows = $derived((overview?.byPlatform ?? []).map((p: any) => ({ label: p.platform, value: metric === 'impressions' ? p.impressions : metric === 'reach' ? p.reach : p.engagement, color: '#6366f1' })).sort((a: any, b: any) => b.value - a.value));
	const points = $derived((overview?.byDay ?? []).map((d: any) => ({ v: metric === 'impressions' ? d.impressions : d.engagement })));

	async function exportCsv() {
		try {
			const rows = [['date', 'impressions', 'engagement'], ...(overview?.byDay ?? []).map((d: any) => [d.day, d.impressions, d.engagement])];
			const csv = rows.map((r) => r.join(',')).join('\n');
			const blob = new Blob([csv], { type: 'text/csv' });
			const a = document.createElement('a');
			a.href = URL.createObjectURL(blob);
			a.download = `gurusocial-report-${new Date().toISOString().slice(0, 10)}.csv`;
			a.click();
			toast('Report exported as CSV.');
		} catch (e: any) {
			toast(e.message, 'error');
		}
	}
</script>

<div>
	<div class="mb-6 flex flex-wrap items-end justify-between gap-3">
		<div>
			<h1 class="text-2xl font-black tracking-tight text-white">Analytics</h1>
			<p class="mt-1 text-sm text-slate-400">Unified, per-platform performance with competitor benchmarks — every metric optional per network, like the best APIs report them.</p>
		</div>
		<div class="flex gap-2">
			<select class="input w-auto" bind:value={days} onchange={() => ((loading = true), load())}>
				<option value={7}>Last 7 days</option>
				<option value={30}>Last 30 days</option>
				<option value={90}>Last 90 days</option>
			</select>
			<button class="btn btn-ghost" onclick={exportCsv}>↓ Export CSV</button>
		</div>
	</div>

	{#if loading}
		<div class="grid animate-pulse gap-4 sm:grid-cols-2 lg:grid-cols-4">{#each Array(4) as _}<div class="card h-24"></div>{/each}</div>
	{:else}
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
			<StatCard label="Impressions" value={(overview?.totals.impressions ?? 0).toLocaleString()} />
			<StatCard label="Reach" value={(overview?.totals.reach ?? 0).toLocaleString()} />
			<StatCard label="Saves" value={(overview?.totals.saves ?? 0).toLocaleString()} hint="high-intent signal" />
			<StatCard label="Clicks" value={(overview?.totals.clicks ?? 0).toLocaleString()} />
		</div>

		<div class="mt-4 flex flex-wrap gap-2">
			{#each METRICS as [key, label]}
				<button class={`chip border ${metric === key ? 'border-guru-500 bg-guru-600/25 text-white' : 'border-ink-600 bg-ink-800 text-slate-400'}`} onclick={() => (metric = key)}>{label}</button>
			{/each}
		</div>

		<div class="card mt-4 p-5">
			<h3 class="mb-2 text-sm font-bold text-white">{METRICS.find((m) => m[0] === metric)?.[1]} over time</h3>
			<AreaChart points={points} height={220} color={metric === 'impressions' ? '#6366f1' : '#34d399'} />
		</div>

		<div class="mt-4 grid gap-4 lg:grid-cols-3">
			<div class="card p-5">
				<h3 class="mb-4 text-sm font-bold text-white">By platform</h3>
				<BarList rows={platformRows} />
			</div>
			<div class="card p-5">
				<h3 class="mb-3 text-sm font-bold text-white">Audience growth</h3>
				{#each Object.entries(overview?.followers ?? {} as Record<string, { followers: number }>) as [platform, f]: [string, any]}
					<div class="mb-2 flex items-center justify-between text-xs">
						<span class="flex items-center gap-1.5 text-slate-300"><PlatformBadge platform={platform} size="sm" /> {platform}</span>
						<span class="font-bold tabular-nums text-white">{(f as { followers: number }).followers.toLocaleString()}</span>
					</div>
				{/each}
				<p class="mt-3 text-[10px] text-slate-600">Follower snapshots capture every 5 days. Per-network figures appear only when that network reports them.</p>
			</div>
			<div class="card p-5">
				<h3 class="mb-3 text-sm font-bold text-white">Competitor benchmarks</h3>
				{#each competitors as c: any}
					<div class="mb-3 rounded-xl border border-ink-600 p-3">
						<div class="flex items-center justify-between">
							<span class="text-sm font-bold text-white">{c.name}</span>
							<PlatformBadge platform={c.platform} size="sm" />
						</div>
						<p class="mt-1 text-xs text-slate-500">{c.followers.toLocaleString()} followers · {c.postsPerWeek}/wk · {c.engagementRate}% engagement</p>
					</div>
				{:else}
					<p class="text-sm text-slate-500">Add competitors on their channels to benchmark your numbers.</p>
				{/each}
			</div>
		</div>

		<div class="card mt-4 p-5">
			<h3 class="mb-3 text-sm font-bold text-white">Top posts by {METRICS.find((m) => m[0] === metric)?.[1]?.toLowerCase()}</h3>
			{#each topPosts as p: any}
				<div class="mb-2 flex items-center gap-3 rounded-xl p-2 hover:bg-ink-700/30">
					{#each p.platforms.slice(0, 4) as plat}<PlatformBadge platform={plat} size="sm" />{/each}
					<span class="line-clamp-1 flex-1 text-xs text-slate-300">{p.content}</span>
					<span class="text-sm font-bold tabular-nums text-white">{p.metricValue.toLocaleString()}</span>
				</div>
			{/each}
		</div>
	{/if}
</div>
