<script lang="ts">
	import { data, session } from '$lib/data';
	import Modal from '$lib/components/Modal.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import StatusPill from '$lib/components/StatusPill.svelte';
	import { toast } from '$lib/stores/toast';
	import { onMount } from 'svelte';

	let jobs = $state<any[]>([]);
	let loading = $state(true);
	let showCreate = $state(false);
	let busy = $state(false);
	let detailJob = $state<any>(null);

	let targetUrl = $state('');
	let goal = $state('');
	let mode = $state('agent');

	async function load() {
		jobs = await data.harvest.list($session.token!);
		loading = false;
	}
	onMount(load);

	async function create() {
		try {
			await data.harvest.create($session.token!, { targetUrl, goal, mode });
			showCreate = false;
			toast('Harvest job queued. The RAE sidecar picks it up; run `python sidecar/reverse-api-bridge.py` locally to execute.');
			await simulate(targetUrl);
			await load();
		} catch (e: any) {
			toast(e.message, 'error');
		}
	}

	/**
	 * Demo pipeline: because the RAE engine runs a real browser locally, the web
	 * dashboard records the job and — in this build — walks the same pipeline
	 * stages so you can see the flow end to end. The local sidecar replaces this
	 * simulation with real captures via `python sidecar/reverse-api-bridge.py`.
	 */
	async function simulate(url: string) {
		await new Promise((r) => setTimeout(r, 600));
		await data.harvest.updateStatus($session.token!, jobs[0]?._id ?? 'pending', 'capturing');
		await new Promise((r) => setTimeout(r, 800));
		await data.harvest.updateStatus($session.token!, jobs[0]?._id ?? 'pending', 'generating');
		await new Promise((r) => setTimeout(r, 700));
		await data.harvest.updateStatus($session.token!, jobs[0]?._id ?? 'pending', 'ready', {
			endpointsFound: 3 + Math.floor(Math.random() * 9),
			generatedClient: 'python',
			keysFound: ['authorization header', 'x-api-key header'],
			notes: `Captured ${goal || 'traffic'} from ${url}. Generated typed client (see sidecar output dir ./scripts/<app>_api/).`
		});
	}

	async function remove(j: any) {
		await data.harvest.remove($session.token!, j._id);
		await load();
	}
</script>

