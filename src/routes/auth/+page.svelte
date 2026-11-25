<script lang="ts">
	import { signIn, signUp, completeOAuth, data, CONVEX_HTTP_URL, PUBLIC_APP_URL, backendMode } from '$lib/data';
	import { goto } from '$app/navigation';
	import { toast } from '$lib/stores/toast';
	import { onMount } from 'svelte';

	let mode = $state<'signin' | 'signup'>('signin');
	let email = $state('');
	let name = $state('');
	let password = $state('');
	let busy = $state(false);
	let error = $state('');
	let notice = $state('');

	const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
	const GITHUB_CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID as string | undefined;
	const oauthReady = $derived(!!CONVEX_HTTP_URL && (!!GOOGLE_CLIENT_ID || !!GITHUB_CLIENT_ID));

	onMount(async () => {
		// OAuth callback lands here: /auth?token=...&provider=google
		const params = new URLSearchParams(location.search);
		if (params.get('oauth_error')) {
			error = `Sign-in failed: ${params.get('oauth_error')}`;
			history.replaceState(null, '', '/auth');
			return;
		}
		const oauthToken = params.get('token');
		if (oauthToken) {
			try {
				await completeOAuth(oauthToken);
				toast(`Signed in via ${params.get('provider') ?? 'OAuth'}. Welcome!`);
				history.replaceState(null, '', '/dashboard');
				goto('/dashboard', { replaceState: true });
			} catch (e: any) {
				error = e.message;
			}
			return;
		}
	});

	function startOAuth(provider: 'google' | 'github') {
		if (!CONVEX_HTTP_URL) {
			toast('OAuth requires the live backend (VITE_CONVEX_URL).', 'info');
			return;
		}
		// state carries the app URL so the Convex callback redirects back here.
		const state = btoa(JSON.stringify({ a: PUBLIC_APP_URL, s: Math.random().toString(36).slice(2), p: provider }));
		const redirectUri = `${CONVEX_HTTP_URL}/oauth/${provider}/callback`;
		const url = provider === 'google'
			? `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent('openid email profile')}&state=${encodeURIComponent(state)}&prompt=select_account`
			: `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent('read:user user:email')}&state=${encodeURIComponent(state)}`;
		location.href = url;
	}

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		error = '';
		busy = true;
		try {
			if (mode === 'signup') await signUp(email, name, password);
			else await signIn(email, password);
			toast(mode === 'signup' ? 'Welcome to GuruSocial! Your workspace is seeded.' : 'Welcome back.');
			goto('/dashboard');
		} catch (e: any) {
			error = e.message;
		} finally {
			busy = false;
		}
	}
</script>

