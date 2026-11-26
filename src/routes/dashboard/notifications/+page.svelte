<script lang="ts">
	import { data, session } from '$lib/data';
	import { toast } from '$lib/stores/toast';
	import { onMount } from 'svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';

	let rows = $state<any[]>([]);
	let filter = $state<'all' | 'unread'>('all');
	let loading = $state(true);

	const visible = $derived(filter === 'all' ? rows : rows.filter((r) => !r.readAt));
	const unread = $derived(rows.filter((r) => !r.readAt).length);

	async function load() {
		if (!$session.token) return;
		loading = true;
		try {
			rows = await data.notifications.list($session.token, 60);
		} catch (e: any) {
			toast(e.message, 'error');
		} finally {
			loading = false;
		}
	}

	async function markRead(id: string) {
		if (!$session.token) return;
		const row = rows.find((r) => r._id === id);
		if (!row || row.readAt) return;
		row.readAt = Date.now();
		rows = [...rows];
		try {
			await data.notifications.markRead($session.token, id);
		} catch {
			row.readAt = null;
			rows = [...rows];
		}
	}

	async function markAll() {
		if (!$session.token) return;
		try {
			await data.notifications.markAllRead($session.token);
			rows = rows.map((r) => ({ ...r, readAt: r.readAt ?? Date.now() }));
			toast('All notifications marked as read.');
		} catch (e: any) {
			toast(e.message, 'error');
		}
	}

	const KIND_LABELS: Record<string, string> = {
		account: 'Account',
		security: 'Security',
		product: 'Product',
		message: 'Message',
		admin: 'Operator'
	};

	onMount(load);
</script>

<PageHeader
	eyebrow="Inbox"
	title="Notifications"
	description="Account, security, product and operator updates for this workspace. Email delivery is opt-in in Settings."
>
	<button class="btn btn-ghost btn-sm" onclick={markAll} disabled={unread === 0}>Mark all read</button>
	<a class="btn btn-ghost btn-sm" href="/dashboard/settings">Preferences</a>
</PageHeader>

<div class="mb-4 flex items-center gap-1 rounded-lg border border-ink-700 bg-ink-900 p-1 text-xs font-semibold">
	<button
		class={`rounded-md px-3 py-1.5 transition ${filter === 'all' ? 'bg-ink-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}
		onclick={() => (filter = 'all')}>All ({rows.length})</button
	>
	<button
		class={`rounded-md px-3 py-1.5 transition ${filter === 'unread' ? 'bg-ink-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}
		onclick={() => (filter = 'unread')}>Unread ({unread})</button
	>
</div>

<div class="card overflow-hidden">
	{#if loading}
		<div class="space-y-2 p-4">
			{#each Array(5) as _}<div class="h-14 animate-pulse rounded-lg bg-ink-800"></div>{/each}
		</div>
	{:else if visible.length === 0}
		<div class="p-10 text-center">
			<p class="section-title">Nothing here yet</p>
			<p class="mx-auto mt-2 max-w-md prose-line">
				Notifications appear when your account changes, a teammate joins, a post needs approval or the operator team
				publishes an update.
			</p>
		</div>
	{:else}
		<ul class="divide-y divide-ink-800">
			{#each visible as row (row._id)}
				<li class={row.readAt ? 'bg-transparent' : 'bg-guru-600/[0.04]'}>
					<div class="flex items-start gap-3 px-4 py-3.5">
						<span
							class={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${row.readAt ? 'bg-ink-600' : 'bg-guru-500'}`}
							aria-hidden="true"
						></span>
						<div class="min-w-0 flex-1">
							<div class="flex flex-wrap items-center gap-2">
								<p class="text-sm font-semibold text-white">{row.title}</p>
								<span class="chip bg-ink-800 text-[10px] text-slate-400">{KIND_LABELS[row.kind] ?? row.kind}</span>
								<span class="text-2xs text-slate-600">{new Date(row.createdAt).toLocaleString()}</span>
							</div>
							<p class="mt-1 prose-line">{row.body}</p>
							<div class="mt-2 flex items-center gap-3 text-xs">
								{#if row.href}
									<a class="font-semibold text-guru-300 hover:underline" href={row.href} onclick={() => markRead(row._id)}>
										Open →
									</a>
								{/if}
								{#if !row.readAt}
									<button class="text-slate-500 hover:text-slate-300" onclick={() => markRead(row._id)}>
										Mark as read
									</button>
								{/if}
							</div>
						</div>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</div>
