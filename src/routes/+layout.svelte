<script lang="ts">
	import '../app.css';
	import { restoreSession } from '$lib/data';
	import { onMount } from 'svelte';

	let ready = $state(false);
	onMount(async () => {
		await restoreSession();
		if ('serviceWorker' in navigator) {
			navigator.serviceWorker.register('/sw.js').catch(() => {});
		}
		ready = true;
	});
	let { children } = $props();
</script>

{@render children()}