<div class="grid min-h-screen lg:grid-cols-2">
	<div class="hidden flex-col justify-between border-r border-ink-700 bg-ink-850 p-10 lg:flex">
		<div class="flex items-center gap-2.5">
			<div class="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-guru-500 to-mint-500 text-lg font-black text-white">G</div>
			<span class="text-lg font-black tracking-tight text-white">GuruSocial</span>
		</div>
		<div>
			<h2 class="text-3xl font-black leading-tight text-white">Your entire social operation, harmonized.</h2>
			<p class="mt-4 max-w-md text-sm leading-relaxed text-slate-400">
				Publishing, scheduling, unified inbox, analytics, CRM, agent automations, an MCP server and a developer API — across 15 platforms. New workspaces are seeded with a full demo dataset so every screen is meaningful from the first sign-in.
			</p>
			<div class="mt-6 flex flex-wrap gap-2">
				{#each ['Publishing API', 'AI Composer', 'Unified inbox', 'Analytics', 'CRM', 'Automations', 'MCP'] as f}
					<span class="chip bg-ink-700 text-slate-300">{f}</span>
				{/each}
			</div>
		</div>
		<p class="text-xs text-slate-600">Live Convex backend {backendMode === 'convex' ? 'connected' : 'not configured — running on local demo data'}. Nothing is published to real platforms until you connect them.</p>
	</div>

	<div class="flex items-center justify-center p-6">
		<div class="w-full max-w-sm">
			<div class="mb-8 flex items-center gap-2.5 lg:hidden">
				<div class="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-guru-500 to-mint-500 text-lg font-black text-white">G</div>
				<span class="text-lg font-black tracking-tight text-white">GuruSocial</span>
			</div>
			<h1 class="text-2xl font-bold text-white">{mode === 'signin' ? 'Welcome back' : 'Create your workspace'}</h1>
			<p class="mt-1 text-sm text-slate-400">{mode === 'signin' ? 'Sign in to your command center.' : 'Free to start. No credit card required.'}</p>

			{#if oauthReady}
				<div class="mt-6 space-y-2">
					{#if GOOGLE_CLIENT_ID}
						<button class="btn btn-ghost w-full py-3" onclick={() => startOAuth('google')}>
							<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.52 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81Z"/></svg>
							Continue with Google
						</button>
					{/if}
					{#if GITHUB_CLIENT_ID}
						<button class="btn btn-ghost w-full py-3" onclick={() => startOAuth('github')}>
							<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .3a12 12 0 0 0-3.8 23.38c.6.12.83-.26.83-.57L9 21.07c-3.34.72-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.08-.74.09-.73.09-.73 1.2.09 1.83 1.24 1.83 1.24 1.07 1.83 2.81 1.3 3.5 1 .1-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.52.11-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.65 1.66.24 2.88.12 3.18.77.84 1.23 1.91 1.23 3.22 0 4.61-2.8 5.62-5.48 5.92.43.37.81 1.1.81 2.22l-.01 3.29c0 .31.2.69.82.57A12 12 0 0 0 12 .3Z"/></svg>
							Continue with GitHub
						</button>
					{/if}
					<div class="flex items-center gap-3 py-1 text-[10px] uppercase tracking-widest text-slate-600"><span class="h-px flex-1 bg-ink-700"></span> or email <span class="h-px flex-1 bg-ink-700"></span></div>
				</div>
			{/if}

			<form class="mt-4 space-y-4" onsubmit={submit}>
				{#if mode === 'signup'}
					<div>
						<label class="label" for="name">Your name</label>
						<input class="input" id="name" bind:value={name} placeholder="Ada Lovelace" required />
					</div>
				{/if}
				<div>
					<label class="label" for="email">Email</label>
					<input class="input" id="email" type="email" bind:value={email} placeholder="you@company.com" required autocomplete="email" />
				</div>
				<div>
					<label class="label" for="password">Password</label>
					<input class="input" id="password" type="password" bind:value={password} placeholder={mode === 'signup' ? 'At least 8 characters' : '••••••••'} required minlength="8" autocomplete={mode === 'signup' ? 'new-password' : 'current-password'} />
				</div>
				{#if error}
					<p class="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2.5 text-sm text-rose-300">{error}</p>
				{/if}
				{#if notice}
					<p class="rounded-xl border border-sky-500/40 bg-sky-500/10 px-3 py-2.5 text-sm text-sky-300">{notice}</p>
				{/if}
				<button class="btn btn-primary w-full py-3" disabled={busy}>{busy ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Create workspace & start'}</button>
			</form>

			<p class="mt-6 text-center text-sm text-slate-400">
				{mode === 'signin' ? "New to GuruSocial? " : 'Already have a workspace? '}
				<button class="font-semibold text-guru-400 hover:underline" onclick={() => ((mode = mode === 'signin' ? 'signup' : 'signin'), (error = ''))}>
					{mode === 'signin' ? 'Create one free' : 'Sign in'}
				</button>
			</p>
			<div class="mt-4 flex justify-center gap-4 text-xs text-slate-600">
				<a href="/" class="hover:text-slate-400">← Back to site</a>
				<a href="/console" class="hover:text-slate-400">Admin console</a>
			</div>
		</div>
	</div>
</div>
