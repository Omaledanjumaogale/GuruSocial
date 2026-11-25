<script lang="ts">
	import { data, session, backendMode } from '$lib/data';
	import Modal from '$lib/components/Modal.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import { toast } from '$lib/stores/toast';
	import { onMount } from 'svelte';

	const SCOPES = ['posts:write', 'posts:read', 'analytics:read', 'inbox:read', 'inbox:write', 'crm:write', 'mcp:use'];

	let keys = $state<any[]>([]);
	let webhooks = $state<any[]>([]);
	let logs = $state<any[]>([]);
	let loading = $state(true);
	let showCreate = $state(false);
	let createdKey = $state('');
	let copied = $state(false);

	let keyName = $state('');
	let keyScopes = $state<string[]>(['posts:write', 'analytics:read']);
	let keyMode = $state<'live' | 'sandbox'>('sandbox');

	let hookUrl = $state('');
	let hookEvents = $state<string[]>(['post.published']);
	let showHooks = $state(false);

	async function load() {
		const token = $session.token!;
		[keys, webhooks, logs] = await Promise.all([data.keys.listKeys(token), data.keys.webhooks(token), data.keys.logs(token, 12)]);
		loading = false;
	}
	onMount(load);

	async function create() {
		try {
			const { key } = await data.keys.createKey($session.token!, keyName, keyScopes, keyMode);
			createdKey = key;
			showCreate = false;
			keyName = '';
			await load();
			toast('API key created — copy it now, it is shown only once.');
		} catch (e: any) {
			toast(e.message, 'error');
		}
	}

	async function revoke(k: any) {
		await data.keys.revokeKey($session.token!, k._id);
		toast('Key revoked. Requests using it will be rejected.');
		await load();
	}

	function copyKey() {
		navigator.clipboard.writeText(createdKey).then(() => {
			copied = true;
			setTimeout(() => (copied = false), 2000);
		});
	}

	async function addHook() {
		try {
			await data.keys.addWebhook($session.token!, hookUrl, hookEvents);
			showHooks = false;
			hookUrl = '';
			toast('Webhook registered.');
			await load();
		} catch (e: any) {
			toast(e.message, 'error');
		}
	}

	async function removeHook(h: any) {
		await data.keys.removeWebhook($session.token!, h._id);
		await load();
	}

	const mcpUrl = $derived(backendMode === 'convex' ? `${(import.meta.env.VITE_CONVEX_URL ?? '').replace('.cloud', '.site').replace('https://', 'https://')}/mcp` : 'https://your-gurusocial.convex.site/mcp');
</script>

