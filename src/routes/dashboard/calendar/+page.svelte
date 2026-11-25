<script lang="ts">
	import { data, session } from '$lib/data';
	import PlatformBadge from '$lib/components/PlatformBadge.svelte';
	import StatusPill from '$lib/components/StatusPill.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import { toast } from '$lib/stores/toast';
	import { onMount } from 'svelte';

	let posts = $state<any[]>([]);
	let slots = $state<any[]>([]);
	let profiles = $state<any[]>([]);
	let loading = $state(true);
	let weekStart = $state(startOfWeek(new Date()));
	let detailPost = $state<any>(null);
	let showSlots = $state(false);

	function startOfWeek(d: Date): number {
		const day = (d.getDay() + 6) % 7; // Monday start
		const dt = new Date(d);
		dt.setDate(d.getDate() - day);
		dt.setHours(0, 0, 0, 0);
		return dt.getTime();
	}

	const days = $derived.by(() => {
		return Array.from({ length: 7 }, (_, i) => new Date(weekStart + i * 864e5));
	});

	function postsFor(date: Date) {
		const key = date.toISOString().slice(0, 10);
		return posts.filter((p) => (p.scheduledAt ? new Date(p.scheduledAt).toISOString().slice(0, 10) === key : false));
	}
	function publishedOn(date: Date) {
		const key = date.toISOString().slice(0, 10);
		return posts.filter((p) => (p.publishedAt ? new Date(p.publishedAt).toISOString().slice(0, 10) === key : false));
	}

	async function load() {
		const token = $session.token!;
		[posts, slots, profiles] = await Promise.all([data.posts.list(token), data.posts.queueSlots(token), data.profiles.list(token)]);
		loading = false;
	}

	onMount(load);

	async function unschedule(p: any) {
		await data.posts.update($session.token!, p._id, { status: 'draft', scheduledAt: null as any });
		toast('Moved back to drafts.');
		await load();
	}

	async function publishNow(p: any) {
		await data.posts.update($session.token!, p._id, { status: 'published', scheduledAt: null as any });
		toast('Published now.');
		await load();
	}

	async function removePost(p: any) {
		await data.posts.remove($session.token!, p._id);
		detailPost = null;
		toast('Post removed.');
		await load();
	}

	const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
	const SLOT_PLATFORMS = ['x', 'linkedin', 'instagram', 'facebook', 'tiktok', 'threads'];

	async function toggleSlot(platform: string, dayIdx: number, time: string) {
		const exists = slots.find((s) => s.platform === platform && s.dayOfWeek === dayIdx && s.timeOfDay === time);
		await data.posts.upsertQueueSlot($session.token!, platform, dayIdx, time, !exists?.active);
		await load();
	}

	const DOWNSHIFT = (i: number) => (i + 6) % 7;
</script>

