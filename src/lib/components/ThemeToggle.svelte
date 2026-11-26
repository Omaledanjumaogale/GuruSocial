<script lang="ts">
	/** Theme switch — dark (true black) / light (white). Persisted, no flash. */
	let { compact = false } = $props();

	let theme = $state<'dark' | 'light'>(
		typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'light'
			? 'light'
			: 'dark'
	);

	function toggle() {
		theme = theme === 'dark' ? 'light' : 'dark';
		document.documentElement.setAttribute('data-theme', theme);
		localStorage.setItem('gurusocial.theme', theme);
	}
</script>

<button
	type="button"
	class="btn btn-sm btn-ghost !px-2.5"
	onclick={toggle}
	aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
	title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
>
	{#if theme === 'dark'}
		<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
			<circle cx="12" cy="12" r="4.2" />
			<path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5.3 5.3l1.7 1.7M17 17l1.7 1.7M18.7 5.3L17 7M7 17l-1.7 1.7" />
		</svg>
		{#if !compact}<span class="hidden sm:inline">Light</span>{/if}
	{:else}
		<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
			<path d="M20.4 14.2A8.6 8.6 0 0 1 9.8 3.6a8.6 8.6 0 1 0 10.6 10.6Z" />
		</svg>
		{#if !compact}<span class="hidden sm:inline">Dark</span>{/if}
	{/if}
</button>
