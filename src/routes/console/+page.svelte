<script lang="ts">
	import Logo from '$lib/components/Logo.svelte';
	import { backendMode } from '$lib/data';
	import { ConvexHttpClient } from 'convex/browser';
	import { anyApi } from 'convex/server';
	import { storage } from '$lib/util/storage';
	import { toast } from '$lib/stores/toast';
	import { onMount } from 'svelte';

	const api = anyApi;
	const TOKEN_KEY = 'gurusocial.admin.token.v1';
	const CONVEX_URL = import.meta.env.VITE_CONVEX_URL as string | undefined;

	type TabId = 'overview' | 'users' | 'roles' | 'messages' | 'broadcast' | 'audit' | 'system';

	let token = $state<string | null>(null);
	let email = $state('');
	let password = $state('');
	let busy = $state(false);
	let error = $state('');
	let tab = $state<TabId>('overview');

	let overview = $state<any>(null);
	let users = $state<any[]>([]);
	let activity = $state<any[]>([]);
	let conversations = $state<any[]>([]);
	let activeConversation = $state<string | null>(null);
	let thread = $state<any[]>([]);
	let reply = $state('');
	let newSubject = $state('');
	let newMessage = $state('');
	let targetUser = $state('');
	let broadcastTitle = $state('');
	let broadcastBody = $state('');
	let loading = $state(false);
	let sending = $state(false);

	const client = CONVEX_URL ? new ConvexHttpClient(CONVEX_URL) : null;

	const TABS: Array<{ id: TabId; label: string; icon: string }> = [
		{ id: 'overview', label: 'Overview', icon: '◈' },
		{ id: 'users', label: 'Users', icon: '⚇' },
		{ id: 'roles', label: 'Roles & access', icon: '⚿' },
		{ id: 'messages', label: 'Messages', icon: '✉' },
		{ id: 'broadcast', label: 'Broadcast', icon: '📣' },
		{ id: 'audit', label: 'Audit', icon: '▤' },
		{ id: 'system', label: 'System', icon: '⚙' }
	];

	onMount(() => {
		token = storage.getItem(TOKEN_KEY);
		if (token) void loadAll();
	});

	async function loadAll() {
		if (!client || !token) return;
		loading = true;
		error = '';
		try {
			overview = await client.query(api.adminOps.overview, { adminToken: token });
			users = await client.query(api.adminOps.listUsers, { adminToken: token });
			activity = await client.query(api.adminOps.activity, { adminToken: token, limit: 60 });
		} catch (e: any) {
			error = e.message;
			if (/invalid|expired/i.test(e.message)) endSession();
		} finally {
			loading = false;
		}
	}

	async function signIn(event: SubmitEvent) {
		event.preventDefault();
		if (!client) {
			error = 'The console needs the live Convex backend (VITE_CONVEX_URL is not configured in this build).';
			return;
		}
		error = '';
		busy = true;
		try {
			const res = await client.action(api.admin.signIn, { email, password });
			token = res.token;
			storage.setItem(TOKEN_KEY, res.token);
			password = '';
			toast('Operator session started.');
			await loadAll();
		} catch (e: any) {
			error = e.message;
		} finally {
			busy = false;
		}
	}

	function endSession() {
		storage.removeItem(TOKEN_KEY);
		token = null;
		overview = null;
		users = [];
		activity = [];
		conversations = [];
		thread = [];
	}

	async function loadMessages() {
		if (!client || !token) return;
		try {
			conversations = await client.query(api.messaging.adminList, { adminToken: token });
			if (!activeConversation && conversations.length) await openConversation(conversations[0]._id);
		} catch (e: any) {
			error = e.message;
		}
	}

	async function openConversation(id: string) {
		if (!client || !token) return;
		activeConversation = id;
		try {
			thread = await client.query(api.messaging.adminMessages, { adminToken: token, conversationId: id });
		} catch (e: any) {
			error = e.message;
		}
	}

	async function sendReply(event: SubmitEvent) {
		event.preventDefault();
		if (!client || !token || !activeConversation || !reply.trim()) return;
		sending = true;
		try {
			await client.mutation(api.messaging.adminReply, { adminToken: token, conversationId: activeConversation, body: reply });
			reply = '';
			await openConversation(activeConversation);
			await loadMessages();
		} catch (e: any) {
			toast(e.message, 'error');
		} finally {
			sending = false;
		}
	}

	async function startForUser(event: SubmitEvent) {
		event.preventDefault();
		if (!client || !token || !targetUser) return;
		sending = true;
		try {
			await client.mutation(api.messaging.adminStart, {
				adminToken: token,
				userId: targetUser,
				subject: newSubject,
				body: newMessage
			});
			newSubject = '';
			newMessage = '';
			toast('Message delivered to the user.');
			await loadMessages();
		} catch (e: any) {
			toast(e.message, 'error');
		} finally {
			sending = false;
		}
	}

	async function changeRole(userId: string, role: string) {
		if (!client || !token) return;
		try {
			await client.mutation(api.adminOps.setUserRole, { adminToken: token, userId, role });
			toast('Role updated.');
			await loadAll();
		} catch (e: any) {
			toast(e.message, 'error');
		}
	}

	async function sendBroadcast(event: SubmitEvent) {
		event.preventDefault();
		if (!client || !token) return;
		sending = true;
		try {
			const res = await client.mutation(api.notifications.broadcast, {
				adminToken: token,
				title: broadcastTitle,
				body: broadcastBody
			});
			toast(`Broadcast queued for ${res.recipients} workspace${res.recipients === 1 ? '' : 's'}.`);
			broadcastTitle = '';
			broadcastBody = '';
			await loadAll();
		} catch (e: any) {
			toast(e.message, 'error');
		} finally {
			sending = false;
		}
	}

	async function sendTestEmail() {
		if (!client || !token) return;
		sending = true;
		try {
			const res = await client.action(api.email.sendTestEmail, { adminToken: token });
			toast(`Test email sent via Resend (id ${String(res.id).slice(0, 12)}…).`);
		} catch (e: any) {
			toast(e.message, 'error');
		} finally {
			sending = false;
		}
	}

	function selectTab(id: TabId) {
		tab = id;
		error = '';
		if (id === 'messages' && !conversations.length) void loadMessages();
	}

	const fmtDate = (ts: number) => new Date(ts).toLocaleString();
