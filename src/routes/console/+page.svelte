<script lang="ts">
	import { CONVEX_HTTP_URL, backendMode } from '$lib/data';
	import { ConvexHttpClient } from 'convex/browser';
	import { anyApi } from 'convex/server';
	import { toast } from '$lib/stores/toast';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	const api = anyApi;
	const TOKEN_KEY = 'gurusocial.admin.token.v1';

	let token = $state<string | null>(null);
	let email = $state('');
	let password = $state('');
	let busy = $state(false);
	let error = $state('');
	let stats = $state<any>(null);
	let sendingEmail = $state(false);

	const client = $derived(CONVEX_HTTP_URL ? new ConvexHttpClient(CONVEX_HTTP_URL.replace('.site', '.cloud')) : null);

	onMount(async () => {
		token = localStorage.getItem(TOKEN_KEY);
		if (token) await refresh();
	});

	async function refresh() {
		if (!client || !token) return;
		try {
			stats = await client.action(api.admin.stats, { adminToken: token });
		} catch (e: any) {
			toast(e.message, 'error');
			if (/expired|invalid/i.test(e.message)) {
				token = null;
				localStorage.removeItem(TOKEN_KEY);
			}
		}
	}

	async function signIn(e: SubmitEvent) {
		e.preventDefault();
		if (!client) {
			error = 'The admin console requires the live Convex backend (VITE_CONVEX_URL).';
			return;
		}
		error = '';
		busy = true;
		try {
			const res = await client.action(api.admin.signIn, { email, password });
			token = res.token;
			localStorage.setItem(TOKEN_KEY, res.token);
			password = '';
			toast('Admin session started.');
			await refresh();
		} catch (e: any) {
			error = e.message;
		} finally {
			busy = false;
		}
	}

	async function sendTestEmail() {
		if (!client || !token) return;
		sendingEmail = true;
		try {
			const res = await client.action(api.email.sendTestEmail, { adminToken: token });
			toast(`Test email sent via Resend (id ${res.id.slice(0, 12)}…). Check the admin inbox.`);
		} catch (e: any) {
			toast(e.message, 'error');
		} finally {
			sendingEmail = false;
		}
	}

	function signOutAdmin() {
		localStorage.removeItem(TOKEN_KEY);
		token = null;
		stats = null;
		toast('Admin session ended.', 'info');
	}

	const fmtDate = (ts: number) => new Date(ts).toLocaleString();
</script>

<div class="min-h-screen bg-ink-900">
	<header class="border-b border-ink-700 bg-ink-850">
		<div class="mx-auto flex max-w-5xl items-center justify-between px-4 py-3.5">
			<a href="/" class="flex items-center gap-2.5">
				<div class="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-guru-500 to-mint-500 text-lg font-black text-white">G</div>
				<span class="font-black tracking-tight text-white">GuruSocial</span>
				<span class="chip bg-rose-500/15 text-[10px] text-rose-300">super admin</span>
			</a>
			<div class="flex items-center gap-2 text-xs text-slate-500">
				{#if backendMode === 'convex'}<span class="chip bg-mint-500/15 text-mint-400">live backend</span>{:else}<span class="chip bg-amber-500/15 text-amber-300">demo backend</span>{/if}
				<a href="/dashboard" class="btn btn-ghost px-2.5 py-1.5">App →</a>
			</div>
		</div>
	</header>

	<main class="mx-auto max-w-5xl px-4 py-10">
		{#if !token}
			<div class="card mx-auto max-w-sm p-6">
				<h1 class="text-xl font-black text-white">Admin console sign-in</h1>
				<p class="mt-1 text-sm text-slate-400">EWIN ecosystem operator access. Credentials are verified against encrypted server-side environment variables.</p>
				<form class="mt-6 space-y-4" onsubmit={signIn}>
					<div><label class="label" for="ae">Admin email</label><input class="input" id="ae" type="email" bind:value={email} required /></div>
					<div><label class="label" for="ap">Admin password</label><input class="input" id="ap" type="password" bind:value={password} required /></div>
					{#if error}<p class="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2.5 text-sm text-rose-300">{error}</p>{/if}
					<button class="btn btn-primary w-full py-3" disabled={busy}>{busy ? 'Verifying…' : 'Enter console'}</button>
				</form>
			</div>
		{:else}
			<div class="mb-6 flex flex-wrap items-end justify-between gap-3">
				<div>
					<h1 class="text-2xl font-black tracking-tight text-white">Ecosystem console</h1>
					<p class="mt-1 text-sm text-slate-400">Global view across every workspace on this deployment. Session expires after 12 hours.</p>
				</div>
				<div class="flex gap-2">
					<button class="btn btn-primary" onclick={sendTestEmail} disabled={sendingEmail}>{sendingEmail ? 'Sending…' : '✉ Send test email'}</button>
					<button class="btn btn-ghost" onclick={() => refresh()}>↻ Refresh</button>
					<button class="btn btn-ghost" onclick={signOutAdmin}>Sign out</button>
				</div>
			</div>

			{#if stats}
				<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
					{#each [['Users', stats.counts.users], ['Posts', stats.counts.posts], ['Published', stats.counts.published], ['Scheduled', stats.counts.scheduled], ['Profiles', stats.counts.profiles], ['API keys', stats.counts.apiKeys], ['Harvest jobs', stats.counts.harvestJobs], ['Inbox items', stats.counts.inboxItems]] as [label, value]}
						<div class="card p-4">
							<p class="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
							<p class="mt-1 text-2xl font-bold text-white tabular-nums">{value}</p>
						</div>
					{/each}
				</div>

				<div class="mt-4 grid gap-4 lg:grid-cols-2">
					<div class="card p-5">
						<h3 class="mb-3 text-sm font-bold text-white">Recent users</h3>
						{#each stats.users as u}
							<div class="mb-1.5 flex items-center justify-between rounded-lg bg-ink-900 px-3 py-2 text-xs">
								<span class="font-semibold text-slate-200">{u.name}</span>
								<span class="text-slate-500">{u.email}</span>
								<span class="chip bg-ink-700 text-[10px] uppercase text-slate-400">{u.plan}</span>
								<span class="text-slate-600">{fmtDate(u.createdAt)}</span>
							</div>
						{/each}
					</div>
					<div class="card p-5">
						<h3 class="mb-3 text-sm font-bold text-white">Global audit trail</h3>
						{#each stats.audit as a}
							<div class="mb-1.5 flex items-center gap-2 rounded-lg bg-ink-900 px-3 py-2 text-xs">
								<span class="font-mono text-[10px] text-slate-600">{new Date(a.createdAt).toLocaleTimeString()}</span>
								<span class="font-semibold text-slate-300">{a.action}</span>
								<span class="truncate text-slate-500">{a.target}</span>
							</div>
						{:else}
							<p class="text-sm text-slate-500">No activity recorded yet.</p>
						{/each}
					</div>
				</div>
				<p class="mt-4 text-[10px] text-slate-600">Stats generated {fmtDate(stats.generatedAt)} · deployment beaming-bobcat-890 (eu-west-1)</p>
			{:else}
				<div class="card p-10 text-center text-sm text-slate-500">Loading ecosystem stats…</div>
			{/if}
		{/if}
	</main>
</div>
