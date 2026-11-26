<script lang="ts">
	import { data, session } from '$lib/data';
	import { toast } from '$lib/stores/toast';
	import { onMount } from 'svelte';
	import type { ChatMessage, ConversationSummary } from '$lib/types';

	let conversations = $state<ConversationSummary[]>([]);
	let activeId = $state<string | null>(null);
	let messages = $state<ChatMessage[]>([]);
	let draft = $state('');
	let loading = $state(true);
	let sending = $state(false);
	let error = $state('');
	let composing = $state(false);
	let subject = $state('');
	let firstMessage = $state('');
	let starting = $state(false);

	const active = $derived(conversations.find((c) => c._id === activeId) ?? null);

	onMount(async () => {
		await load();
	});

	async function load() {
		const token = $session.token;
		if (!token) return;
		loading = true;
		error = '';
		try {
			conversations = await data.messaging.conversations(token);
			if (!activeId && conversations.length) await select(conversations[0]._id);
		} catch (e: any) {
			error = e.message;
		} finally {
			loading = false;
		}
	}

	async function select(id: string) {
		const token = $session.token;
		if (!token) return;
		activeId = id;
		error = '';
		try {
			messages = await data.messaging.messages(token, id);
			await data.messaging.markRead(token, id);
			conversations = conversations.map((c) => (c._id === id ? { ...c, unread: 0 } : c));
		} catch (e: any) {
			error = e.message;
		}
	}

	async function sendMessage(e: SubmitEvent) {
		e.preventDefault();
		const token = $session.token;
		if (!token || !activeId || !draft.trim()) return;
		sending = true;
		try {
			await data.messaging.send(token, activeId, draft);
			draft = '';
			messages = await data.messaging.messages(token, activeId);
			conversations = await data.messaging.conversations(token);
		} catch (err: any) {
			toast(err.message, 'error');
		} finally {
			sending = false;
		}
	}

	async function startConversation(e: SubmitEvent) {
		e.preventDefault();
		const token = $session.token;
		if (!token) return;
		starting = true;
		try {
			const res = await data.messaging.start(token, subject, firstMessage);
			subject = '';
			firstMessage = '';
			composing = false;
			toast('Message sent to the GuruSocial team.');
			conversations = await data.messaging.conversations(token);
			await select(res.conversationId);
		} catch (err: any) {
			toast(err.message, 'error');
		} finally {
			starting = false;
		}
	}

	const time = (ts: number) => new Date(ts).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
</script>

<div class="mb-5 flex flex-wrap items-end justify-between gap-3">
	<div>
		<h1 class="text-2xl font-black tracking-tight text-white">Messages</h1>
		<p class="mt-1 text-sm text-slate-400">Private conversations with the GuruSocial team. Only you and the operator side can read them.</p>
	</div>
	<div class="flex gap-2">
		<button class="btn btn-ghost" onclick={() => (composing = !composing)}>{composing ? 'Cancel' : '✎ New message'}</button>
		<button class="btn btn-ghost" onclick={load}>↻ Refresh</button>
	</div>
</div>

{#if composing}
	<form class="card mb-4 space-y-3 p-5" onsubmit={startConversation}>
		<h2 class="text-sm font-bold text-white">Start a conversation</h2>
		<div>
			<label class="label" for="subject">Subject</label>
			<input class="input" id="subject" bind:value={subject} placeholder="Billing, a bug, an integration question…" maxlength="120" />
		</div>
		<div>
			<label class="label" for="first">Message</label>
			<textarea class="input min-h-24" id="first" bind:value={firstMessage} placeholder="Tell us what you need." maxlength="4000" required></textarea>
		</div>
		<button class="btn btn-primary" disabled={starting}>{starting ? 'Sending…' : 'Send message'}</button>
	</form>
{/if}

{#if error}
	<div class="mb-4 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2.5 text-sm text-rose-300" role="alert">
		{error}
	</div>
{/if}

<div class="grid gap-4 lg:grid-cols-[320px_1fr]">
	<div class="card overflow-hidden">
		<div class="border-b border-ink-700 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-400">Conversations</div>
		{#if loading}
			<div class="space-y-2 p-4">
				{#each [0, 1, 2] as i}
					<div class="h-12 animate-pulse rounded-lg bg-ink-800"></div>
				{/each}
			</div>
		{:else if conversations.length === 0}
			<div class="p-5 text-sm text-slate-400">
				<p class="font-semibold text-slate-200">No conversations yet</p>
				<p class="mt-1 text-xs text-slate-500">Start one and the operator team can reply here. Messages are private to participants.</p>
			</div>
		{:else}
			<ul class="max-h-[28rem] overflow-y-auto">
				{#each conversations as c (c._id)}
					<li>
						<button
							class={`w-full border-b border-ink-800 px-4 py-3 text-left transition ${activeId === c._id ? 'bg-ink-800/70' : 'hover:bg-ink-800/40'}`}
							onclick={() => select(c._id)}
							aria-current={activeId === c._id ? 'true' : undefined}
						>
							<div class="flex items-center justify-between gap-2">
								<span class="truncate text-sm font-semibold text-white">{c.subject}</span>
								{#if c.unread > 0}<span class="chip bg-guru-600 text-[10px] text-white">{c.unread}</span>{/if}
							</div>
							<p class="mt-0.5 truncate text-xs text-slate-500">{c.lastMessage || 'No messages yet'}</p>
							<p class="mt-1 text-2xs text-slate-600">{c.peerName} · {time(c.updatedAt)}</p>
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	<div class="card flex min-h-[28rem] flex-col">
		{#if !active}
			<div class="flex flex-1 flex-col items-center justify-center p-8 text-center">
				<p class="text-sm font-semibold text-slate-200">Select a conversation</p>
				<p class="mt-1 max-w-sm text-xs text-slate-500">Messages are only readable by the people in the conversation and are never copied into audit logs.</p>
			</div>
		{:else}
			<div class="flex items-center justify-between border-b border-ink-700 px-4 py-3">
				<div class="min-w-0">
					<p class="truncate text-sm font-bold text-white">{active.subject}</p>
					<p class="text-2xs text-slate-500">{active.peerName} · started {time(active.updatedAt)}</p>
				</div>
				<span class="chip bg-ink-800 text-2xs text-slate-400">{active.staffChannel ? 'support' : 'workspace'}</span>
			</div>

			<div class="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
				{#each messages as m (m._id)}
					<div class={`flex ${m.senderKind === 'staff' ? 'justify-start' : 'justify-end'}`}>
						<div class={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${m.senderKind === 'staff' ? 'bg-ink-800 text-slate-100' : 'bg-guru-600 text-white'}`}>
							<p class="whitespace-pre-wrap break-words">{m.body}</p>
							<p class="mt-1 text-2xs opacity-70">{m.senderName} · {time(m.createdAt)}</p>
						</div>
					</div>
				{:else}
					<p class="text-center text-xs text-slate-500">No messages yet.</p>
				{/each}
			</div>

			<form class="flex items-end gap-2 border-t border-ink-700 p-3" onsubmit={sendMessage}>
				<label class="sr-only" for="reply">Reply</label>
				<textarea class="input min-h-11 flex-1 resize-none" id="reply" bind:value={draft} placeholder="Write a reply…" maxlength="4000"></textarea>
				<button class="btn btn-primary" disabled={sending || !draft.trim()}>{sending ? 'Sending…' : 'Send'}</button>
			</form>
		{/if}
	</div>
</div>
