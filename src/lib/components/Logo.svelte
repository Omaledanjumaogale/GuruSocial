<script lang="ts">
	/**
	 * GuruSocial logo — rounded-square glyph with a sky→emerald gradient
	 * and a signal-pulse mark, plus the Sora wordmark. Adapts to both themes.
	 */
	let { size = 36, showWord = true, wordClass = '' } = $props();
	const uid = $props.id();
</script>

<span class="inline-flex items-center gap-2.5" aria-label="GuruSocial">
	<svg
		width={size}
		height={size}
		viewBox="0 0 40 40"
		fill="none"
		role="img"
		aria-hidden="true"
		class="shrink-0"
	>
		<defs>
			<linearGradient id="gs-logo-{uid}" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
				<stop stop-color="#38bdf8" />
				<stop offset="0.55" stop-color="#0ea5e9" />
				<stop offset="1" stop-color="#10b981" />
			</linearGradient>
		</defs>
		<rect width="40" height="40" rx="11" fill="url(#gs-logo-{uid})" />
		<!-- signal arc + pulse dot: publishing reach -->
		<path
			d="M11 23.5c2.6-5.4 6.4-8.2 9-8.2s6.4 2.8 9 8.2"
			stroke="white"
			stroke-width="2.6"
			stroke-linecap="round"
			opacity="0.92"
		/>
		<circle cx="20" cy="26.4" r="3" fill="white" />
		<circle cx="29.4" cy="12.6" r="2.1" fill="white" opacity="0.9" />
	</svg>
	{#if showWord}
		<span class="font-display text-[1.06rem] font-bold tracking-[-0.02em] {wordClass}">
			Guru<span class="brand-gradient">Social</span>
		</span>
	{/if}
</span>