<div>
	<div class="mb-6 flex flex-wrap items-end justify-between gap-3">
		<div>
			<h1 class="text-2xl font-black tracking-tight text-white">Developer & API</h1>
			<p class="mt-1 text-sm text-slate-400">Scoped API keys, webhooks, request logs and an MCP server — so external apps and agents can post to your platforms and read analytics.</p>
		</div>
		<a href="/docs" class="btn btn-ghost">Full API reference →</a>
	</div>

	<div class="grid gap-4 lg:grid-cols-3">
		<div class="card p-5 lg:col-span-2">
			<div class="mb-3 flex items-center justify-between">
				<h3 class="text-sm font-bold text-white">API keys</h3>
				<button class="btn btn-primary px-3 py-1.5 text-xs" onclick={() => (showCreate = true)}>+ Create key</button>
			</div>
			{#if loading}
				<div class="space-y-2">{#each Array(2) as _}<div class="h-16 animate-pulse rounded-xl bg-ink-800"></div>{/each}</div>
			{:else if !keys.length}
				<EmptyState icon="⌨" title="No API keys yet" message="Create a sandbox key first — it validates requests and returns dry-run results without publishing anything." actionLabel="Create sandbox key" onAction={() => (showCreate = true)} />
			{:else}
				<div class="space-y-2">
					{#each keys as k}
						<div class="flex flex-wrap items-center gap-3 rounded-xl border border-ink-600 p-3.5">
							<div class="min-w-0 flex-1">
								<div class="flex flex-wrap items-center gap-2">
									<span class="text-sm font-bold text-white">{k.name}</span>
									<span class={`chip text-[10px] ${k.mode === 'live' ? 'bg-mint-500/15 text-mint-400' : 'bg-amber-500/15 text-amber-300'}`}>{k.mode}</span>
									{#if k.revokedAt}<span class="chip bg-rose-500/15 text-[10px] text-rose-300">revoked</span>{/if}
								</div>
								<p class="mt-0.5 font-mono text-xs text-slate-500">{k.keyPrefix}••••••••</p>
								<div class="mt-1 flex flex-wrap gap-1">
									{#each k.scopes as s}<span class="chip bg-ink-700 px-1.5 py-0.5 text-[9px] text-slate-400">{s}</span>{/each}
								</div>
							</div>
							{#if !k.revokedAt}
								<button class="btn btn-danger px-2.5 py-1 text-xs" onclick={() => revoke(k)}>Revoke</button>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<div class="card p-5">
			<h3 class="text-sm font-bold text-white">MCP server</h3>
			<p class="mt-2 text-xs leading-relaxed text-slate-400">Give Claude, ChatGPT, Cursor or any MCP client your social stack as tools:</p>
			<pre class="mt-3 overflow-x-auto rounded-xl bg-ink-950 p-3 text-[11px] text-slate-300"><code>POST {mcpUrl}
Authorization: Bearer gs_live_…</code></pre>
			<ul class="mt-3 space-y-1.5 text-xs text-slate-400">
				<li>• <code class="text-guru-400">create_post</code> — publish/schedule everywhere</li>
				<li>• <code class="text-guru-400">preflight_post</code> — dry-run limits & warnings</li>
				<li>• <code class="text-guru-400">list_profiles</code> / <code class="text-guru-400">list_posts</code></li>
				<li>• <code class="text-guru-400">get_post_analytics</code></li>
			</ul>
			<p class="mt-3 text-[10px] text-slate-600">Sandbox keys return dry-run results — nothing is published.</p>
		</div>
	</div>

	<div class="mt-4 grid gap-4 lg:grid-cols-2">
		<div class="card p-5">
			<div class="mb-3 flex items-center justify-between">
				<h3 class="text-sm font-bold text-white">Webhooks</h3>
				<button class="btn btn-ghost px-3 py-1.5 text-xs" onclick={() => (showHooks = true)}>+ Add webhook</button>
			</div>
			{#each webhooks as h}
				<div class="mb-2 flex items-center justify-between rounded-xl border border-ink-600 p-3">
					<div class="min-w-0">
						<p class="truncate text-xs text-slate-300">{h.url}</p>
						<p class="text-[10px] text-slate-500">{h.events.join(', ')}</p>
					</div>
					<button class="btn btn-danger px-2.5 py-1 text-xs" onclick={() => removeHook(h)}>✕</button>
				</div>
			{:else}
				<p class="text-sm text-slate-500">Subscribe to <code>post.published</code>, <code>post.failed</code>, <code>inbox.received</code> and <code>automation.ran</code>.</p>
			{/each}
		</div>
		<div class="card p-5">
			<h3 class="mb-3 text-sm font-bold text-white">Request log</h3>
			{#each logs as l}
				<div class="mb-1.5 flex items-center gap-2.5 rounded-lg bg-ink-900 px-3 py-2 text-xs">
					<span class={`font-mono font-bold ${l.status < 400 ? 'text-mint-400' : 'text-rose-400'}`}>{l.status}</span>
					<span class="font-mono text-slate-400">{l.method}</span>
					<span class="truncate text-slate-300">{l.path}</span>
					<span class="ml-auto text-slate-600">{l.durationMs}ms</span>
				</div>
			{:else}
				<p class="text-sm text-slate-500">API requests and webhook emissions appear here.</p>
			{/each}
		</div>
	</div>
</div>

<Modal bind:open={showCreate} title="Create API key">
	<div class="space-y-4">
		<div><label class="label" for="kn">Key name</label><input class="input" id="kn" bind:value={keyName} placeholder="Content generator app" /></div>
		<div>
			<span class="label">Scopes</span>
			<div class="flex flex-wrap gap-2">
				{#each SCOPES as s}
					<button class={`chip border ${keyScopes.includes(s) ? 'border-guru-500 bg-guru-600/25 text-white' : 'border-ink-600 bg-ink-800 text-slate-400'}`} onclick={() => (keyScopes = keyScopes.includes(s) ? keyScopes.filter((x) => x !== s) : [...keyScopes, s])}>{s}</button>
				{/each}
			</div>
		</div>
		<div>
			<span class="label">Mode</span>
			<div class="flex gap-2">
				<button class={`chip border ${keyMode === 'sandbox' ? 'border-amber-500 bg-amber-500/20 text-amber-300' : 'border-ink-600 bg-ink-800 text-slate-400'}`} onclick={() => (keyMode = 'sandbox')}>Sandbox — dry-run</button>
				<button class={`chip border ${keyMode === 'live' ? 'border-mint-500 bg-mint-500/20 text-mint-400' : 'border-ink-600 bg-ink-800 text-slate-400'}`} onclick={() => (keyMode = 'live')}>Live — publishes</button>
			</div>
		</div>
		<div class="flex justify-end gap-2">
			<button class="btn btn-ghost" onclick={() => (showCreate = false)}>Cancel</button>
			<button class="btn btn-primary" onclick={create}>Create key</button>
		</div>
	</div>
</Modal>

{#if createdKey}
	<Modal open={createdKey !== ''} title="Copy your API key now">
		<div class="rounded-xl border border-mint-500/40 bg-mint-500/10 p-4">
			<p class="break-all font-mono text-sm text-mint-300">{createdKey}</p>
		</div>
		<p class="mt-3 text-xs text-slate-400">This is the only time the full key is shown. Store it in your secret manager.</p>
		<button class="btn btn-primary mt-4 w-full" onclick={copyKey}>{copied ? '✓ Copied' : 'Copy to clipboard'}</button>
	</Modal>
{/if}

<Modal bind:open={showHooks} title="Add webhook">
	<div class="space-y-4">
		<div><label class="label" for="wu">Endpoint URL</label><input class="input" id="wu" bind:value={hookUrl} placeholder="https://yourapp.com/hooks/gurusocial" /></div>
		<div>
			<span class="label">Events</span>
			<div class="flex flex-wrap gap-2">
				{#each ['post.published', 'post.failed', 'inbox.received', 'automation.ran'] as ev}
					<button class={`chip border ${hookEvents.includes(ev) ? 'border-guru-500 bg-guru-600/25 text-white' : 'border-ink-600 bg-ink-800 text-slate-400'}`} onclick={() => (hookEvents = hookEvents.includes(ev) ? hookEvents.filter((x) => x !== ev) : [...hookEvents, ev])}>{ev}</button>
				{/each}
			</div>
		</div>
		<div class="flex justify-end gap-2">
			<button class="btn btn-ghost" onclick={() => (showHooks = false)}>Cancel</button>
			<button class="btn btn-primary" onclick={addHook}>Add webhook</button>
		</div>
	</div>
</Modal>
