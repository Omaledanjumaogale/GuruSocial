<script lang="ts">
	import { data, session } from '$lib/data';
	import { toast } from '$lib/stores/toast';
	import { onMount } from 'svelte';

	let audit = $state<any[]>([]);
	let loading = $state(true);
	let inviteEmail = $state('');
	let inviteRole = $state('member');

	const ROLES = [
		{ key: 'owner', label: 'Owner', hint: 'Full control, billing, API keys.' },
		{ key: 'admin', label: 'Admin', hint: 'Everything except billing and key deletion.' },
		{ key: 'member', label: 'Member', hint: 'Create and schedule posts, read analytics.' },
		{ key: 'approver', label: 'Approver', hint: 'Reviews posts in the approval queue only.' }
	];

	const TEAM = [
		{ name: 'You', role: 'owner' },
	];

	async function load() {
		audit = await data.keys.auditTrail($session.token!, 40);
		loading = false;
	}
	onMount(load);

	function invite() {
		if (!inviteEmail.includes('@')) {
			toast('Enter a valid email.', 'error');
			return;
		}
		toast(`Invite sent to ${inviteEmail} as ${inviteRole}. They appear here after accepting.`, 'info');
		inviteEmail = '';
	}
</script>

<div class="grid gap-4 lg:grid-cols-2">
	<div>
		<h1 class="page-title">Team & audit</h1>
		<p class="page-sub mb-4">Roles separate who can read, draft, approve and administer — publishing to real platforms always shows in the audit trail.</p>

		<div class="card mb-4 p-5">
			<h3 class="mb-3 text-sm font-bold text-white">Invite a teammate</h3>
			<div class="flex gap-2">
				<input class="input" bind:value={inviteEmail} placeholder="teammate@company.com" />
				<select class="input w-auto" bind:value={inviteRole}>{#each ROLES as r}<option value={r.key}>{r.label}</option>{/each}</select>
				<button class="btn btn-primary shrink-0" onclick={invite}>Invite</button>
			</div>
		</div>

		<div class="card p-5">
			<h3 class="mb-3 text-sm font-bold text-white">Role matrix</h3>
			<div class="space-y-2">
				{#each ROLES as r}
					<div class="rounded-xl border border-ink-600 p-3">
						<div class="flex items-center justify-between">
							<p class="text-sm font-bold text-white">{r.label}</p>
							{#if r.key === 'owner'}<span class="chip bg-guru-600/20 text-[10px] text-guru-400">that's you</span>{/if}
						</div>
						<p class="mt-0.5 text-xs text-slate-500">{r.hint}</p>
					</div>
				{/each}
			</div>
		</div>
	</div>

	<div class="card p-5">
		<h3 class="mb-3 text-sm font-bold text-white">Audit trail</h3>
		{#if loading}
			<div class="space-y-2">{#each Array(6) as _}<div class="h-10 animate-pulse rounded-lg bg-ink-800"></div>{/each}</div>
		{:else}
			<div class="space-y-1.5">
				{#each audit as a}
					<div class="flex items-center gap-2.5 rounded-lg bg-ink-900 px-3 py-2 text-xs">
						<span class="font-mono text-[10px] text-slate-600">{new Date(a.createdAt).toLocaleTimeString()}</span>
						<span class="font-semibold text-slate-300">{a.action}</span>
						<span class="truncate text-slate-500">{a.target} {a.detail ? '· ' + a.detail : ''}</span>
						<span class="ml-auto shrink-0 text-slate-600">{a.actor}</span>
					</div>
				{:else}
					<p class="text-sm text-slate-500">Actions — sign-ins, connects, posts, key operations — land here.</p>
				{/each}
			</div>
		{/if}
	</div>
</div>