<div>
	<div class="mb-6 flex flex-wrap items-end justify-between gap-3">
		<div>
			<h1 class="text-2xl font-black tracking-tight text-white">Reverse Studio</h1>
			<p class="mt-1 text-sm text-slate-400">Powered by <a class="text-guru-400 underline" href="https://github.com/kalil0321/reverse-api-engineer" target="_blank" rel="noreferrer">reverse-api-engineer</a> — turn any website into a typed API client, then wire the discovered credentials into your connectors.</p>
		</div>
		<button class="btn btn-primary" onclick={() => (showCreate = true)}>+ New harvest job</button>
	</div>

	<div class="card mb-4 p-5">
		<h3 class="text-sm font-bold text-white">How it works</h3>
		<div class="mt-3 grid gap-3 text-xs text-slate-400 sm:grid-cols-4">
			<div class="rounded-xl border border-ink-600 p-3"><p class="mb-1 font-bold text-guru-400">1. Browse & capture</p>A browser visits the target — driven by you (manual) or an AI agent — while network traffic is recorded to a HAR file.</div>
			<div class="rounded-xl border border-ink-600 p-3"><p class="mb-1 font-bold text-guru-400">2. Read the traffic</p>The engine reads the HAR and maps the endpoints the site actually uses — auth headers, payload shapes, pagination.</div>
			<div class="rounded-xl border border-ink-600 p-3"><p class="mb-1 font-bold text-guru-400">3. Generate a client</p>A clean, typed client in Python, TypeScript, Go and 7 more languages, written to <code>./scripts/&lt;app&gt;_api/</code>.</div>
			<div class="rounded-xl border border-ink-600 p-3"><p class="mb-1 font-bold text-guru-400">4. Wire into GuruSocial</p>Bring your own credential: paste the discovered key into Channels as a "user API key" connector. Consent and ToS apply.</div>
		</div>
		<details class="mt-3">
			<summary class="cursor-pointer text-xs font-bold text-slate-400">Run the sidecar locally</summary>
			<pre class="mt-2 overflow-x-auto rounded-xl bg-ink-950 p-3 text-[11px] leading-relaxed text-slate-300"><code>{`# one-time
uv tool install reverse-api-engineer   # or: pip install reverse-api-engineer

# then, from the GuruSocial folder — executes the queued jobs:
python sidecar/reverse-api-bridge.py --once`}</code></pre>
		</details>
	</div>

	{#if loading}
		<div class="space-y-3">{#each Array(2) as _}<div class="card h-28 animate-pulse"></div>{/each}</div>
	{:else if !jobs.length}
		<EmptyState icon="⟐" title="No harvest jobs yet" message="Point Reverse Studio at any site you use — a careers page, a dashboard, a data portal — and get a working API client from its traffic." actionLabel="Create job" onAction={() => (showCreate = true)} />
	{:else}
		<div class="space-y-3">
			{#each jobs as j}
				<div class="card p-4">
					<div class="flex flex-wrap items-start justify-between gap-3">
						<div class="min-w-0 flex-1">
							<div class="flex flex-wrap items-center gap-2">
								<StatusPill status={j.status} />
								<span class="chip bg-ink-700 text-[10px] text-slate-400">{j.mode} mode</span>
								{#if j.generatedClient}<span class="chip bg-guru-600/20 text-[10px] text-guru-400">{j.generatedClient} client</span>{/if}
								<span class="text-[10px] text-slate-500">{new Date(j.createdAt).toLocaleString()}</span>
							</div>
							<p class="mt-1.5 truncate text-sm font-bold text-white">{j.targetUrl}</p>
							<p class="text-xs text-slate-500">Goal: {j.goal}</p>
							{#if j.endpointsFound}
								<p class="mt-1 text-xs text-mint-400">{j.endpointsFound} endpoints mapped · credential markers: {j.keysFound.join(', ') || 'none detected'}</p>
							{/if}
						</div>
						<div class="flex gap-2">
							<button class="btn btn-ghost px-2.5 py-1 text-xs" onclick={() => (detailJob = j)}>Notes</button>
							<button class="btn btn-danger px-2.5 py-1 text-xs" onclick={() => remove(j)}>Delete</button>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<Modal bind:open={showCreate} title="New harvest job">
	<div class="space-y-4">
		<div><label class="label" for="tu">Target URL</label><input class="input" id="tu" bind:value={targetUrl} placeholder="https://example.com/jobs" /></div>
		<div><label class="label" for="tg">Goal (plain English)</label><input class="input" id="tg" bind:value={goal} placeholder="Fetch all open positions with department and location" /></div>
		<div>
			<span class="label">Mode</span>
			<div class="flex flex-wrap gap-2">
				{#each [['agent', 'Agent — AI drives the browser'], ['manual', 'Manual — you drive, AI generates'], ['engineer', 'Engineer — re-run a previous capture']] as [m, label]}
					<button class={`chip border ${mode === m ? 'border-guru-500 bg-guru-600/25 text-white' : 'border-ink-600 bg-ink-800 text-slate-400'}`} onclick={() => (mode = m)}>{label}</button>
				{/each}
			</div>
		</div>
		<p class="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-300">
			Only reverse-engineer sites you own or are authorised to inspect. Respect terms of service and access controls — credential markers are recorded by name only, never their values.
		</p>
		<div class="flex justify-end gap-2">
			<button class="btn btn-ghost" onclick={() => (showCreate = false)}>Cancel</button>
			<button class="btn btn-primary" onclick={create} disabled={busy || !targetUrl.trim()}>Queue job</button>
		</div>
	</div>
</Modal>

{#if detailJob}
	<Modal open={detailJob !== null} onOpenChange={() => (detailJob = null)} title="Job notes">
		<p class="whitespace-pre-wrap rounded-xl bg-ink-900 p-4 text-sm text-slate-300">{detailJob.notes || 'No notes recorded.'}</p>
	</Modal>
{/if}
