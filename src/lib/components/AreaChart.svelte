<script lang="ts">
	// Dependency-free SVG area chart (Metricool/Sprout-style overview line).
	let { points, height = 160, color = '#6366f1', fill = true }: { points?: Array<{ v: number }>; height?: number; color?: string; fill?: boolean } = $props();

	const path = $derived.by(() => {
		const pts = points ?? [];
		if (!pts.length) return '';
		const max = Math.max(...pts.map((p) => p.v), 1);
		const w = 100;
		const step = pts.length > 1 ? w / (pts.length - 1) : w;
		const coords = pts.map((p, i) => [i * step, 100 - (p.v / max) * 92]);
		const d = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c[0].toFixed(2)},${c[1].toFixed(2)}`).join(' ');
		return d;
	});
	const areaPath = $derived(path + ' L100,100 L0,100 Z');
</script>

<svg viewBox="0 0 100 100" preserveAspectRatio="none" style={`height:${height}px`} class="w-full">
	{#if fill && path}
		<path d={areaPath} fill={color} opacity="0.14" />
	{/if}
	{#if path}
		<path d={path} fill="none" stroke={color} stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" />
	{/if}
</svg>
