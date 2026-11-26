<script lang="ts">
	import Logo from '$lib/components/Logo.svelte';
	import Shell from '$lib/components/Shell.svelte';
	import { session, restoreSession } from '$lib/data';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	let { children }: { children?: any } = $props();
	let checked = $state(false);

	onMount(() => {
		const finish = (signedIn: boolean) => {
			checked = true;
			if (!signedIn) goto('/auth', { replaceState: true });
		};

		// The root layout already started a restore; await the shared state so we
		// never redirect a signed-in user during a slow backend call.
		if ($session.ready) {
			finish(!!$session.token);
			return;
		}

		let settled = false;
		const unsubscribe = session.subscribe((value) => {
			if (settled || !value.ready) return;
			settled = true;
			finish(!!value.token);
		});

		// If the backend is slow, verify directly — restoreSession always resolves.
		const timer = setTimeout(async () => {
			if (settled) return;
			await restoreSession();
			if (!settled) {
				settled = true;
				finish(!!$session.token);
			}
		}, 1500);

		return () => {
			clearTimeout(timer);
			unsubscribe();
		};
	});
</script>

{#if checked}
	<Shell>
		{@render children()}
	</Shell>
{:else}
	<div class="flex min-h-screen items-center justify-center bg-ink-950" aria-busy="true" aria-live="polite">
		<div class="flex flex-col items-center gap-4">
			<div class="grid h-11 w-11 place-items-center rounded-xl"><Logo size={44} showWord={false} /></div>
			<div class="h-1 w-36 overflow-hidden rounded-full bg-ink-700">
				<div class="h-full w-1/2 animate-pulse rounded-full bg-guru-500"></div>
			</div>
			<p class="text-xs text-slate-500">Restoring your workspace…</p>
		</div>
	</div>
{/if}
