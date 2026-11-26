<script lang="ts">
	import { data, session } from '$lib/data';
	import { toast } from '$lib/stores/toast';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import { onMount } from 'svelte';

	type Asset = { _id: string; name: string; contentType: string; size: number; url: string; createdAt: number };
	let assets = $state<Asset[]>([]);
	let loading = $state(true);
	let uploading = $state(false);
	let filter = $state('all');

	onMount(async () => {
		try {
			assets = (await data.media.listAssets($session.token!)) as any;
		} catch (e: any) {
			toast(e.message, 'error');
		} finally {
			loading = false;
		}
	});

	function fmtSize(n: number) {
		if (n < 1024) return `${n} B`;
		if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
		return `${(n / 1024 / 1024).toFixed(1)} MB`;
	}

	async function upload() {
		uploading = true;
		try {
			const input = document.createElement('input');
			input.type = 'file';
			input.accept = 'image/*,video/*';
			input.onchange = async () => {
				const file = input.files?.[0];
				if (!file) return;
				const presigned = await data.media.presignUpload($session.token!, file.name, file.type);
				// Demo provider returns a data URL (no upload needed); live provider presigns a PUT.
				let url = presigned.publicUrl;
				if (presigned.uploadUrl.startsWith('http') && !presigned.uploadUrl.startsWith('blob')) {
					const res = await fetch(presigned.uploadUrl, { method: 'PUT', body: file });
					if (!res.ok) throw new Error(`Upload failed (${res.status}).`);
				}
				const id = await data.media.registerAsset($session.token!, {
					name: file.name, contentType: file.type || 'application/octet-stream', size: file.size, url
				});
				assets = [{ _id: id, name: file.name, contentType: file.type || 'application/octet-stream', size: file.size, url, createdAt: Date.now() }, ...assets];
				toast('Asset uploaded to the library.');
			};
			input.click();
		} catch (e: any) {
			toast(e.message, 'error');
		} finally {
			uploading = false;
		}
	}

	async function removeAsset(a: Asset) {
		try {
			await data.media.removeAsset($session.token!, a._id);
			assets = assets.filter((x) => x._id !== a._id);
			toast('Asset removed.');
		} catch (e: any) {
			toast(e.message, 'error');
		}
	}

	function copyUrl(a: Asset) {
		navigator.clipboard.writeText(a.url);
		toast('URL copied to clipboard.');
	}

	const visible = $derived(
		filter === 'all' ? assets : filter === 'image' ? assets.filter((a) => a.contentType.startsWith('image/')) : assets.filter((a) => a.contentType.startsWith('video/'))
	);
</script>

	<header class="page-header">
		<h1 class="page-title">Media library</h1>
		<p class="page-sub">Every image and video uploaded to the workspace — stored on Cloudflare R2, ready to attach to any composer draft. Demo mode inlines files locally.</p>
		<div class="mt-5 flex flex-wrap items-center gap-2">
			<button class="btn btn-primary" onclick={upload} disabled={uploading}>{uploading ? 'Uploading…' : '⇪ Upload asset'}</button>
			<div class="flex gap-1 rounded-lg border border-ink-700 bg-ink-900 p-1">
				{#each ['all', 'image', 'video'] as f}
					<button class="rounded-md px-3 py-1.5 text-xs font-semibold {filter === f ? 'bg-guru-600 text-white' : 'text-slate-400 hover:text-white'}" onclick={() => (filter = f)}>
						{f === 'all' ? 'All' : f === 'image' ? 'Images' : 'Videos'}
					</button>
				{/each}
			</div>
		</div>
	</header>

	{#if loading}
		<p class="mt-8 text-sm text-slate-500">Loading library…</p>
	{:else if visible.length === 0}
		<EmptyState icon="◫" title="No assets yet" message="Upload your first image or video. Assets are reusable across every post and campaign." actionLabel="Upload asset" onAction={upload} />
	{:else}
		<div class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
			{#each visible as a (a._id)}
				<div class="card overflow-hidden">
					<div class="grid aspect-video place-items-center bg-ink-800">
						{#if a.contentType.startsWith('image/')}
							<img src={a.url} alt={a.name} class="h-full w-full object-cover" />
						{:else if a.contentType.startsWith('video/')}
							<video src={a.url} class="h-full w-full object-cover" muted preload="metadata" />
							<span class="chip absolute">▶ video</span>
						{:else}
							<span class="text-3xl">🗎</span>
						{/if}
					</div>
					<div class="p-4">
						<p class="truncate text-sm font-semibold text-white" title={a.name}>{a.name}</p>
						<p class="mt-0.5 text-xs text-slate-500">{fmtSize(a.size)} · {new Date(a.createdAt).toLocaleDateString()}</p>
						<div class="mt-3 flex gap-2">
							<button class="btn btn-ghost btn-sm flex-1" onclick={() => copyUrl(a)}>Copy URL</button>
							<button class="btn btn-sm btn-danger" onclick={() => removeAsset(a)}>Delete</button>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
