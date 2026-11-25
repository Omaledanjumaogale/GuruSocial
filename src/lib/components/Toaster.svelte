<script lang="ts">
	import { toasts } from '$lib/stores/toast';
</script>

<div class="fixed bottom-4 right-4 z-[70] flex w-[min(92vw,22rem)] flex-col gap-2">
	{#each $toasts as t (t.id)}
		<div
			class={`pointer-events-auto rounded-xl border px-4 py-3 text-sm font-medium shadow-2xl backdrop-blur ${
				t.kind === 'success'
					? 'border-mint-500/40 bg-mint-500/15 text-mint-400'
					: t.kind === 'error'
						? 'border-rose-500/40 bg-rose-500/15 text-rose-300'
						: 'border-guru-500/40 bg-guru-500/15 text-guru-400'
			}`}
			role="status"
		>
			{t.message}
		</div>
	{/each}
</div>
