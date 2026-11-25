<script lang="ts">
	import { signIn, signUp } from '$lib/data';
	import { goto } from '$app/navigation';
	import { toast } from '$lib/stores/toast';

	let mode = $state<'signin' | 'signup'>('signin');
	let email = $state('');
	let name = $state('');
	let password = $state('');
	let busy = $state(false);
	let error = $state('');

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
		<p class="text-xs text-slate-600">Demo data lives in your browser or your own Convex deployment. Nothing is published to real platforms until you connect them.</p>
	</div>

	<div class="flex items-center justify-center p-6">
		<div class="w-full max-w-sm">
			<div class="mb-8 flex items-center gap-2.5 lg:hidden">
				<div class="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-guru-500 to-mint-500 text-lg font-black text-white">G</div>
				<span class="text-lg font-black tracking-tight text-white">GuruSocial</span>
			</div>
			<h1 class="text-2xl font-bold text-white">{mode === 'signin' ? 'Welcome back' : 'Create your workspace'}</h1>
			<p class="mt-1 text-sm text-slate-400">{mode === 'signin' ? 'Sign in to your command center.' : 'Free to start. No credit card required.'}</p>

			<form class="mt-8 space-y-4" onsubmit={submit}>
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
				<button class="btn btn-primary w-full py-3" disabled={busy}>{busy ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Create workspace & start'}</button>
			</form>

			<p class="mt-6 text-center text-sm text-slate-400">
				{mode === 'signin' ? "New to GuruSocial? " : 'Already have a workspace? '}
				<button class="font-semibold text-guru-400 hover:underline" onclick={() => ((mode = mode === 'signin' ? 'signup' : 'signin'), (error = ''))}>
					{mode === 'signin' ? 'Create one free' : 'Sign in'}
				</button>
			</p>
			<a href="/" class="mt-4 block text-center text-xs text-slate-600 hover:text-slate-400">← Back to site</a>
		</div>
	</div>
</div>
