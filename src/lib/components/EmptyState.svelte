<script lang="ts">
	let { icon = '📡', title, message, actionLabel, onAction }: { icon?: string; title: string; message: string; actionLabel?: string; onAction?: () => void } = $props();
</script>

<div class="card flex flex-col items-center gap-3 px-6 py-12 text-center">
	<div class="grid h-14 w-14 place-items-center rounded-2xl bg-ink-700 text-2xl">{icon}</div>
	<h3 class="text-base font-bold text-white">{title}</h3>
	<p class="max-w-sm text-sm text-slate-400">{message}</p>
	{#if actionLabel}
		<button class="btn btn-primary" onclick={onAction}>{actionLabel}</button>
	{/if}
</div>
