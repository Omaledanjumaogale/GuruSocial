<script lang="ts">
	import Shell from '$lib/components/Shell.svelte';
	import { session, restoreSession, storedToken } from '$lib/data';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	let { children }: { children?: any } = $props();
	onMount(async () => {
		// Children mount before parents in Svelte — ensure the session is
		// restored from the persisted token before guarding the route.
		await restoreSession();
		if (!storedToken()) goto('/auth');
	});
</script>

<Shell>
	{@render children()}
</Shell>
