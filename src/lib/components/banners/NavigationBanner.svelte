<script lang="ts">
	interface Props {
		id: string;
		inscription: string;
		description: string;
		href: string;
		theme: 'indigo' | 'mint' | 'amber';
	}

	let { id, inscription, description, href, theme }: Props = $props();

	const palette = {
		indigo: { from: '#4f46e5', to: '#6366f1', text: '#c7d2fe' },
		mint: { from: '#0f766e', to: '#22c55e', text: '#a7f3d0' },
		amber: { from: '#b45309', to: '#f59e0b', text: '#fde68a' }
	}[theme];
</script>

<a
	href={href}
	class="group relative block overflow-hidden rounded-2xl border border-ink-700 bg-ink-900 transition hover:border-ink-600"
	aria-label={`${inscription} — ${description}`}
	data-banner={id}
>
	<svg class="absolute inset-0 h-full w-full opacity-60" viewBox="0 0 600 120" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
		<defs>
			<linearGradient id={`grad-${id}`} x1="0" y1="0" x2="1" y2="1">
				<stop offset="0%" stop-color={palette.from} stop-opacity="0.55" />
				<stop offset="100%" stop-color={palette.to} stop-opacity="0.05" />
			</linearGradient>
			<pattern id={`grid-${id}`} width="22" height="22" patternUnits="userSpaceOnUse" patternTransform={`rotate(${(id.length % 4) * 9 - 12})`}>
				<path d="M22 0H0v22" fill="none" stroke={palette.to} stroke-opacity="0.16" stroke-width="1" />
			</pattern>
		</defs>
		<rect width="600" height="120" fill={`url(#grid-${id})`} />
		<rect width="600" height="120" fill={`url(#grad-${id})`} />
		<circle cx={520 - (id.length % 5) * 30} cy="60" r="72" fill="none" stroke={palette.to} stroke-opacity="0.25" stroke-width="1.5" />
	</svg>
	<div class="relative flex flex-wrap items-center justify-between gap-3 p-5">
		<div class="min-w-0">
			<p class="text-2xs font-black uppercase tracking-[0.2em]" style={`color:${palette.text}`}>{inscription}</p>
			<p class="mt-1 text-sm text-slate-300">{description}</p>
		</div>
		<span class="btn btn-ghost min-h-9 shrink-0 px-3 py-1.5 text-xs transition group-hover:bg-ink-800">
			Open <span aria-hidden="true">→</span>
		</span>
	</div>
</a>
