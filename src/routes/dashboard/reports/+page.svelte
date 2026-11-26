<script lang="ts">
	import { data, session } from '$lib/data';
	import { toast } from '$lib/stores/toast';
	import { onMount } from 'svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import StatCard from '$lib/components/StatCard.svelte';
	import AreaChart from '$lib/components/AreaChart.svelte';
	import PlatformBadge from '$lib/components/PlatformBadge.svelte';

	let days = $state(30);
	let overview = $state<any>(null);
	let topPosts = $state<any[]>([]);
	let audience = $state<any[]>([]);
	let loading = $state(true);
	let generatedAt = $state<number | null>(null);

	async function load() {
		if (!$session.token) return;
		loading = true;
		try {
			[overview, topPosts, audience] = await Promise.all([
				data.analytics.overview($session.token, days),
				data.analytics.topPosts($session.token, 'impressions', 8),
				data.analytics.audience($session.token)
			]);
			generatedAt = Date.now();
		} catch (e: any) {
			toast(e.message, 'error');
		} finally {
			loading = false;
		}
	}

	function rangeLabel() {
		return days === 7 ? 'Last 7 days' : days === 90 ? 'Last 90 days' : 'Last 30 days';
	}

	const totals = $derived(overview?.totals ?? null);
	const engagementRate = $derived.by(() => {
		if (!totals) return '—';
		const engaged = totals.likes + totals.comments + totals.shares + totals.saves;
		return totals.impressions ? ((engaged / totals.impressions) * 100).toFixed(2) + '%' : '0.00%';
	});
	const platforms = $derived(
		[...(overview?.byPlatform ?? [])].sort((a: any, b: any) => b.impressions - a.impressions)
	);
	const points = $derived((overview?.byDay ?? []).map((d: any) => ({ v: d.impressions })));
	const followerRows = $derived(
		Object.entries((overview?.followers ?? {}) as Record<string, { followers: number }>).sort(
			(a, b) => b[1].followers - a[1].followers
		)
	);

	function download(filename: string, content: string, type: string) {
		const blob = new Blob([content], { type });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		a.click();
		URL.revokeObjectURL(url);
	}

	function exportCsv() {
		if (!overview) return;
		const lines: string[][] = [
			['GuruSocial report', rangeLabel(), new Date().toISOString()],
			[],
			['metric', 'value'],
			['impressions', String(totals.impressions)],
			['reach', String(totals.reach)],
			['likes', String(totals.likes)],
			['comments', String(totals.comments)],
			['shares', String(totals.shares)],
			['saves', String(totals.saves)],
			['clicks', String(totals.clicks)],
			['engagement_rate', engagementRate],
			[],
			['platform', 'impressions', 'reach', 'engagement', 'posts'],
			...platforms.map((p: any) => [p.platform, String(p.impressions), String(p.reach), String(p.engagement), String(p.posts)]),
			[],
			['date', 'impressions', 'engagement'],
			...(overview.byDay ?? []).map((d: any) => [d.day, String(d.impressions), String(d.engagement)])
		];
		const csv = lines.map((row) => row.map((cell) => (/[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell)).join(',')).join('\n');
		download(`gurusocial-report-${new Date().toISOString().slice(0, 10)}.csv`, csv, 'text/csv');
		toast('Report exported as CSV.');
	}

	onMount(load);
</script>

<PageHeader
	eyebrow="Intelligence"
	title="Reports"
	description="A shareable performance report built from the same numbers the dashboards use: totals, per-platform delivery and your best-performing posts."
>
	<select class="input w-auto py-2 text-xs" bind:value={days} onchange={load}>
		<option value={7}>Last 7 days</option>
		<option value={30}>Last 30 days</option>
		<option value={90}>Last 90 days</option>
	</select>
	<button class="btn btn-ghost btn-sm" onclick={exportCsv} disabled={!overview}>↓ CSV</button>
	<button class="btn btn-ghost btn-sm" onclick={() => window.print()} disabled={!overview}>⎙ Print / PDF</button>
	<button class="btn btn-primary btn-sm" onclick={load} disabled={loading}>{loading ? 'Building…' : 'Refresh'}</button>
</PageHeader>

{#if loading && !overview}
	<div class="grid animate-pulse gap-4 sm:grid-cols-2 lg:grid-cols-4">
		{#each Array(4) as _}<div class="card h-24"></div>{/each}
	</div>
{:else if overview}
	<section class="card p-6">
		<div class="flex flex-wrap items-start justify-between gap-4 border-b border-ink-800 pb-5">
			<div>
				<p class="eyebrow">GuruSocial · workspace report</p>
				<h2 class="font-display text-xl font-semibold text-white">{$session.user?.name ?? 'Workspace'}</h2>
				<p class="mt-1 text-xs text-slate-500">
					{rangeLabel()} · {platforms.length} platforms reporting · generated {generatedAt ? new Date(generatedAt).toLocaleString() : '—'}
				</p>
			</div>
			<div class="text-right">
				<p class="eyebrow">Engagement rate</p>
				<p class="metric">{engagementRate}</p>
			</div>
		</div>

		<div class="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
			<StatCard label="Impressions" value={(totals.impressions ?? 0).toLocaleString()} />
			<StatCard label="Reach" value={(totals.reach ?? 0).toLocaleString()} />
			<StatCard label="Clicks" value={(totals.clicks ?? 0).toLocaleString()} hint="traffic driven" />
			<StatCard label="Saves" value={(totals.saves ?? 0).toLocaleString()} hint="high-intent signal" />
		</div>

		<div class="mt-5">
			<p class="section-title mb-2">Impressions over time</p>
			<AreaChart {points} height={200} color="#6366f1" />
		</div>
	</section>

	<div class="mt-4 grid gap-4 lg:grid-cols-5">
		<section class="card p-5 lg:col-span-3">
			<h2 class="section-title mb-3">Per-platform performance</h2>
			<div class="table-wrap">
				<table class="w-full text-left text-sm">
					<thead class="border-b border-ink-800 text-2xs uppercase tracking-wider text-slate-500">
						<tr>
							<th class="py-2 font-semibold">Platform</th>
							<th class="py-2 text-right font-semibold">Impressions</th>
							<th class="py-2 text-right font-semibold">Reach</th>
							<th class="py-2 text-right font-semibold">Engagement</th>
							<th class="py-2 text-right font-semibold">Posts</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-ink-800">
						{#each platforms as p: any}
							<tr>
								<td class="py-2.5">
									<span class="flex items-center gap-2 text-slate-200">
										<PlatformBadge platform={p.platform} size="sm" /> {p.platform}
									</span>
								</td>
								<td class="py-2.5 text-right tabular text-slate-200">{p.impressions.toLocaleString()}</td>
								<td class="py-2.5 text-right tabular text-slate-400">{p.reach.toLocaleString()}</td>
								<td class="py-2.5 text-right tabular text-slate-400">{p.engagement.toLocaleString()}</td>
								<td class="py-2.5 text-right tabular text-slate-400">{p.posts}</td>
							</tr>
						{:else}
							<tr><td colspan="5" class="py-6 text-center text-slate-500">No activity in this window.</td></tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>

		<section class="card p-5 lg:col-span-2">
			<h2 class="section-title mb-3">Audience</h2>
			{#each followerRows as [platform, row]}
				<div class="mb-2 flex items-center justify-between text-sm">
					<span class="flex items-center gap-2 text-slate-300"><PlatformBadge platform={platform} size="sm" /> {platform}</span>
					<span class="font-semibold tabular text-white">{row.followers.toLocaleString()}</span>
				</div>
			{:else}
				<p class="prose-line">Connect a channel to capture audience snapshots.</p>
			{/each}
			<p class="mt-3 text-2xs text-slate-600">
				Snapshots are captured every few days per network. Figures appear only for platforms that report them.
			</p>
		</section>
	</div>

	<section class="card mt-4 p-5">
		<h2 class="section-title mb-3">Top posts by impressions</h2>
		<ol class="divide-y divide-ink-800">
			{#each topPosts as post, index}
				<li class="flex items-center gap-3 py-2.5">
					<span class="w-5 text-xs font-semibold tabular text-slate-600">{index + 1}</span>
					<span class="flex shrink-0 gap-1">
						{#each post.platforms.slice(0, 3) as platform}<PlatformBadge {platform} size="sm" />{/each}
					</span>
					<span class="line-clamp-1 flex-1 text-sm text-slate-300">{post.content}</span>
					<span class="text-sm font-semibold tabular text-white">{post.metricValue.toLocaleString()}</span>
				</li>
			{:else}
				<li class="py-6 text-center text-sm text-slate-500">Publish a post to see the ranking.</li>
			{/each}
		</ol>
	</section>

	<p class="mt-4 text-2xs leading-relaxed text-slate-600">
		Reports are generated in your browser from backend queries. Scheduled email delivery is handled by the operator team
		once Resend delivery is enabled for your plan — nothing is emailed from this page.
	</p>
{/if}
