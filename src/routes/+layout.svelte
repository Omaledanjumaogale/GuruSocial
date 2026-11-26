<script lang="ts">
	import '../app.css';
	import { restoreSession } from '$lib/data';
	import { onMount } from 'svelte';

	let { children } = $props();

	onMount(() => {
		// Never block rendering on session restoration: children render
		// immediately, and the guard in dashboard/+layout.svelte waits for the
		// `ready` flag instead of flashing or redirecting on a stale read.
		restoreSession().catch(() => {});

		if ('serviceWorker' in navigator && import.meta.env.PROD) {
			navigator.serviceWorker
				.register('/sw.js')
				.then((registration) => {
					registration.addEventListener('updatefound', () => {
						const worker = registration.installing;
						if (!worker) return;
						worker.addEventListener('statechange', () => {
							if (worker.state === 'installed' && navigator.serviceWorker.controller) {
								worker.postMessage({ type: 'GS_SKIP_WAITING' });
							}
						});
					});
				})
				.catch(() => {});
		}
	});
</script>

{@render children()}