<div>
	<div class="mb-6 flex flex-wrap items-end justify-between gap-3">
		<div>
			<h1 class="text-2xl font-black tracking-tight text-white">Calendar & queue</h1>
			<p class="mt-1 text-sm text-slate-400">Your week at a glance — scheduled, published, and the recurring slots that fill themselves.</p>
		</div>
		<div class="flex gap-2">
			<button class="btn btn-ghost" onclick={() => (weekStart -= 7 * 864e5)}>← Prev</button>
			<button class="btn btn-ghost" onclick={() => (weekStart = startOfWeek(new Date()))}>This week</button>
			<button class="btn btn-ghost" onclick={() => (weekStart += 7 * 864e5)}>Next →</button>
			<a href="/dashboard/composer" class="btn btn-primary">✦ New post</a>
		</div>
	</div>

	{#if loading}
		<div class="grid animate-pulse gap-3 sm:grid-cols-2 lg:grid-cols-7">{#each Array(7) as _}<div class="card h-40"></div>{/each}</div>
	{:else}
		<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
			{#each days as date, i}
				<div class="card flex min-h-40 flex-col p-3 {date.toDateString() === new Date().toDateString() ? 'ring-1 ring-guru-500/50' : ''}">
					<div class="mb-2 flex items-baseline justify-between">
						<span class="text-[10px] font-bold uppercase tracking-widest text-slate-500">{DAYS[DOWNSHIFT(i)]}</span>
						<span class={`text-sm font-bold ${date.toDateString() === new Date().toDateString() ? 'text-guru-400' : 'text-slate-300'}`}>{date.getDate()}</span>
					</div>
					<div class="space-y-1.5">
						{#each postsFor(date) as p}
							<button class="w-full rounded-lg border border-sky-500/30 bg-sky-500/10 p-2 text-left" onclick={() => (detailPost = p)}>
								<div class="flex items-center gap-1">
									{#each p.platforms.slice(0, 4) as plat}<PlatformBadge platform={plat} size="sm" />{/each}
									<span class="ml-auto text-[10px] tabular-nums text-sky-300">{new Date(p.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
								</div>
								<p class="mt-1 line-clamp-2 text-[11px] leading-snug text-slate-300">{p.content}</p>
							</button>
						{/each}
						{#each publishedOn(date) as p}
							<button class="w-full rounded-lg border border-guru-500/25 bg-guru-600/10 p-2 text-left" onclick={() => (detailPost = p)}>
								<div class="flex items-center gap-1">
									{#each p.platforms.slice(0, 4) as plat}<PlatformBadge platform={plat} size="sm" />{/each}
								</div>
								<p class="mt-1 line-clamp-2 text-[11px] leading-snug text-slate-400">{p.content}</p>
							</button>
						{/each}
					</div>
				</div>
			{/each}
		</div>

		<div class="mt-4 grid gap-4 lg:grid-cols-3">
			<div class="card p-5 lg:col-span-2">
				<div class="mb-3 flex items-center justify-between">
					<h3 class="text-sm font-bold text-white">Recurring queue slots</h3>
					<button class="btn btn-ghost px-2.5 py-1 text-xs" onclick={() => (showSlots = true)}>Edit grid</button>
				</div>
				<div class="overflow-x-auto">
					<table class="w-full text-xs">
						<thead>
							<tr class="text-left text-[10px] uppercase tracking-widest text-slate-500">
								<th class="pb-2">Platform</th>
								{#each DAYS as d}<th class="pb-2 text-center">{d}</th>{/each}
							</tr>
						</thead>
						<tbody>
							{#each SLOT_PLATFORMS as platform}
								<tr class="border-t border-ink-700/60">
									<td class="py-2"><span class="flex items-center gap-1.5 font-semibold text-slate-300"><PlatformBadge platform={platform} size="sm" /> {platform}</span></td>
									{#each DAYS as _, dayIdx}
										{@const active = slots.some((s) => s.platform === platform && s.dayOfWeek === dayIdx && s.active)}
										<td class="py-2 text-center">
											<button
												onclick={() => toggleSlot(platform, dayIdx, active ? slots.find((s) => s.platform === platform && s.dayOfWeek === dayIdx).timeOfDay : '09:00')}
												class={`h-6 w-6 rounded-md text-[10px] font-bold transition ${active ? 'bg-mint-500/25 text-mint-400' : 'bg-ink-700 text-slate-600 hover:bg-ink-600'}`}
											>{active ? '✓' : '+'}</button>
										</td>
									{/each}
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
				<p class="mt-3 text-xs text-slate-500">Composer's "Next queue slot" drops posts into the earliest open slot here — Buffer-style queueing, Blotato-style useNextFreeSlot.</p>
			</div>
			<div class="card p-5">
				<h3 class="mb-3 text-sm font-bold text-white">Coming up</h3>
				{#each posts.filter((p) => p.status === 'scheduled').sort((a, b) => a.scheduledAt - b.scheduledAt).slice(0, 6) as p}
					<button class="mb-2 block w-full rounded-xl p-2 text-left transition hover:bg-ink-700/40" onclick={() => (detailPost = p)}>
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-1.5">
								{#each p.platforms.slice(0, 3) as plat}<PlatformBadge platform={plat} size="sm" />{/each}
							</div>
							<span class="text-[10px] tabular-nums text-slate-500">{new Date(p.scheduledAt).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}</span>
						</div>
						<p class="mt-1 line-clamp-2 text-xs text-slate-300">{p.content}</p>
					</button>
				{:else}
					<p class="text-sm text-slate-500">Nothing scheduled yet. Use the composer.</p>
				{/each}
			</div>
		</div>
	{/if}
</div>

<Modal bind:open={showSlots} title="Recurring timeslots" wide>
	<p class="mb-3 text-sm text-slate-400">Set the daily timeslots per platform. The queue scheduler fills them automatically when you choose "Next queue slot".</p>
	<div class="space-y-3">
		{#each SLOT_PLATFORMS as platform}
			<div class="rounded-xl border border-ink-600 p-3">
				<p class="mb-2 flex items-center gap-2 text-sm font-bold text-white"><PlatformBadge platform={platform} size="sm" /> {platform}</p>
				<div class="flex flex-wrap gap-2">
					{#each ['07:00', '08:00', '09:00', '12:00', '15:00', '17:00', '19:00', '21:00'] as time}
						{@const active = slots.some((s) => s.platform === platform && s.timeOfDay === time && s.active)}
						<button
							class={`chip border ${active ? 'border-mint-500 bg-mint-500/20 text-mint-400' : 'border-ink-600 bg-ink-800 text-slate-500'}`}
							onclick={() => {
								for (let d = 0; d < 7; d++) data.posts.upsertQueueSlot($session.token!, platform, d, time, !active);
								setTimeout(load, 50);
							}}
						>{time}</button>
					{/each}
				</div>
			</div>
		{/each}
	</div>
</Modal>

<Modal open={detailPost !== null} onOpenChange={() => (detailPost = null)} title="Post detail">
	{#if detailPost}
		<p class="whitespace-pre-wrap rounded-xl bg-ink-900 p-4 text-sm leading-relaxed text-slate-200">{detailPost.content}</p>
		<div class="mt-3 flex items-center gap-2">
			{#each detailPost.platforms as plat}<PlatformBadge platform={plat} />{/each}
			<StatusPill status={detailPost.status} />
			<span class="ml-auto text-xs text-slate-500">{detailPost.scheduledAt ? new Date(detailPost.scheduledAt).toLocaleString() : detailPost.publishedAt ? 'Published ' + new Date(detailPost.publishedAt).toLocaleString() : ''}</span>
		</div>
		{#if detailPost.status === 'scheduled'}
			<div class="mt-4 flex justify-end gap-2">
				<button class="btn btn-ghost" onclick={() => unschedule(detailPost).then(() => (detailPost = null))}>Move to drafts</button>
				<button class="btn btn-primary" onclick={() => publishNow(detailPost).then(() => (detailPost = null))}>Publish now</button>
			</div>
		{:else}
			<div class="mt-4 flex justify-end">
				<button class="btn btn-danger" onclick={() => removePost(detailPost)}>Delete post</button>
			</div>
		{/if}
	{/if}
</Modal>
