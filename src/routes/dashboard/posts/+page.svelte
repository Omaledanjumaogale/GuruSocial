<script lang="ts">
	import { data, session } from '$lib/data';
	import PlatformBadge from '$lib/components/PlatformBadge.svelte';
	import StatusPill from '$lib/components/StatusPill.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import { toast } from '$lib/stores/toast';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	const FILTERS = [
		{ key: 'all', label: 'All' },
		{ key: 'draft', label: 'Drafts' },
		{ key: 'pending_approval', label: 'Awaiting approval' },
		{ key: 'approved', label: 'Approved' },
		{ key: 'scheduled', label: 'Scheduled' },
		{ key: 'published', label: 'Published' },
		{ key: 'failed', label: 'Failed' }
	];

	let filter = $state('all');
	let search = $state('');
	let posts = $state<any[]>([]);
	let loading = $state(true);
	let approveNote = $state('');
	let approveTarget = $state<any>(null);

	async function load() {
		posts = await data.posts.list($session.token!);
		loading = false;
	}
	onMount(load);

	const visible = $derived(
		posts.filter((p) => {
			if (filter !== 'all' && p.status !== filter) return false;
			if (search && !p.content.toLowerCase().includes(search.toLowerCase())) return false;
			return true;
		})
	);

	async function approve(p: any, ok: boolean) {
		await data.posts.approve($session.token!, p._id, ok, approveNote || undefined);
		approveNote = '';
		approveTarget = null;
		toast(ok ? 'Post approved — it can now be scheduled.' : 'Changes requested.');
		await load();
	}

	async function schedulePost(p: any) {
		const when = await data.posts.nextFreeSlot($session.token!);
		await data.posts.update($session.token!, p._id, { status: 'scheduled', scheduledAt: when as any });
		toast('Scheduled into the next free queue slot.');
		await load();
	}
</script>

<div>
	<div class="mb-6 flex flex-wrap items-end justify-between gap-3">
		<div>
			<h1 class="text-2xl font-black tracking-tight text-white">Posts & approvals</h1>
			<p class="mt-1 text-sm text-slate-400">Every piece of content in the pipeline — drafts, approvals, schedule and per-platform delivery results.</p>
		</div>
		<a href="/dashboard/composer" class="btn btn-primary">✦ Compose</a>
	</div>

	<div class="mb-4 flex flex-wrap items-center gap-2">
		{#each FILTERS as f}
			<button class={`chip border ${filter === f.key ? 'border-guru-500 bg-guru-600/25 text-white' : 'border-ink-600 bg-ink-800 text-slate-400'}`} onclick={() => (filter = f.key)}>{f.label}</button>
		{/each}
		<input class="input ml-auto max-w-56" bind:value={search} placeholder="Search content…" />
	</div>

	{#if loading}
		<div class="space-y-3">{#each Array(4) as _}<div class="card h-24 animate-pulse"></div>{/each}</div>
	{:else if !visible.length}
		<EmptyState icon="▤" title="No posts here yet" message="Create your first AI-assisted post in the composer, or let the Reverse Studio generate one from any URL." actionLabel="Open composer" onAction={() => goto('/dashboard/composer')} />
	{:else}
		<div class="space-y-3">
			{#each visible as p}
				<div class="card p-4">
					<div class="flex flex-wrap items-start justify-between gap-3">
						<div class="min-w-0 flex-1">
							<div class="mb-1.5 flex flex-wrap items-center gap-2">
								{#each p.platforms as plat}<PlatformBadge platform={plat} size="sm" />{/each}
								<StatusPill status={p.status} />
								{#if p.generatedBy && p.generatedBy !== 'manual'}
									<span class="chip bg-guru-600/15 text-[10px] text-guru-400">✦ {p.generatedBy}</span>
								{/if}
								<span class="text-[10px] text-slate-500">
									{p.publishedAt ? 'Published ' + new Date(p.publishedAt).toLocaleString() : p.scheduledAt ? 'Scheduled ' + new Date(p.scheduledAt).toLocaleString() : 'Created ' + new Date(p.createdAt).toLocaleString()}
								</span>
							</div>
							<p class="line-clamp-2 text-sm leading-relaxed text-slate-200">{p.content}</p>
							{#if p.perPlatformResults?.length}
								<div class="mt-2 flex flex-wrap gap-1.5">
									{#each p.perPlatformResults as r}
										<span class={`chip text-[10px] ${r.status === 'published' ? 'bg-mint-500/15 text-mint-400' : r.status === 'delete_requested' ? 'bg-slate-600/20 text-slate-400' : 'bg-amber-500/15 text-amber-300'}`}>
											{r.platform}: {r.status}
										</span>
									{/each}
								</div>
							{/if}
						</div>
						<div class="flex shrink-0 flex-wrap gap-2">
							{#if p.status === 'pending_approval'}
								<button class="btn btn-ghost px-3 py-1.5 text-xs" onclick={() => (approveTarget = p)}>Review</button>
							{:else if p.status === 'approved'}
								<button class="btn btn-primary px-3 py-1.5 text-xs" onclick={() => schedulePost(p)}>Queue it</button>
							{:else if p.status === 'draft'}
								<button class="btn btn-primary px-3 py-1.5 text-xs" onclick={() => schedulePost(p)}>Queue it</button>
							{:else if p.status === 'scheduled'}
								<button class="btn btn-ghost px-3 py-1.5 text-xs" onclick={() => (approveTarget = p)}>Details</button>
							{/if}
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<!-- Approval / detail modal -->
{#if approveTarget}
	<div class="fixed inset-0 z-50 grid place-items-center bg-black/60 p-6" role="presentation" onclick={(e) => e.target === e.currentTarget && (approveTarget = null)} onkeydown={(e) => e.key === "Escape" && (approveTarget = null)}>
		<div class="card w-full max-w-lg p-5">
			<h2 class="text-base font-bold text-white">Review post</h2>
			<p class="mt-3 whitespace-pre-wrap rounded-xl bg-ink-900 p-4 text-sm text-slate-200">{approveTarget.content}</p>
			<div class="mt-3 flex items-center gap-2">
				{#each approveTarget.platforms as plat}<PlatformBadge platform={plat} size="sm" />{/each}
				<StatusPill status={approveTarget.status} />
			</div>
			<textarea class="input mt-3" bind:value={approveNote} placeholder="Optional note for the requester…" rows="2"></textarea>
			<div class="mt-4 flex justify-between gap-2">
				<button class="btn btn-danger" onclick={() => { data.posts.remove($session.token!, approveTarget._id).then(load); approveTarget = null; }}>Delete</button>
				<div class="flex gap-2">
					<button class="btn btn-ghost" onclick={() => approve(approveTarget, false)}>Request changes</button>
					<button class="btn btn-primary" onclick={() => approve(approveTarget, true)}>Approve</button>
				</div>
			</div>
		</div>
	</div>
{/if}