</script>

<div class="min-h-screen bg-ink-950">
	<header class="border-b border-ink-700 bg-ink-900">
		<div class="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3.5">
			<a href="/" class="flex items-center gap-2.5">
				<Logo size={36} wordClass="text-base" />
				<span class="chip bg-rose-500/15 text-2xs text-rose-300">super admin</span>
			</a>
			<div class="flex items-center gap-2 text-xs text-slate-500">
				{#if backendMode === 'convex'}<span class="chip bg-mint-500/15 text-mint-400">live backend</span>{:else}<span class="chip bg-amber-500/15 text-amber-300">demo backend</span>{/if}
				<a href="/dashboard" class="btn btn-ghost px-2.5 py-1.5">← Return to User View</a>
			</div>
		</div>
	</header>

	<main class="mx-auto max-w-6xl px-4 py-8">
		{#if !token}
			<div class="card mx-auto max-w-sm p-6">
				<h1 class="text-xl font-black text-white">Operator sign-in</h1>
				<p class="mt-1 text-sm text-slate-400">
					Ecosystem access for the E-WIN operator. Credentials are verified server-side against encrypted
					Convex environment variables — never in this bundle.
				</p>
				{#if !CONVEX_URL}
					<div class="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-200">
						This build has no live backend URL, so the console cannot authenticate. Set
						<code>VITE_CONVEX_URL</code> for the deployment and rebuild.
					</div>
				{/if}
				<form class="mt-5 space-y-4" onsubmit={signIn}>
					<div>
						<label class="label" for="ae">Admin email</label>
						<input class="input" id="ae" type="email" bind:value={email} autocomplete="username" required />
					</div>
					<div>
						<label class="label" for="ap">Admin password</label>
						<input class="input" id="ap" type="password" bind:value={password} autocomplete="current-password" required />
					</div>
					{#if error}<p class="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2.5 text-sm text-rose-300" role="alert">{error}</p>{/if}
					<button class="btn btn-primary w-full py-3" disabled={busy || !CONVEX_URL}>{busy ? 'Verifying…' : 'Enter console'}</button>
				</form>
			</div>
		{:else}
			<div class="mb-5 flex flex-wrap items-end justify-between gap-3">
				<div>
					<h1 class="text-2xl font-black tracking-tight text-white">Ecosystem console</h1>
					<p class="mt-1 text-sm text-slate-400">Every workspace on this deployment. Session expires after 12 hours.</p>
				</div>
				<div class="flex flex-wrap gap-2">
					<button class="btn btn-primary" onclick={sendTestEmail} disabled={sending}>{sending ? 'Working…' : '✉ Send test email'}</button>
					<button class="btn btn-ghost" onclick={loadAll} disabled={loading}>{loading ? 'Refreshing…' : '↻ Refresh'}</button>
					<button class="btn btn-ghost" onclick={endSession}>Sign out</button>
				</div>
			</div>

			{#if error}
				<div class="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2.5 text-sm text-rose-300" role="alert">
					<span>{error}</span>
					<button class="text-xs font-semibold underline" onclick={loadAll}>Retry</button>
				</div>
			{/if}

			<nav class="mb-4 flex gap-1 overflow-x-auto rounded-xl border border-ink-700 bg-ink-900 p-1" aria-label="Console sections">
				{#each TABS as t}
					<button
						class={`flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${tab === t.id ? 'bg-guru-600 text-white' : 'text-slate-400 hover:bg-ink-800 hover:text-slate-200'}`}
						onclick={() => selectTab(t.id)}
						aria-current={tab === t.id ? 'page' : undefined}
					>
						<span aria-hidden="true">{t.icon}</span>{t.label}
					</button>
				{/each}
			</nav>

			{#if tab === 'overview'}
				{#if !overview}
					<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
						{#each [0, 1, 2, 3] as i}
							<div class="card h-24 animate-pulse p-4"></div>
						{/each}
					</div>
				{:else}
					<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
						{#each [
							['Workspaces', overview.counts.users, `${overview.counts.newUsers24h} new in 24h`],
							['Posts', overview.counts.posts, `${overview.counts.published} published`],
							['Scheduled', overview.counts.scheduled, `${overview.counts.pendingApproval} awaiting approval`],
							['Connected profiles', overview.counts.profiles, 'across all workspaces'],
							['Conversations', overview.counts.conversations, 'private support threads'],
							['Unread notifications', overview.counts.unreadNotifications, 'in-app outbox'],
							['API keys', overview.counts.apiKeys, 'active, non-revoked'],
							['Harvest jobs', overview.counts.harvestJobs, 'Reverse Studio']
						] as [label, value, note]}
							<div class="card p-4">
								<p class="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
								<p class="mt-1 text-2xl font-bold tabular text-white">{value}</p>
								<p class="mt-0.5 text-2xs text-slate-500">{note}</p>
							</div>
						{/each}
					</div>

					<div class="mt-4 grid gap-4 lg:grid-cols-2">
						<div class="card p-5">
							<h3 class="mb-3 text-sm font-bold text-white">Roles in use</h3>
							{#each overview.roleBreakdown as r}
								<div class="mb-1.5 flex items-center justify-between rounded-lg bg-ink-900 px-3 py-2 text-xs">
									<span class="font-semibold capitalize text-slate-200">{r.role}</span>
									<span class="tabular text-slate-400">{r.count}</span>
								</div>
							{/each}
						</div>
						<div class="card p-5">
							<h3 class="mb-3 text-sm font-bold text-white">Plans</h3>
							{#each overview.planBreakdown as p}
								<div class="mb-1.5 flex items-center justify-between rounded-lg bg-ink-900 px-3 py-2 text-xs">
									<span class="font-semibold capitalize text-slate-200">{p.plan}</span>
									<span class="tabular text-slate-400">{p.count}</span>
								</div>
							{/each}
						</div>
					</div>
					<p class="mt-3 text-2xs text-slate-600">Generated {fmtDate(overview.generatedAt)} · deployment beaming-bobcat-890 (eu-west-1)</p>
				{/if}
			{:else if tab === 'users' || tab === 'roles'}
				<div class="card overflow-hidden">
					<div class="table-wrap">
						<table class="w-full min-w-[640px] text-left text-sm">
							<thead class="border-b border-ink-700 text-2xs uppercase tracking-wide text-slate-500">
								<tr>
									<th class="px-4 py-3">Name</th>
									<th class="px-4 py-3">Email</th>
									<th class="px-4 py-3">Plan</th>
									<th class="px-4 py-3">Role</th>
									<th class="px-4 py-3">Created</th>
								</tr>
							</thead>
							<tbody>
								{#each users as u}
									<tr class="border-b border-ink-800/70 last:border-0">
										<td class="px-4 py-2.5 font-semibold text-slate-100">{u.name}</td>
										<td class="px-4 py-2.5 text-slate-400">{u.email}</td>
										<td class="px-4 py-2.5"><span class="chip bg-ink-800 text-2xs uppercase text-slate-400">{u.plan}</span></td>
										<td class="px-4 py-2.5">
											{#if tab === 'roles'}
												<label class="sr-only" for={`role-${u._id}`}>Role for {u.email}</label>
												<select
													class="input py-1.5 text-xs"
													id={`role-${u._id}`}
													value={u.role}
													onchange={(e) => changeRole(u._id, (e.currentTarget as HTMLSelectElement).value)}
												>
													<option value="owner">owner</option>
													<option value="admin">admin</option>
													<option value="approver">approver</option>
													<option value="member">member</option>
												</select>
											{:else}
												<span class="chip bg-guru-600/15 text-2xs uppercase text-guru-300">{u.role}</span>
											{/if}
										</td>
										<td class="px-4 py-2.5 text-xs text-slate-500">{fmtDate(u.createdAt)}</td>
									</tr>
								{:else}
									<tr><td class="px-4 py-10 text-center text-sm text-slate-500" colspan="5">No users yet. A workspace is created on first sign-up.</td></tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
				{#if tab === 'roles'}
					<p class="mt-3 text-xs leading-relaxed text-slate-500">
						Roles are enforced by the Convex backend on every mutation — the interface only reflects them.
						Changing a role is recorded in the audit register with the operator identity.
					</p>
				{/if}
			{:else if tab === 'messages'}
				<div class="grid gap-4 lg:grid-cols-[300px_1fr]">
					<div class="card overflow-hidden">
						<div class="border-b border-ink-700 px-4 py-3 text-2xs font-bold uppercase tracking-wide text-slate-400">Conversations</div>
						<ul class="max-h-[26rem] overflow-y-auto">
							{#each conversations as c}
								<li>
									<button
										class={`w-full border-b border-ink-800 px-4 py-3 text-left text-xs transition ${activeConversation === c._id ? 'bg-ink-800/70' : 'hover:bg-ink-800/40'}`}
										onclick={() => openConversation(c._id)}
									>
										<p class="truncate font-semibold text-slate-100">{c.subject}</p>
										<p class="mt-0.5 truncate text-slate-500">{c.lastMessagePreview || 'No messages'}</p>
										<p class="mt-1 text-2xs text-slate-600">{fmtDate(c.updatedAt)}</p>
									</button>
								</li>
							{:else}
								<li class="p-4 text-xs text-slate-500">No conversations yet. Users can start one from Messages.</li>
							{/each}
						</ul>
					</div>

					<div class="space-y-4">
						<div class="card flex min-h-[20rem] flex-col">
							{#if !activeConversation}
								<div class="flex flex-1 items-center justify-center p-6 text-xs text-slate-500">Select a conversation.</div>
							{:else}
								<div class="max-h-[22rem] flex-1 space-y-2 overflow-y-auto p-4">
									{#each thread as m (m._id)}
										<div class={`flex ${m.senderKind === 'staff' ? 'justify-end' : 'justify-start'}`}>
											<div class={`max-w-[85%] rounded-2xl px-3 py-2 text-xs ${m.senderKind === 'staff' ? 'bg-guru-600 text-white' : 'bg-ink-800 text-slate-200'}`}>
												<p class="whitespace-pre-wrap break-words">{m.body}</p>
												<p class="mt-1 text-2xs opacity-70">{m.senderName} · {fmtDate(m.createdAt)}</p>
											</div>
										</div>
									{/each}
								</div>
								<form class="flex gap-2 border-t border-ink-700 p-3" onsubmit={sendReply}>
									<label class="sr-only" for="areply">Reply</label>
									<input class="input" id="areply" bind:value={reply} placeholder="Reply as GuruSocial support…" />
									<button class="btn btn-primary" disabled={sending || !reply.trim()}>Send</button>
								</form>
							{/if}
						</div>

						<form class="card space-y-3 p-4" onsubmit={startForUser}>
							<h3 class="text-sm font-bold text-white">Message a workspace</h3>
							<select class="input" bind:value={targetUser} required aria-label="Recipient">
								<option value="">Choose a user…</option>
								{#each users as u}<option value={u._id}>{u.name} — {u.email}</option>{/each}
							</select>
							<input class="input" bind:value={newSubject} placeholder="Subject" />
							<textarea class="input min-h-20" bind:value={newMessage} placeholder="Message" required></textarea>
							<button class="btn btn-ghost" disabled={sending || !targetUser}>Send to user</button>
						</form>
					</div>
				</div>
			{:else if tab === 'broadcast'}
				<form class="card max-w-xl space-y-4 p-5" onsubmit={sendBroadcast}>
					<div>
						<h2 class="text-sm font-bold text-white">Broadcast to every workspace</h2>
						<p class="mt-1 text-xs text-slate-400">
							Creates an in-app notification for each user who has in-app notifications enabled. Email is
							never sent from a broadcast without separate consent.
						</p>
					</div>
					<div>
						<label class="label" for="bt">Title</label>
						<input class="input" id="bt" bind:value={broadcastTitle} maxlength="120" required />
					</div>
					<div>
						<label class="label" for="bb">Message</label>
						<textarea class="input min-h-28" id="bb" bind:value={broadcastBody} maxlength="2000" required></textarea>
					</div>
					<div class="rounded-xl border border-ink-700 bg-ink-900 p-3 text-xs text-slate-400">
						Audience: all {users.length} workspace{users.length === 1 ? '' : 's'} · Channel: in-app · Sender: operator session
					</div>
					<button class="btn btn-primary" disabled={sending}>{sending ? 'Sending…' : 'Queue broadcast'}</button>
				</form>
			{:else if tab === 'audit'}
				<div class="card overflow-hidden">
					<div class="table-wrap">
						<table class="w-full min-w-[640px] text-left text-xs">
							<thead class="border-b border-ink-700 text-2xs uppercase tracking-wide text-slate-500">
								<tr><th class="px-4 py-3">Time</th><th class="px-4 py-3">Actor</th><th class="px-4 py-3">Event</th><th class="px-4 py-3">Target</th><th class="px-4 py-3">Outcome</th></tr>
							</thead>
							<tbody>
								{#each activity as a}
									<tr class="border-b border-ink-800/70 last:border-0">
										<td class="px-4 py-2.5 text-slate-500">{fmtDate(a.createdAt)}</td>
										<td class="px-4 py-2.5 text-slate-300">{a.actor}</td>
										<td class="px-4 py-2.5 font-mono text-2xs text-guru-300">{a.eventType}</td>
										<td class="px-4 py-2.5 text-slate-400">{a.targetType}: {a.targetId}</td>
										<td class="px-4 py-2.5 text-slate-400">{a.outcome}</td>
									</tr>
								{:else}
									<tr><td class="px-4 py-10 text-center text-slate-500" colspan="5">No activity recorded yet.</td></tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
				<p class="mt-3 text-xs text-slate-500">Audit rows never contain message bodies, passwords or secrets.</p>
			{:else if tab === 'system'}
				<div class="grid gap-4 md:grid-cols-2">
					<div class="card p-5">
						<h3 class="text-sm font-bold text-white">Integrations</h3>
						<ul class="mt-3 space-y-2 text-xs">
							{#each [
								['Convex backend', 'beaming-bobcat-890 (eu-west-1)', true],
								['HTTP actions / MCP', 'beaming-bobcat-890.convex.site', true],
								['Resend email', 'onboarding@resend.dev sender', true],
								['Agnes AI (LLM)', 'apihub.agnes-ai.com/v1 · server-side key', true],
								['Cloudflare R2', 'media uploads via presigned PUT', true],
								['Google OAuth', 'redirect: /oauth/google/callback', true],
								['GitHub OAuth', 'redirect: /oauth/github/callback', true],
								['E-WIN hub', 'HMAC-signed reporting channel', true]
							] as [name, detail, ok]}
								<li class="flex items-start justify-between gap-3 rounded-lg bg-ink-900 px-3 py-2">
									<div>
										<p class="font-semibold text-slate-200">{name}</p>
										<p class="text-2xs text-slate-500">{detail}</p>
									</div>
									<span class={`chip text-2xs ${ok ? 'bg-mint-500/15 text-mint-300' : 'bg-amber-500/15 text-amber-300'}`}>{ok ? 'configured' : 'pending'}</span>
								</li>
							{/each}
						</ul>
					</div>
					<div class="card p-5">
						<h3 class="text-sm font-bold text-white">Delivery posture</h3>
						<ul class="mt-3 space-y-2 text-xs text-slate-400">
							<li class="rounded-lg bg-ink-900 px-3 py-2">Pages are static shells — page loads never invoke a Worker.</li>
							<li class="rounded-lg bg-ink-900 px-3 py-2">Dynamic data (auth, posts, inbox, admin) runs only on Convex.</li>
							<li class="rounded-lg bg-ink-900 px-3 py-2">Service worker caches the shell only; authenticated responses are never cached.</li>
							<li class="rounded-lg bg-ink-900 px-3 py-2">R2 holds media; Convex stores metadata and control-plane rows.</li>
						</ul>
					</div>
				</div>
			{/if}
		{/if}
	</main>
</div>
