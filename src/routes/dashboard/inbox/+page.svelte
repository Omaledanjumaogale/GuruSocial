<script lang="ts">
	import { data, session } from '$lib/data';
	import PlatformBadge from '$lib/components/PlatformBadge.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import { toast } from '$lib/stores/toast';
	import { onMount } from 'svelte';

	function timeAgo(ts: number): string {
		const s = Math.floor((Date.now() - ts) / 1000);
		if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m ago`;
		if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
		return `${Math.floor(s / 86400)}d ago`;
	}

	const TYPES = [
		{ key: 'all', label: 'All' },
		{ key: 'dm', label: 'DMs' },
		{ key: 'comment', label: 'Comments' },
		{ key: 'review', label: 'Reviews' },
		{ key: 'mention', label: 'Mentions' }
	];

	let typeFilter = $state('all');
	let items = $state<any[]>([]);
	let loading = $state(true);
	let activeItem = $state<any>(null);
	let replyText = $state('');
	let sending = $state(false);

	async function load() {
		items = await data.inbox.list($session.token!, typeFilter === 'all' ? {} : { type: typeFilter });
		loading = false;
	}
	onMount(load);

	function select(item: any) {
		activeItem = item;
		replyText = '';
		if (item.status === 'unread') data.inbox.mark($session.token!, item._id, 'read').then(load);
	}

	async function send() {
		if (!replyText.trim()) return;
		sending = true;
		try {
			await data.inbox.reply($session.token!, activeItem._id, replyText);
			toast('Reply sent.');
			activeItem = null;
			await load();
		} catch (e: any) {
			toast(e.message, 'error');
		} finally {
			sending = false;
		}
	}

	async function toContact() {
		const { contactId } = await data.inbox.toContact($session.token!, activeItem._id);
		toast('Added to CRM as a lead. Open Pipeline →');
		activeItem = null;
		await load();
	}

	async function runAutomation(item: any) {
		const autos = await data.automations.list($session.token!);
		const candidates = autos.filter((a: any) => a.enabled && a.platforms.includes(item.platform));
		if (!candidates.length) {
			toast('No enabled automation covers this platform. Create one in AI agents.', 'info');
			return;
		}
		for (const a of candidates) {
			const { matched, reply } = await data.automations.run($session.token!, a._id, item._id);
			if (matched) {
				toast(`"${a.name}" replied automatically.`);
				break;
			}
		}
		await load();
	}

	const unreadCount = $derived(items.filter((i) => i.status === 'unread').length);
</script>

<div class="grid gap-4 lg:grid-cols-[26rem_1fr]">
	<div>
		<div class="mb-4 flex items-end justify-between gap-3">
			<div>
				<h1 class="text-2xl font-black tracking-tight text-white">Unified inbox</h1>
				<p class="mt-1 text-sm text-slate-400">Comments, DMs, mentions and reviews — one cockpit.</p>
			</div>
			{#if unreadCount}<span class="chip bg-guru-600/25 text-xs text-guru-400">{unreadCount} new</span>{/if}
		</div>
		<div class="mb-3 flex flex-wrap gap-2">
			{#each TYPES as t}
				<button class={`chip border ${typeFilter === t.key ? 'border-guru-500 bg-guru-600/25 text-white' : 'border-ink-600 bg-ink-800 text-slate-400'}`} onclick={() => ((typeFilter = t.key), (loading = true), load())}>{t.label}</button>
			{/each}
		</div>
		{#if loading}
			<div class="space-y-2">{#each Array(5) as _}<div class="card h-20 animate-pulse"></div>{/each}</div>
		{:else if !items.length}
			<EmptyState icon="✉" title="Inbox zero" message="Nothing here. When people reply to your posts or DM you, it lands in this unified cockpit." />
		{:else}
			<div class="space-y-2">
				{#each items as item}
					<button class={`card w-full p-3.5 text-left transition ${activeItem?._id === item._id ? 'ring-1 ring-guru-500/50' : ''} hover:border-guru-500/40`} onclick={() => select(item)}>
						<div class="flex items-center gap-2">
							<PlatformBadge platform={item.platform} />
							<span class="text-sm font-bold text-white">{item.fromUser}</span>
							<span class={`chip text-[10px] ${item.type === 'dm' ? 'bg-sky-500/15 text-sky-300' : item.type === 'review' ? 'bg-amber-500/15 text-amber-300' : 'bg-ink-700 text-slate-400'}`}>{item.type}</span>
							{#if item.status === 'unread'}<span class="ml-auto h-2 w-2 rounded-full bg-guru-500"></span>{:else if item.status === 'replied'}<span class="ml-auto text-[10px] text-mint-400">✓ replied</span>{/if}
						</div>
						<p class="mt-1.5 line-clamp-2 text-sm text-slate-300">{item.message}</p>
						<p class="mt-1 text-[10px] text-slate-600">{timeAgo(item.sentAt)} · {item.platform}</p>
					</button>
				{/each}
			</div>
		{/if}
	</div>

	<div class="hidden lg:block">
		<div class="card sticky top-24 min-h-96 p-5">
			{#if activeItem}
				<div class="flex items-center gap-2.5">
					<PlatformBadge platform={activeItem.platform} size="lg" />
					<div>
						<p class="font-bold text-white">{activeItem.fromUser}</p>
						<p class="text-xs text-slate-500">{activeItem.profileHandle} · {activeItem.platform} · {timeAgo(activeItem.sentAt)}</p>
					</div>
				</div>
				<div class="mt-4 rounded-xl bg-ink-900 p-4 text-sm leading-relaxed text-slate-200">{activeItem.message}</div>
				{#if activeItem.repliedMessage}
					<div class="mt-3 rounded-xl border border-mint-500/30 bg-mint-500/10 p-3 text-sm text-mint-300">
						<p class="mb-1 text-[10px] font-bold uppercase tracking-widest">You replied</p>
						{activeItem.repliedMessage}
					</div>
				{:else}
					<textarea class="input mt-4 min-h-28" bind:value={replyText} placeholder="Write a reply…"></textarea>
					<div class="mt-3 flex flex-wrap gap-2">
						<button class="btn btn-primary" onclick={send} disabled={sending}>{sending ? 'Sending…' : 'Send reply'}</button>
						<button class="btn btn-ghost" onclick={() => runAutomation(activeItem)}>⚙ Run automation</button>
						<button class="btn btn-ghost" onclick={toContact}>→ Add to CRM</button>
					</div>
					<p class="mt-3 text-xs text-slate-600">Replies outside a platform's DM window may be rejected by that network — automations keep you inside Meta's 24-hour and 7-day rules.</p>
				{/if}
			{:else}
				<div class="grid h-full place-items-center text-center">
					<div>
						<div class="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-ink-700 text-2xl">✉</div>
						<p class="mt-3 text-sm font-bold text-white">Select a conversation</p>
						<p class="mt-1 text-xs text-slate-500">Replies, sentiment and CRM handoff appear here.</p>
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>
