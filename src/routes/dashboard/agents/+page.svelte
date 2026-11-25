<script lang="ts">
	import { data, session } from '$lib/data';
	import PlatformBadge from '$lib/components/PlatformBadge.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import { toast } from '$lib/stores/toast';
	import { onMount } from 'svelte';

	let automations = $state<any[]>([]);
	let runs = $state<any[]>([]);
	let loading = $state(true);
	let showCreate = $state(false);
	let testItem = $state<any>(null);
	let testResult = $state('');

	const KINDS = [
		{ key: 'dm_reply', label: 'DM auto-reply', hint: 'Reply to direct messages that match your trigger keywords.' },
		{ key: 'comment_reply', label: 'Comment auto-reply', hint: 'Reply to comments on your posts within the platform window.' },
		{ key: 'keyword_trigger', label: 'Keyword trigger', hint: 'Fire an action whenever a keyword appears anywhere.' },
		{ key: 'content_pipeline', label: 'Content pipeline', hint: 'Auto-draft posts from a feed, URL or research source.' },
		{ key: 'best_time_requeue', label: 'Best-time requeue', hint: 'Reschedule posts that miss their slot into the next best time.' }
	];

	// New automation form
	let name = $state('');
	let kind = $state('dm_reply');
	let platforms = $state<string[]>(['instagram']);
	let triggerType = $state('keyword');
	let keywords = $state('');
	let responseTemplate = $state('');
	let usesAi = $state(true);

	async function load() {
		[automations, runs] = await Promise.all([data.automations.list($session.token!), data.automations.agentRuns($session.token!, 12)]);
		loading = false;
	}
	onMount(load);

	async function create() {
		try {
			await data.automations.create($session.token!, {
				name,
				kind,
				platforms,
				triggerType,
				keywords: keywords.split(',').map((k) => k.trim()).filter(Boolean),
				responseTemplate,
				usesAi
			});
			showCreate = false;
			toast('Automation created. It runs against matching inbox items.');
			await load();
		} catch (e: any) {
			toast(e.message, 'error');
		}
	}

	async function testRun(a: any) {
		const items = await data.inbox.list($session.token!, { status: 'unread' });
		const match = items.find((i: any) => a.platforms.includes(i.platform));
		if (!match) {
			toast('No unread inbox item on that platform to test against. Connect a channel first.', 'info');
			return;
		}
		const { matched, reply } = await data.automations.run($session.token!, a._id, match._id);
		testItem = a;
		testResult = matched ? reply : 'No inbox item matched the trigger keywords. Nothing was sent.';
		await load();
	}
</script>

