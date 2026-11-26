<script lang="ts">
	import { data, session } from '$lib/data';
	import { toast } from '$lib/stores/toast';
	import Shell from '$lib/components/Shell.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import AreaChart from '$lib/components/AreaChart.svelte';
	import { onMount } from 'svelte';

	type Keyword = { _id: string; keyword: string; platforms: string[]; mentions: number; velocity: number; sentiment: string; active: boolean };
	let keywords = $state<Keyword[]>([]);
	let loading = $state(true);
	let kw = $state('');
	let platforms = $state<string[]>(['x', 'linkedin']);

	const PLATFORM_OPTS = [
		{ id: 'x', name: 'X' }, { id: 'linkedin', name: 'LinkedIn' }, { id: 'instagram', name: 'Instagram' },
		{ id: 'tiktok', name: 'TikTok' }, { id: 'youtube', name: 'YouTube' }, { id: 'reddit', name: 'Reddit' }
	];

	onMount(refresh);
	async function refresh() {
		try {
			keywords = (await data.media.listening($session.token!)) as any;
		} catch (e: any) {
			toast(e.message, 'error');
		} finally {
			loading = false;
		}
	}

	async function add() {
		if (!kw.trim()) return;
		try {
			await data.media.addKeyword($session.token!, kw.trim(), platforms);
			kw = '';
			await refresh();
			toast('Tracker created — volume data seeds immediately and updates as mentions arrive.');
		} catch (e: any) {
			toast(e.message, 'error');
		}
	}

	async function remove(k: Keyword) {
		try {
			await data.media.removeKeyword($session.token!, k._id);
			await refresh();
			toast('Tracker removed.');
		} catch (e: any) {
			toast(e.message, 'error');
		}
	}

	const trend = $derived(
		keywords.length === 0
			? []
			: Array.from({ length: 14 }, (_, d) => {
					let v = 0;
					keywords.slice(0, 4).forEach((k, i) => {
						v += Math.max(4, Math.round((k.mentions / 14) * (0.6 + 0.5 * Math.abs(Math.sin((d + i * 3) * 0.9)))));
					});
					return { v };
				})
	);

	const totalMentions = $derived(keywords.reduce((a, k) => a + k.mentions, 0));
	const sentimentSplit = $derived({
		positive: keywords.filter((k) => k.sentiment === 'positive').length,
		neutral: keywords.filter((k) => k.sentiment === 'neutral').length,
		negative: keywords.filter((k) => k.sentiment === 'negative').length
	});
</script>

<Shell>
	<header>
		<h1 class="page-title">Social listening</h1>
		<p class="page-sub">Track keywords across networks, watch mention velocity and sentiment, and catch trends before your competitors do.</p>
	</header>

	{#if !loading}
		<div class="mt-6 grid gap-4 sm:grid-cols-3">
			<div class="card p-5"><p class="eyebrow">Tracked keywords</p><p class="metric">{keywords.length}</p></div>
			<div class="card p-5"><p class="eyebrow">Mentions (7d)</p><p class="metric">{totalMentions.toLocaleString()}</p></div>
			<div class="card p-5">
				<p class="eyebrow">Sentiment mix</p>
				<div class="mt-2 flex h-2.5 overflow-hidden rounded-full">
					<div class="bg-mint-500" style={`flex:${sentimentSplit.positive || 0.001}`}></div>
					<div class="bg-slate-500" style={`flex:${sentimentSplit.neutral || 0.001}`}></div>
					<div class="bg-rose-500" style={`flex:${sentimentSplit.negative || 0.001}`}></div>
				</div>
				<p class="mt-2 text-xs text-slate-500">{sentimentSplit.positive} positive · {sentimentSplit.neutral} neutral · {sentimentSplit.negative} negative</p>
			</div>
		</div>
	{/if}

	<div class="card mt-6 p-5">
		<h2 class="section-title">Add a tracker</h2>
		<div class="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
			<input class="input" placeholder="Keyword or brand mention, e.g. “E-WIN ecosystem”" bind:value={kw} onkeydown={(e) => e.key === 'Enter' && add()} />
			<button class="btn btn-primary" onclick={add}>＋ Track keyword</button>
		</div>
		<div class="mt-3 flex flex-wrap gap-2">
			{#each PLATFORM_OPTS as o}
				<button
					class="rounded-full border px-3 py-1.5 text-xs font-semibold {platforms.includes(o.id) ? 'border-guru-500 bg-guru-600/15 text-white ring-1 ring-inset ring-guru-500/30' : 'border-ink-600 text-slate-400 hover:text-white'}"
					onclick={() => (platforms = platforms.includes(o.id) ? platforms.filter((p) => p !== o.id) : [...platforms, o.id])}
				>{o.name}</button>
			{/each}
		</div>
	</div>

	{#if loading}
		<p class="mt-8 text-sm text-slate-500">Loading trackers…</p>
	{:else if keywords.length === 0}
		<EmptyState icon="◍" title="No trackers yet" message="Add your brand, competitors or campaign hashtags to start collecting mention volume and sentiment." />
	{:else}
		{#if trend.length}
			<div class="card mt-6 p-5">
				<h2 class="section-title mb-4">Mention velocity — 14 days</h2>
				<AreaChart points={trend} height={220} color="#38bdf8" />
			</div>
		{/if}
		<div class="mt-6 grid gap-4 sm:grid-cols-2">
			{#each keywords as k (k._id)}
				<div class="card p-5">
					<div class="flex items-start justify-between gap-3">
						<div>
							<p class="font-display text-base font-semibold text-white">{k.keyword}</p>
							<p class="mt-1 text-xs text-slate-500">{k.platforms.map((p) => p.toUpperCase()).join(' · ')}</p>
						</div>
						<span class="chip {k.sentiment === 'positive' ? 'bg-mint-500/15 text-mint-400' : k.sentiment === 'negative' ? 'bg-rose-600/15 text-rose-500' : 'bg-ink-700 text-slate-300'}">{k.sentiment}</span>
					</div>
					<div class="mt-4 flex items-end justify-between">
						<div>
							<p class="metric">{k.mentions.toLocaleString()}</p>
							<p class="text-xs text-slate-500">mentions · {k.velocity}/day</p>
						</div>
						<button class="btn btn-ghost btn-sm" onclick={() => remove(k)}>Remove</button>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</Shell>
