<script lang="ts">
	// Horizontal bar chart for per-platform comparisons.
	let { rows, unit = '' }: { rows?: Array<{ label: string; value: number; color?: string }>; unit?: string } = $props();
	const max = $derived(Math.max(...(rows ?? []).map((r) => r.value), 1));
</script>

<div class="space-y-3">
	{#each rows ?? [] as row}
		<div>
			<div class="mb-1 flex items-center justify-between text-xs">
				<span class="font-semibold text-slate-200">{row.label}</span>
				<span class="tabular-nums text-slate-400">{row.value.toLocaleString()}{unit}</span>
			</div>
			<div class="h-2.5 w-full overflow-hidden rounded-full bg-ink-700">
				<div class="h-full rounded-full transition-all duration-500" style={`width:${(row.value / max) * 100}%; background:${row.color ?? '#6366f1'}`}></div>
			</div>
		</div>
	{/each}
</div>
