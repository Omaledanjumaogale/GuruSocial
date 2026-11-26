<script lang="ts">
	import { data, session, backendMode, CONVEX_HTTP_URL } from '$lib/data';
	import { toast } from '$lib/stores/toast';
	import { onMount } from 'svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import type { EwinStatus } from '$lib/types';

	let status = $state<EwinStatus | null>(null);
	let wallet = $state<any>(null);
	let hb = $state<any>(null);
	let hbBusy = $state(false);
	let loading = $state(true);
	let code = $state<string | null>(null);
	let expiresAt = $state<number | null>(null);
	let busy = $state(false);

	async function load() {
		if (!$session.token) return;
		loading = true;
		try {
			status = await data.ewin.status($session.token);
		} catch (e: any) {
			toast(e.message, 'error');
		} finally {
			loading = false;
		}
	}

	async function generate() {
		if (!$session.token) return;
		busy = true;
		try {
			const res = await data.ewin.issueCode($session.token);
			code = res.code;
			expiresAt = res.expiresAt;
			toast('Connection code generated — valid for 10 minutes.');
		} catch (e: any) {
			toast(e.message, 'error');
		} finally {
			busy = false;
		}
	}

	async function disconnect() {
		if (!$session.token) return;
		busy = true;
		try {
			const revoked = await data.ewin.disconnect($session.token);
			toast(revoked ? `${revoked} hub link${revoked === 1 ? '' : 's'} revoked.` : 'No active link to revoke.');
			await load();
		} catch (e: any) {
			toast(e.message, 'error');
		} finally {
			busy = false;
		}
	}

	async function copy(text: string) {
		try {
			await navigator.clipboard.writeText(text);
			toast('Copied.');
		} catch {
			toast('Copy failed — select the text manually.', 'error');
		}
	}

	const ENDPOINTS = [
		{ method: 'POST', path: '/integrations/ewin/link', purpose: 'Redeem a one-time connection code' },
		{ method: 'POST', path: '/integrations/ewin/session', purpose: 'Mint a GuruSocial session for a hub user (SSO)' },
		{ method: 'POST', path: '/integrations/ewin/identity', purpose: 'Resolve a hub user to its workspace identity' },
		{ method: 'POST', path: '/integrations/ewin/report', purpose: 'Signed aggregate reporting snapshot' },
		{ method: 'POST', path: '/integrations/ewin/revoke', purpose: 'Revoke the source link' },
		{ method: 'GET', path: '/integrations/ewin/health', purpose: 'Unsigned service probe' }
	];

	onMount(async () => {
		load();
		if (backendMode === 'convex') {
			try { wallet = await data.billing.liveBalance($session.token!); } catch { /* silent */ }
		}
	});

	async function sendHeartbeat() {
		hbBusy = true;
		try {
			hb = await data.billing.heartbeat($session.token!);
			toast(hb?.ok ? `Heartbeat accepted by the hub (config v${hb.result?.version ?? '?'}).` : `Heartbeat not accepted: ${hb?.result ?? hb?.detail ?? 'unavailable'}`, hb?.ok ? 'success' : 'info');
		} catch (e: any) {
			toast(e.message, 'error');
		} finally {
			hbBusy = false;
		}
	}

	const naira = (kobo: number | undefined) => (kobo == null ? '—' : '₦' + (kobo / 100).toLocaleString('en-NG', { maximumFractionDigits: 2 }));
</script>

<PageHeader
	eyebrow="Enterprise"
	title="E-WIN ecosystem"
	description="GuruSocial is a source application in the E-WIN central ecosystem. Accounts, sessions and reporting stay in sync through a signed service channel — no shared passwords, no credential exchange."
>
	<button class="btn btn-ghost btn-sm" onclick={load} disabled={loading}>Refresh</button>
	<button class="btn btn-primary btn-sm" onclick={generate} disabled={busy || backendMode !== 'convex'}>
		{busy ? 'Working…' : 'Generate connection code'}
	</button>
</PageHeader>

