<script lang="ts">
	import { data, session } from '$lib/data';
	import PlatformBadge from '$lib/components/PlatformBadge.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import { toast } from '$lib/stores/toast';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	let campaigns = $state<any[]>([]);
	let posts = $state<any[]>([]);
	let loading = $state(true);
	let showCreate = $state(false);

	let name = $state('');
	let goal = $state('awareness');
	let startDate = $state('');
	let endDate = $state('');
	let budget = $state(0);
	let cplatforms = $state<string[]>([]);

	async function load() {
		[campaigns, posts] = await Promise.all([data.crm.campaigns($session.token!), data.posts.list($session.token!)]);
		loading = false;
	}
	onMount(load);

	async function create() {
		try {
			await data.crm.createCampaign($session.token!, {
				name, goal, budget,
				startDate: new Date(startDate).getTime(),
				endDate: new Date(endDate).getTime(),
				platforms: cplatforms
			});
			showCreate = false;
			toast('Campaign created.');
			await load();
		} catch (e: any) {
			toast(e.message, 'error');
		}
	}

	function progress(c: any): number {
		const total = c.endDate - c.startDate;
		if (total <= 0) return 100;
		return Math.min(100, Math.max(0, ((Date.now() - c.startDate) / total) * 100));
	}
</script>

<div>
	<div class="mb-6 flex flex-wrap items-end justify-between gap-3">
		<div>
			<h1 class="text-2xl font-black tracking-tight text-white">Campaigns</h1>
			<p class="mt-1 text-sm text-slate-400">Group posts around goals — launches, evergreen series, seasonal pushes — and track each one's platforms and budget.</p>
		</div>
		<button class="btn btn-primary" onclick={() => (showCreate = true)}>+ New campaign</button>
	</div>

	{#if loading}
		<div class="grid gap-4 lg:grid-cols-2">{#each Array(2) as _}<div class="card h-44 animate-pulse"></div>{/each}</div>
	{:else if !campaigns.length}
		<EmptyState icon="◈" title="No campaigns yet" message="A campaign bundles posts across platforms under one goal and window — think 'Q1 launch' spanning Instagram, LinkedIn and X." actionLabel="Create campaign" onAction={() => (showCreate = true)} />
	{:else}
		<div class="grid gap-4 lg:grid-cols-2">
			{#each campaigns as c}
				<div class="card p-5">
					<div class="flex items-start justify-between">
						<div>
							<h3 class="text-base font-bold text-white">{c.name}</h3>
							<p class="text-xs text-slate-500">{new Date(c.startDate).toLocaleDateString()} → {new Date(c.endDate).toLocaleDateString()}{c.budget ? ` · $${Number(c.budget).toLocaleString()} budget` : ''}</p>
						</div>
						<span class="chip bg-guru-600/20 text-guru-400">{c.goal}</span>
					</div>
					<div class="mt-3 flex flex-wrap gap-1.5">
						{#each c.platforms as p}<span class="chip bg-ink-700 text-[10px] text-slate-300"><PlatformBadge platform={p} size="sm" /> {p}</span>{/each}
					</div>
					<div class="mt-3">
						<div class="mb-1 flex justify-between text-[10px] text-slate-500">
							<span>campaign window</span>
							<span>{Math.round(progress(c))}%</span>
						</div>
						<div class="h-1.5 overflow-hidden rounded-full bg-ink-700">
							<div class="h-full rounded-full bg-guru-500" style={`width:${progress(c)}%`}></div>
						</div>
					</div>
					<button class="btn btn-ghost mt-4 w-full" onclick={() => goto('/dashboard/posts')}>View related posts →</button>
				</div>
			{/each}
		</div>
	{/if}
</div>

<Modal bind:open={showCreate} title="New campaign">
	<div class="space-y-4">
		<div><label class="label" for="cn2">Name</label><input class="input" id="cn2" bind:value={name} placeholder="Q1 product launch" /></div>
		<div class="grid gap-4 sm:grid-cols-2">
			<div>
				<span class="label">Goal</span>
				<select class="input" bind:value={goal}>{#each ['awareness', 'engagement', 'traffic', 'leads', 'sales'] as g}<option value={g}>{g}</option>{/each}</select>
			</div>
			<div><label class="label" for="cb">Budget ($, optional)</label><input class="input" id="cb" type="number" bind:value={budget} /></div>
		</div>
		<div class="grid gap-4 sm:grid-cols-2">
			<div><label class="label" for="cs">Start</label><input class="input" id="cs" type="date" bind:value={startDate} /></div>
			<div><label class="label" for="ce">End</label><input class="input" id="ce" type="date" bind:value={endDate} /></div>
		</div>
		<div>
			<span class="label">Platforms</span>
			<div class="flex flex-wrap gap-2">
				{#each ['instagram', 'linkedin', 'x', 'facebook', 'tiktok', 'youtube', 'threads'] as p}
					<button class={`chip border ${cplatforms.includes(p) ? 'border-guru-500 bg-guru-600/25 text-white' : 'border-ink-600 bg-ink-800 text-slate-400'}`} onclick={() => (cplatforms = cplatforms.includes(p) ? cplatforms.filter((x) => x !== p) : [...cplatforms, p])}>
						<PlatformBadge platform={p} size="sm" /> {p}
					</button>
				{/each}
			</div>
		</div>
		<div class="flex justify-end gap-2">
			<button class="btn btn-ghost" onclick={() => (showCreate = false)}>Cancel</button>
			<button class="btn btn-primary" onclick={create}>Create campaign</button>
		</div>
	</div>
</Modal>
