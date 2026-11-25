<script lang="ts">

	const STATUS_META: Record<string, { label: string; cls: string }> = {
		draft: { label: 'Draft', cls: 'bg-slate-600/30 text-slate-300' },
		pending_approval: { label: 'Awaiting approval', cls: 'bg-amber-500/20 text-amber-300' },
		approved: { label: 'Approved', cls: 'bg-mint-500/20 text-mint-400' },
		scheduled: { label: 'Scheduled', cls: 'bg-sky-500/20 text-sky-300' },
		published: { label: 'Published', cls: 'bg-guru-500/20 text-guru-400' },
		failed: { label: 'Failed', cls: 'bg-rose-500/20 text-rose-300' },
		deleted: { label: 'Deleted', cls: 'bg-slate-600/20 text-slate-400' },
		connected: { label: 'Connected', cls: 'bg-mint-500/20 text-mint-400' },
		expiring: { label: 'Expiring soon', cls: 'bg-amber-500/20 text-amber-300' },
		needs_action: { label: 'Action needed', cls: 'bg-rose-500/20 text-rose-300' },
		unread: { label: 'New', cls: 'bg-guru-500/25 text-guru-400' },
		read: { label: 'Read', cls: 'bg-slate-600/30 text-slate-300' },
		replied: { label: 'Replied', cls: 'bg-mint-500/20 text-mint-400' },
		ready: { label: 'Ready', cls: 'bg-mint-500/20 text-mint-400' },
		capturing: { label: 'Capturing', cls: 'bg-sky-500/20 text-sky-300' },
		generating: { label: 'Generating', cls: 'bg-guru-500/20 text-guru-400' },
		queued: { label: 'Queued', cls: 'bg-slate-600/30 text-slate-300' }
	};
	let { status }: { status: string } = $props();
	const meta = $derived(STATUS_META[status] ?? { label: status, cls: 'bg-slate-600/30 text-slate-300' });
</script>

{#key status}
	<span class={`chip ${meta.cls}`}>{meta.label}</span>
{/key}