{#if backendMode !== 'convex'}
	<div class="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
		Hub connection requires the live Convex backend. This build is running on the local demo provider.
	</div>
{/if}

<div class="grid gap-4 lg:grid-cols-3">
	<div class="lg:col-span-2 space-y-4">
		<section class="card p-6">
			<div class="flex flex-wrap items-start justify-between gap-3">
				<div>
					<p class="eyebrow">Connection status</p>
					<h2 class="section-title">
						{#if loading}Checking…
						{:else if status?.linked}Linked to the hub
						{:else}Not linked yet{/if}
					</h2>
				</div>
				<span
					class={`chip ${status?.linked ? 'bg-mint-500/15 text-mint-300 ring-1 ring-mint-500/30' : 'bg-ink-800 text-slate-400 ring-1 ring-ink-700'}`}
				>
					{status?.linked ? '● Active' : '○ Unlinked'}
				</span>
			</div>

			{#if status?.linked}
				<dl class="mt-5 grid gap-3 sm:grid-cols-2">
					<div class="panel px-3.5 py-3">
						<dt class="eyebrow mb-1">Hub user</dt>
						<dd class="break-all font-mono text-xs text-slate-200">{status.hubUserId}</dd>
					</div>
					<div class="panel px-3.5 py-3">
						<dt class="eyebrow mb-1">Hub email</dt>
						<dd class="break-all text-xs text-slate-200">{status.hubEmail}</dd>
					</div>
					<div class="panel px-3.5 py-3">
						<dt class="eyebrow mb-1">Linked</dt>
						<dd class="text-xs text-slate-200">{status.linkedAt ? new Date(status.linkedAt).toLocaleString() : '—'}</dd>
					</div>
					<div class="panel px-3.5 py-3">
						<dt class="eyebrow mb-1">Last report pulled</dt>
						<dd class="text-xs text-slate-200">
							{status.lastReportAt ? new Date(status.lastReportAt).toLocaleString() : 'Not requested yet'}
						</dd>
					</div>
				</dl>
				<div class="mt-4 flex flex-wrap gap-2">
					<button class="btn btn-ghost btn-sm" onclick={disconnect} disabled={busy}>Disconnect</button>
					<a class="btn btn-ghost btn-sm" href="/dashboard/reports">Preview the reporting snapshot</a>
				</div>
			{:else}
				<p class="mt-4 prose-line">
					Generate a one-time code here, then paste it into E-WIN → Settings → Connections. E-WIN redeems it against
					this workspace and can then request aggregate reports. Nothing is shared until you issue the code.
				</p>
			{/if}

			{#if code}
				<div class="mt-5 rounded-xl border border-mint-500/30 bg-mint-500/[0.07] p-4">
					<p class="eyebrow mb-1 text-mint-300">One-time connection code</p>
					<div class="flex flex-wrap items-center gap-3">
						<code class="break-all font-mono text-sm text-mint-200">{code}</code>
						<button class="btn btn-ghost btn-sm" onclick={() => copy(code!)}>Copy</button>
					</div>
					<p class="mt-2 text-2xs text-slate-500">
						Shown once · expires {expiresAt ? new Date(expiresAt).toLocaleTimeString() : 'in 10 minutes'}
					</p>
				</div>
			{/if}
		</section>

		<section class="card p-6">
			<h2 class="section-title mb-1">Signed service endpoints</h2>
			<p class="prose-line mb-4">
				Every call carries <code class="kbd">x-ewin-timestamp</code> and
				<code class="kbd">x-ewin-signature</code> — HMAC-SHA256 over <code class="kbd">path + "\n" + timestamp + "\n" + rawBody</code>.
				Requests outside a five-minute clock window are rejected, and bodies over 4 KB are refused.
			</p>
			<div class="table-wrap">
				<table class="w-full text-left text-sm">
					<thead class="border-b border-ink-800 text-2xs uppercase tracking-wider text-slate-500">
						<tr>
							<th class="py-2 font-semibold">Method</th>
							<th class="py-2 font-semibold">Path</th>
							<th class="py-2 font-semibold">Purpose</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-ink-800">
						{#each ENDPOINTS as endpoint}
							<tr>
								<td class="py-2.5">
									<span class={`chip text-[10px] ${endpoint.method === 'GET' ? 'bg-ink-800 text-slate-300' : 'bg-guru-600/15 text-guru-300'}`}>
										{endpoint.method}
									</span>
								</td>
								<td class="py-2.5 font-mono text-xs text-slate-200">{endpoint.path}</td>
								<td class="py-2.5 text-xs text-slate-400">{endpoint.purpose}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<p class="mt-4 text-2xs leading-relaxed text-slate-600">
				Base URL: <span class="font-mono text-slate-400">{CONVEX_HTTP_URL ?? 'https://beaming-bobcat-890.eu-west-1.convex.site'}</span>
			</p>
		</section>
	</div>

	<div class="space-y-4">
		<section class="card p-5">
			<h2 class="section-title mb-2">How identity sync works</h2>
			<ol class="space-y-3 text-sm">
				<li class="flex gap-3">
					<span class="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-guru-600/20 text-2xs font-bold text-guru-300">1</span>
					<p class="text-slate-400">
						<span class="font-semibold text-slate-200">Hub-first sign-in.</span> A user already signed in to E-WIN is
						provisioned here through <code class="kbd">/integrations/ewin/session</code> and lands on the dashboard
						without a second password.
					</p>
				</li>
				<li class="flex gap-3">
					<span class="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-guru-600/20 text-2xs font-bold text-guru-300">2</span>
					<p class="text-slate-400">
						<span class="font-semibold text-slate-200">Every sign-up and sign-in</span> schedules an outbound identity
						event to <code class="kbd">EWIN_HUB_URL</code>, signed with the shared ecosystem secret, so the hub knows the
						account exists and which hub user owns it.
					</p>
				</li>
				<li class="flex gap-3">
					<span class="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-guru-600/20 text-2xs font-bold text-guru-300">3</span>
					<p class="text-slate-400">
						<span class="font-semibold text-slate-200">Disconnecting</span> revokes the link immediately: report requests
						return an empty snapshot and the session stays local-only.
					</p>
				</li>
			</ol>
		</section>

		<section class="card p-5">
			<h2 class="section-title mb-2">What the hub never receives</h2>
			<ul class="space-y-1.5 text-sm text-slate-400">
			<div class="card mb-4 p-5">
			<h2 class="section-title mb-3">Central wallet & platform heartbeat</h2>
			<div class="grid gap-3 sm:grid-cols-3">
				<div class="rounded-xl bg-ink-900 px-3 py-2.5">
					<p class="text-2xs uppercase tracking-widest text-slate-500">Wallet balance (hub ledger)</p>
					<p class="metric mt-1">{wallet?.exempt ? 'Exempt (super admin)' : wallet?.available ? naira(wallet.availableKobo) : wallet?.linked ? 'Unavailable' : 'Not linked'}</p>
					{#if wallet?.available}<p class="text-2xs text-slate-500">as of {new Date(wallet.asOf).toLocaleTimeString()}</p>{/if}
				</div>
				<div class="rounded-xl bg-ink-900 px-3 py-2.5">
					<p class="text-2xs uppercase tracking-widest text-slate-500">Settlement</p>
					<p class="mt-1 text-sm font-semibold text-white">Central E-WIN ledger only</p>
					<p class="text-2xs text-slate-500">No local balance is stored or calculated.</p>
				</div>
				<div class="rounded-xl bg-ink-900 px-3 py-2.5">
					<p class="text-2xs uppercase tracking-widest text-slate-500">Platform heartbeat</p>
					<button class="btn btn-ghost btn-sm mt-1.5" onclick={sendHeartbeat} disabled={hbBusy}>{hbBusy ? 'Pinging…' : '↻ Send heartbeat'}</button>
					{#if hb?.ok}<p class="mt-1 text-2xs text-mint-400">Last accepted {new Date().toLocaleTimeString()}</p>{/if}
				</div>
			</div>
		</div>

			{#each ['Message bodies and inbox content', 'Platform credentials and OAuth tokens', 'API keys or password material', 'Wallet or payment data'] as item}
					<li class="flex gap-2"><span class="text-slate-600" aria-hidden="true">✕</span>{item}</li>
				{/each}
			</ul>
			<p class="mt-3 text-2xs leading-relaxed text-slate-600">
				Reports carry counts, plans and per-platform aggregate metrics only.
			</p>
		</section>

		{#if status && status.history.length > 0}
			<section class="card p-5">
				<h2 class="section-title mb-2">Link history</h2>
				{#each status.history as link}
					<div class="mb-2 rounded-lg bg-ink-900 px-3 py-2 text-xs">
						<div class="flex items-center justify-between gap-2">
							<span class="truncate font-mono text-[11px] text-slate-300">{link.hubUserId}</span>
							<span class={`chip text-[10px] ${link.status === 'active' ? 'bg-mint-500/15 text-mint-300' : 'bg-ink-800 text-slate-500'}`}>
								{link.status}
							</span>
						</div>
						<p class="mt-1 text-2xs text-slate-600">{new Date(link.linkedAt).toLocaleString()}</p>
					</div>
				{/each}
			</section>
		{/if}
	</div>
</div>
