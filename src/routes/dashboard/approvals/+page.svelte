<script lang="ts">
	import { data, session } from '$lib/data';
	import { toast } from '$lib/stores/toast';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import PlatformBadge from '$lib/components/PlatformBadge.svelte';
	import { onMount } from 'svelte';

	type Pending = { _id: string; content: string; platforms: string[]; status: string; scheduledAt: number | null; createdAt: number };
	let pending = $state<Pending[]>([]);
	let loading = $state(true);
	let note = $state('');
	let busyId = $state<string | null>(null);

	onMount(async () => {
		try {
			pending = (await data.media.approvals($session.token!)) as any;
		} catch (e: any) {
			toast(e.message, 'error');
		} finally {
			loading = false;
		}
	});

	async function decide(p: Pending, decision: 'approved' | 'rejected' | 'changes_requested') {
		busyId = p._id;
		try {
			await data.media.decideApproval($session.token!, p._id, decision, note || undefined);
			pending = pending.filter((x) => x._id !== p._id);
			note = '';
			toast(decision === 'approved' ? 'Post approved — it will publish on schedule.' : decision === 'rejected' ? 'Post rejected and moved back to drafts.' : 'Changes requested — author notified.');
		} catch (e: any) {
			toast(e.message, 'error');
		} finally {
			busyId = null;
		}
	}
</script>

	<header>
		<h1 class="page-title">Approval flows</h1>
		<p class="page-sub">Review queue for scheduled posts. Approvers, admins and owners sign off before anything reaches the queue — every decision is written to the audit trail.</p>
	</header>

	{#if loading}
		<p class="mt-8 text-sm text-slate-500">Loading queue…</p>
	{:else if pending.length === 0}
		<EmptyState icon="✓" title="Queue is clear" message="Nothing is waiting for sign-off. New posts appear here the moment a teammate requests approval." />
	{:else}
		<div class="mt-6 space-y-4">
			{#each pending as p (p._id)}
				<div class="card p-5">
					<div class="flex flex-wrap items-center justify-between gap-3">
						<div class="flex items-center gap-2">
							{#each p.platforms as pl}
								<PlatformBadge platform={pl} />
							{/each}
							<span class="chip bg-amber-guru/15 text-amber-guru ring-1 ring-inset ring-amber-guru/30">awaiting approval</span>
						</div>
						<p class="text-xs text-slate-500">{p.scheduledAt ? `scheduled ${new Date(p.scheduledAt).toLocaleString()}` : `created ${new Date(p.createdAt).toLocaleString()}`}</p>
					</div>
					<p class="mt-3 line-clamp-3 text-sm leading-relaxed text-slate-200">{p.content}</p>
					<textarea class="input mt-3" rows="2" placeholder="Reviewer note (optional, sent to the author)" bind:value={note}></textarea>
					<div class="mt-3 flex flex-wrap gap-2">
						<button class="btn btn-success btn-sm" disabled={busyId === p._id} onclick={() => decide(p, 'approved')}>✓ Approve</button>
						<button class="btn btn-ghost btn-sm" disabled={busyId === p._id} onclick={() => decide(p, 'changes_requested')}>✎ Request changes</button>
						<button class="btn btn-danger btn-sm" disabled={busyId === p._id} onclick={() => decide(p, 'rejected')}>✕ Reject</button>
					</div>
				</div>
			{/each}
		</div>
	{/if}
