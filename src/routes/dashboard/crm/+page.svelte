<script lang="ts">
	import { data, session } from '$lib/data';
	import PlatformBadge from '$lib/components/PlatformBadge.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import { toast } from '$lib/stores/toast';
	import { onMount } from 'svelte';

	const STAGES = [
		{ key: 'lead', label: 'Leads', color: '#64748b' },
		{ key: 'engaged', label: 'Engaged', color: '#6366f1' },
		{ key: 'opportunity', label: 'Opportunity', color: '#8b5cf6' },
		{ key: 'customer', label: 'Customer', color: '#22c55e' },
		{ key: 'advocate', label: 'Advocate', color: '#f59e0b' },
		{ key: 'lost', label: 'Lost', color: '#6b7280' }
	];

	let contacts = $state<any[]>([]);
	let campaigns = $state<any[]>([]);
	let loading = $state(true);
	let showAdd = $state(false);

	let name = $state('');
	let handle = $state('');
	let platform = $state('instagram');
	let stage = $state('lead');
	let value = $state(0);
	let notes = $state('');

	async function load() {
		[contacts, campaigns] = await Promise.all([data.crm.contacts($session.token!), data.crm.campaigns($session.token!)]);
		loading = false;
	}
	onMount(load);

	async function add() {
		try {
			await data.crm.upsertContact($session.token!, { name, handle, platform, stage, value, notes });
			showAdd = false;
			name = ''; handle = ''; value = 0; notes = '';
			toast('Contact added to the pipeline.');
			await load();
		} catch (e: any) {
			toast(e.message, 'error');
		}
	}

	async function move(contact: any, to: string) {
		await data.crm.moveStage($session.token!, contact._id, to);
		await load();
	}

	const pipelineValue = $derived(contacts.filter((c) => ['opportunity', 'engaged'].includes(c.stage)).reduce((a, c) => a + c.value, 0));
	const wonValue = $derived(contacts.filter((c) => c.stage === 'customer').reduce((a, c) => a + c.value, 0));
</script>

<div>
	<div class="mb-6 flex flex-wrap items-end justify-between gap-3">
		<div>
			<h1 class="text-2xl font-black tracking-tight text-white">CRM & pipeline</h1>
			<p class="mt-1 text-sm text-slate-400">GoHighLevel-style pipeline, built from your social conversations. Drag leads from inbox to closed.</p>
		</div>
		<div class="flex gap-2">
			<button class="btn btn-ghost" onclick={() => toast(`${STAGES.length} stages · pipeline value shown below`, 'info')}>?</button>
			<button class="btn btn-primary" onclick={() => (showAdd = true)}>+ Add contact</button>
		</div>
	</div>

	<div class="mb-4 grid gap-4 sm:grid-cols-3">
		<div class="card p-4"><p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Open pipeline</p><p class="mt-1 text-2xl font-bold text-white">${pipelineValue.toLocaleString()}</p></div>
		<div class="card p-4"><p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Won (customers)</p><p class="mt-1 text-2xl font-bold text-mint-400">${wonValue.toLocaleString()}</p></div>
		<div class="card p-4"><p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Contacts</p><p class="mt-1 text-2xl font-bold text-white">{contacts.length}</p></div>
	</div>

	{#if loading}
		<div class="grid gap-3 lg:grid-cols-4">{#each Array(4) as _}<div class="card h-56 animate-pulse"></div>{/each}</div>
	{:else}
		<div class="grid gap-3 lg:grid-cols-6">
			{#each STAGES as s}
				<div class="card min-h-64 p-3">
					<div class="mb-2 flex items-center justify-between">
						<span class="flex items-center gap-1.5 text-xs font-bold text-white">
							<span class="h-2 w-2 rounded-full" style={`background:${s.color}`}></span>
							{s.label}
						</span>
						<span class="text-[10px] text-slate-500">{contacts.filter((c) => c.stage === s.key).length}</span>
					</div>
					<div class="space-y-2">
						{#each contacts.filter((c) => c.stage === s.key) as c}
							<div class="rounded-xl border border-ink-600 bg-ink-900 p-3">
								<div class="flex items-center gap-1.5">
									<PlatformBadge platform={c.platform} size="sm" />
									<p class="text-xs font-bold text-white">{c.name}</p>
								</div>
								<p class="mt-1 text-[10px] text-slate-500">{c.handle}</p>
								{#if c.value > 0}<p class="mt-1 text-xs font-bold text-mint-400">${c.value.toLocaleString()}</p>{/if}
								{#if c.notes}<p class="mt-1 line-clamp-2 text-[10px] text-slate-400">{c.notes}</p>{/if}
								<div class="mt-2 flex flex-wrap gap-1">
									{#each STAGES.filter((x) => x.key !== c.stage).slice(0, 3) as t}
										<button class="chip bg-ink-700 px-1.5 py-0.5 text-[9px] text-slate-400 hover:bg-ink-600" onclick={() => move(c, t.key)}>→ {t.label}</button>
									{/each}
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<Modal bind:open={showAdd} title="Add contact">
	<div class="space-y-4">
		<div class="grid gap-4 sm:grid-cols-2">
			<div><label class="label" for="cn">Name</label><input class="input" id="cn" bind:value={name} /></div>
			<div><label class="label" for="ch">Handle</label><input class="input" id="ch" bind:value={handle} placeholder="@handle" /></div>
		</div>
		<div class="grid gap-4 sm:grid-cols-3">
			<div>
				<span class="label">Platform</span>
				<select class="input" bind:value={platform}>{#each ['instagram', 'facebook', 'linkedin', 'x', 'youtube', 'threads'] as p}<option value={p}>{p}</option>{/each}</select>
			</div>
			<div>
				<span class="label">Stage</span>
				<select class="input" bind:value={stage}>{#each STAGES as s}<option value={s.key}>{s.label}</option>{/each}</select>
			</div>
			<div><label class="label" for="cv">Deal value ($)</label><input class="input" id="cv" type="number" bind:value={value} /></div>
		</div>
		<div><label class="label" for="cnotes">Notes</label><textarea class="input" id="cnotes" bind:value={notes} rows="2"></textarea></div>
		<div class="flex justify-end gap-2">
			<button class="btn btn-ghost" onclick={() => (showAdd = false)}>Cancel</button>
			<button class="btn btn-primary" onclick={add}>Add contact</button>
		</div>
	</div>
</Modal>
