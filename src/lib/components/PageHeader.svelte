<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		eyebrow,
		title,
		description,
		children
	}: {
		eyebrow?: string;
		title: string;
		description?: string;
		children?: Snippet;
	} = $props();
</script>

<header class="mb-7 flex flex-col gap-4 border-b border-ink-800 pb-6 sm:flex-row sm:items-end sm:justify-between">
	<div class="min-w-0">
		{#if eyebrow}<p class="eyebrow">{eyebrow}</p>{/if}
		<h1 class="page-title">{title}</h1>
		{#if description}<p class="page-sub">{description}</p>{/if}
	</div>
	{#if children}
		<div class="flex flex-wrap items-center gap-2">{@render children()}</div>
	{/if}
</header>
