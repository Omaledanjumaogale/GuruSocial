<script lang="ts">
	let { open = $bindable(false), title = '', children = null, wide = false, onOpenChange }: { open?: boolean; title?: string; children?: any; wide?: boolean; onOpenChange?: () => void } = $props();
	function close() {
		open = false;
		onOpenChange?.();
	}
</script>

{#if open}
	<div class="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-6" role="presentation" onclick={(e) => e.target === e.currentTarget && close()} onkeydown={(e) => e.key === "Escape" && close()}>
		<div class={`card w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} max-h-[88vh] overflow-y-auto rounded-b-none sm:rounded-2xl`} role="dialog" aria-modal="true">
			<div class="sticky top-0 flex items-center justify-between border-b border-ink-700 bg-ink-850/95 px-5 py-3.5 backdrop-blur">
				<h2 class="text-base font-bold text-white">{title}</h2>
				<button class="btn btn-ghost px-2.5 py-1" onclick={close} aria-label="Close">✕</button>
			</div>
			<div class="p-5">
				{#if children}{@render children()}{/if}
			</div>
		</div>
	</div>
{/if}