<div>
	<div class="mb-6 flex flex-wrap items-end justify-between gap-3">
		<div>
			<h1 class="text-2xl font-black tracking-tight text-white">AI agents & automations</h1>
			<p class="mt-1 text-sm text-slate-400">Keyword-triggered auto-replies inside platform windows, content pipelines and requeue rules. Every run is logged.</p>
		</div>
		<button class="btn btn-primary" onclick={() => (showCreate = true)}>+ New automation</button>
	</div>

	{#if loading}
		<div class="grid gap-4 lg:grid-cols-2">{#each Array(2) as _}<div class="card h-40 animate-pulse"></div>{/each}</div>
	{:else}
		<div class="grid gap-4 lg:grid-cols-2">
			{#each automations as a}
				<div class="card p-5">
					<div class="flex items-start justify-between gap-3">
						<div>
							<h3 class="text-sm font-bold text-white">{a.name}</h3>
							<p class="mt-1 text-xs text-slate-500">{KINDS.find((k) => k.key === a.kind)?.label ?? a.kind}{a.usesAi ? ' · ✦ AI-assisted' : ' · template'}</p>
						</div>
						<button
							class={`chip ${a.enabled ? 'bg-mint-500/20 text-mint-400' : 'bg-ink-700 text-slate-500'}`}
							onclick={() => data.automations.toggle($session.token!, a._id, !a.enabled).then(load)}
						>{a.enabled ? '● running' : '○ paused'}</button>
					</div>
					<div class="mt-2 flex flex-wrap gap-1.5">
						{#each a.platforms as p}<span class="chip bg-ink-700 text-[10px] text-slate-300"><PlatformBadge platform={p} size="sm" /> {p}</span>{/each}
					</div>
					<div class="mt-3 rounded-xl bg-ink-900 p-3">
						<p class="text-[10px] font-bold uppercase tracking-widest text-slate-500">Trigger</p>
						<p class="mt-0.5 text-xs text-slate-300">{a.trigger.type}{a.trigger.keywords?.length ? ': ' + a.trigger.keywords.map((k: string) => `"${k}"`).join(', ') : ''}</p>
						<p class="mt-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">Response</p>
						<p class="mt-0.5 text-xs text-slate-300">{a.responseTemplate}</p>
					</div>
					<div class="mt-3 flex items-center justify-between">
						<span class="text-xs text-slate-500">{a.runs} runs</span>
						<div class="flex gap-2">
							<button class="btn btn-ghost px-2.5 py-1 text-xs" onclick={() => testRun(a)}>Test run</button>
							<button class="btn btn-danger px-2.5 py-1 text-xs" onclick={() => data.automations.remove($session.token!, a._id).then(load)}>Delete</button>
						</div>
					</div>
				</div>
			{:else}
				<EmptyState icon="⚙" title="No automations yet" message="Create your first ManyChat-style keyword auto-reply: 'hi', 'pricing', 'guide' — it answers while you sleep." actionLabel="Create automation" onAction={() => (showCreate = true)} />
			{/each}
		</div>

		<div class="card mt-4 p-5">
			<h3 class="mb-3 text-sm font-bold text-white">Agent run log</h3>
			{#each runs as r}
				<div class="mb-2 rounded-xl border border-ink-600 p-3">
					<div class="flex items-center justify-between text-xs">
						<span class="font-bold text-white">{r.agent} agent</span>
						<span class="chip bg-mint-500/15 text-[10px] text-mint-400">{r.status}</span>
					</div>
					<p class="mt-1 text-xs text-slate-500">in: {r.input}</p>
					<p class="text-xs text-slate-300">out: {r.output}</p>
				</div>
			{:else}
				<p class="text-sm text-slate-500">No runs yet — use "Test run" on an automation.</p>
			{/each}
		</div>
	{/if}
</div>

<Modal bind:open={showCreate} title="New automation" wide>
	<div class="space-y-4">
		<div class="grid gap-4 sm:grid-cols-2">
			<div>
				<label class="label" for="an">Name</label>
				<input class="input" id="an" bind:value={name} placeholder="Pricing question auto-reply" />
			</div>
			<div>
				<span class="label">Kind</span>
				<select class="input" bind:value={kind}>
					{#each KINDS as k}<option value={k.key}>{k.label} — {k.hint}</option>{/each}
				</select>
			</div>
		</div>
		<div>
			<span class="label">Platforms</span>
			<div class="flex flex-wrap gap-2">
				{#each ['instagram', 'facebook', 'linkedin', 'x', 'youtube', 'threads', 'telegram'] as p}
					<button class={`chip border ${platforms.includes(p) ? 'border-guru-500 bg-guru-600/25 text-white' : 'border-ink-600 bg-ink-800 text-slate-400'}`} onclick={() => (platforms = platforms.includes(p) ? platforms.filter((x) => x !== p) : [...platforms, p])}>
						<PlatformBadge platform={p} size="sm" /> {p}
					</button>
				{/each}
			</div>
		</div>
		<div class="grid gap-4 sm:grid-cols-2">
			<div>
				<span class="label">Trigger</span>
				<select class="input" bind:value={triggerType}>
					<option value="keyword">Keyword match</option>
					<option value="any">Any message</option>
				</select>
			</div>
			<div>
				<label class="label" for="kw">Keywords (comma separated)</label>
				<input class="input" id="kw" bind:value={keywords} placeholder="price, pricing, cost, guide" />
			</div>
		</div>
		<div>
			<label class="label" for="rt">Response template</label>
			<textarea class="input min-h-24" id="rt" bind:value={responseTemplate} placeholder={"Hi {{fromUser}}! Thanks for reaching out — here is the link to our guide…"}></textarea>
			<p class="mt-1 text-xs text-slate-600">{"{{fromUser}}"} is replaced with the sender's name. AI-assisted rows polish the template per conversation.</p>
		</div>
		<label class="flex items-center gap-2 text-sm text-slate-300">
			<input type="checkbox" bind:checked={usesAi} class="accent-indigo-500" />
			✦ AI-assisted reply
		</label>
		<div class="flex justify-end gap-2">
			<button class="btn btn-ghost" onclick={() => (showCreate = false)}>Cancel</button>
			<button class="btn btn-primary" onclick={create}>Create automation</button>
		</div>
	</div>
</Modal>

{#if testItem}
	<Modal open={testItem !== null} onOpenChange={() => (testItem = null)} title={`Test result — ${testItem.name}`}>
		<p class="rounded-xl bg-ink-900 p-4 text-sm text-slate-200">{testResult}</p>
	</Modal>
{/if}
