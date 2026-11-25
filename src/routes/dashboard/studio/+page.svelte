<script lang="ts">
	import { data, session } from '$lib/data';
	import PlatformBadge from '$lib/components/PlatformBadge.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import { toast } from '$lib/stores/toast';
	import { onMount } from 'svelte';

	let templates = $state<any[]>([]);
	let kits = $state<any[]>([]);
	let loading = $state(true);
	let generating = $state(false);

	async function load() {
		const token = $session.token!;
		[templates, kits] = await Promise.all([data.crm.visualTemplates(token), data.crm.brandKits(token)]);
		loading = false;
	}
	onMount(load);

	async function ensureTemplates() {
		if (!templates.length) {
			await data.crm.seedVisualTemplates($session.token!);
			templates = await data.crm.visualTemplates($session.token!);
		}
	}

	async function generate(t: any) {
		await ensureTemplates();
		generating = true;
		try {
			await data.posts.create($session.token!, {
				content: `[${t.kind}] ${t.defaultPrompt}\n\nGenerated as a ${t.name} for ${t.platform}. Edit the frames in the composer, then schedule.`,
				platforms: [t.platform],
				mediaType: t.kind === 'carousel' ? 'carousel' : t.kind === 'avatar-video' ? 'video' : 'image',
				draft: true,
				generatedBy: 'studio'
			});
			toast(`"${t.name}" draft created — open Posts to edit and schedule.`);
		} catch (e: any) {
			toast(e.message, 'error');
		} finally {
			generating = false;
		}
	}
</script>

<div>
	<div class="mb-6">
		<h1 class="text-2xl font-black tracking-tight text-white">Visual studio</h1>
		<p class="mt-1 text-sm text-slate-400">Template-driven visuals: whiteboard infographics, tutorial carousels, quote cards, slideshows and avatar-video scripts — generated from a prompt and your brand kit.</p>
	</div>

	{#if loading}
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{#each Array(3) as _}<div class="card h-64 animate-pulse"></div>{/each}</div>
	{:else}
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each templates as t}
				<div class="card overflow-hidden">
					<!-- template preview strip -->
					<div class="flex h-36 items-center justify-center gap-2 p-4" style={`background:linear-gradient(135deg, ${t.previewColors[0]}22, ${t.previewColors[1]}22)`}>
						{#each Array(Math.min(t.slots, 5)) as _, i}
							<div class="h-20 w-14 rounded-lg border border-ink-600" style={`background:linear-gradient(160deg, ${t.previewColors[i % 2]}, ${t.previewColors[(i + 1) % 2]})`}></div>
						{/each}
					</div>
					<div class="p-5">
						<div class="flex items-center justify-between">
							<h3 class="text-sm font-bold text-white">{t.name}</h3>
							<PlatformBadge platform={t.platform} size="sm" />
						</div>
						<p class="mt-2 text-xs leading-relaxed text-slate-400">{t.defaultPrompt}</p>
						<button class="btn btn-primary mt-4 w-full" onclick={() => generate(t)} disabled={generating}>✦ Generate from prompt</button>
					</div>
				</div>
			{:else}
				<EmptyState icon="▣" title="Loading templates" message="The studio seeds five template families on first open." />
			{/each}
		</div>

		<div class="card mt-4 p-5">
			<h3 class="mb-3 text-sm font-bold text-white">Brand kits</h3>
			{#each kits as k}
				<div class="mb-3 rounded-xl border border-ink-600 p-4">
					<div class="flex items-center justify-between">
						<p class="text-sm font-bold text-white">{k.name}</p>
						<div class="flex gap-1">{#each k.colors as c}<span class="h-5 w-5 rounded-full border border-ink-600" style={`background:${c}`}></span>{/each}</div>
					</div>
					<p class="mt-1 text-xs text-slate-400">Tone: {k.tone}</p>
					{#if k.keyMessages?.length}<p class="mt-1 text-xs text-slate-500">Key messages: {k.keyMessages.join(' · ')}</p>{/if}
					{#if k.hashtags?.length}<p class="mt-1 text-xs text-slate-500">Hashtags: {k.hashtags.map((h: string) => '#' + h.replace(/^#/, '')).join(' ')}</p>{/if}
				</div>
			{:else}
				<p class="text-sm text-slate-500">Create a brand kit to power tone-consistent generations.</p>
			{/each}
		</div>
	{/if}
</div>
