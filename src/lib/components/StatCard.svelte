<script lang="ts">
	let { label, value, delta, hint }: { label: string; value: string; delta?: number; hint?: string } = $props();
</script>

<div class="card p-4">
	<p class="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
	<p class="mt-1 text-2xl font-bold text-white tabular-nums">{value}</p>
	{#if delta !== undefined}
		<p class={`mt-1 text-xs font-semibold ${delta >= 0 ? 'text-mint-400' : 'text-rose-400'}`}>
			{delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}% vs previous period
		</p>
	{/if}
	{#if hint}
		<p class="mt-1 text-xs text-slate-500">{hint}</p>
	{/if}
</div>
