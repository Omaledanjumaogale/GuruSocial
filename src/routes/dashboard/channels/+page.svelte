<script lang="ts">
	import { data, session } from '$lib/data';
	import PlatformBadge from '$lib/components/PlatformBadge.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import StatusPill from '$lib/components/StatusPill.svelte';
	import { toast } from '$lib/stores/toast';
	import { onMount } from 'svelte';

	const CATALOG = [
		{ slug: 'facebook', name: 'Facebook', blurb: 'Pages, groups and profile posts. OAuth + page token resolution handled for you.' },
		{ slug: 'instagram', name: 'Instagram', blurb: 'Feed posts, carousels, stories and reels via the two-phase container flow.' },
		{ slug: 'x', name: 'X (Twitter)', blurb: 'Tweet posting with PKCE OAuth and chunked media upload.' },
		{ slug: 'linkedin', name: 'LinkedIn', blurb: 'Profiles and company pages, image upload handshake included.' },
		{ slug: 'tiktok', name: 'TikTok', blurb: 'Video publishing with async processing status polling.' },
		{ slug: 'youtube', name: 'YouTube', blurb: 'Shorts and standard video uploads via the resumable API.' },
		{ slug: 'threads', name: 'Threads', blurb: 'Async container flow — every post, even text, is queued by Meta.' },
		{ slug: 'bluesky', name: 'Bluesky', blurb: 'AT Protocol posting with embed support.' },
		{ slug: 'pinterest', name: 'Pinterest', blurb: 'Pins to boards with image and link destinations.' },
		{ slug: 'telegram', name: 'Telegram', blurb: 'Channel and group broadcast posts.' },
		{ slug: 'whatsapp', name: 'WhatsApp', blurb: 'Business messaging within the 24-hour service window.' },
		{ slug: 'google-business', name: 'Google Business', blurb: 'Posts, hours and profile media for Business Profiles.' },
		{ slug: 'zalo', name: 'Zalo', blurb: 'Vietnam-market pages and OA messaging.' },
		{ slug: 'slack', name: 'Slack', blurb: 'Workspace channel posts for internal distribution.' },
		{ slug: 'discord', name: 'Discord', blurb: 'Server channel announcements for communities.' }
	];

	let profiles = $state<any[]>([]);
	let loading = $state(true);
	let connectTarget = $state<any>(null);
	let mode = $state<'native_oauth' | 'user_api_key'>('native_oauth');
	let credential = $state('');
	let handle = $state('');
	let connecting = $state(false);

	async function load() {
		profiles = await data.profiles.list($session.token!);
		loading = false;
	}
	onMount(load);

	const connected = $derived(new Set(profiles.map((p) => p.platform)));

	async function connect() {
		if (!connectTarget) return;
		connecting = true;
		try {
			if (mode === 'user_api_key' && !credential.trim()) throw new Error('Paste your platform credential, or switch to hosted OAuth.');
			await data.profiles.connect($session.token!, connectTarget.slug, mode, credential.trim() || undefined, handle.trim() || undefined);
			toast(`${connectTarget.name} connected. The publisher adapter now delivers to it.`);
			connectTarget = null;
			credential = '';
			handle = '';
			await load();
		} catch (e: any) {
			toast(e.message, 'error');
		} finally {
			connecting = false;
		}
	}

	async function disconnect(p: any) {
		await data.profiles.disconnect($session.token!, p._id);
		toast(`${p.platform} disconnected.`);
		await load();
	}
</script>

<div>
	<div class="mb-6">
		<h1 class="text-2xl font-black tracking-tight text-white">Channels</h1>
		<p class="mt-1 text-sm text-slate-400">Connect the 15 supported platforms. Hosted OAuth (we own the per-network quirks) or bring your own credential from any provider.</p>
	</div>

	{#if loading}
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{#each Array(6) as _}<div class="card h-32 animate-pulse"></div>{/each}</div>
	{:else}
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each CATALOG as c}
				{@const profile = profiles.find((p) => p.platform === c.slug)}
				<div class="card p-5">
					<div class="flex items-start justify-between">
						<div class="flex items-center gap-2.5">
							<PlatformBadge platform={c.slug} size="lg" />
							<div>
								<h3 class="text-sm font-bold text-white">{c.name}</h3>
								{#if profile}
									<StatusPill status={profile.status} />
								{:else}
									<p class="text-[10px] uppercase tracking-widest text-slate-600">not connected</p>
								{/if}
							</div>
						</div>
					</div>
					<p class="mt-2.5 text-xs leading-relaxed text-slate-500">{c.blurb}</p>
					<div class="mt-3 flex items-center justify-between gap-2">
						{#if profile}
							<span class="text-[10px] text-slate-600">@{profile.handle.replace('@', '')}</span>
							<button class="btn btn-danger px-2.5 py-1 text-xs" onclick={() => disconnect(profile)}>Disconnect</button>
						{:else}
							<span></span>
							<button class="btn btn-primary px-3 py-1.5 text-xs" onclick={() => (connectTarget = c)}>+ Connect</button>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<Modal open={connectTarget !== null} onOpenChange={() => (connectTarget = null)} title={connectTarget ? `Connect ${connectTarget.name}` : ''}>
	{#if connectTarget}
		<div class="space-y-4">
			<div class="flex flex-wrap gap-2">
				<button class={`chip border ${mode === 'native_oauth' ? 'border-guru-500 bg-guru-600/25 text-white' : 'border-ink-600 bg-ink-800 text-slate-400'}`} onclick={() => (mode = 'native_oauth')}>
					Hosted OAuth — GuruSocial's app
				</button>
				<button class={`chip border ${mode === 'user_api_key' ? 'border-guru-500 bg-guru-600/25 text-white' : 'border-ink-600 bg-ink-800 text-slate-400'}`} onclick={() => (mode = 'user_api_key')}>
					Bring your own credential
				</button>
			</div>
			{#if mode === 'native_oauth'}
				<p class="rounded-xl border border-guru-500/30 bg-guru-600/10 p-3 text-xs leading-relaxed text-guru-300">
					In production this launches the platform's OAuth consent screen with GuruSocial's registered app. Platform app review (Meta, TikTok, X) is required before go-live; scopes requested: publish, analytics, inbox.
				</p>
			{:else}
				<div>
					<label class="label" for="cred">{connectTarget.name} credential (key / token)</label>
					<input class="input" id="cred" bind:value={credential} placeholder="Paste the access token or API key…" type="password" />
					<p class="mt-1.5 text-xs text-slate-600">Stored by reference in the secret vault — the raw value is never written to the database or shown again.</p>
				</div>
			{/if}
			<div>
				<label class="label" for="hnd">Handle / page name (optional)</label>
				<input class="input" id="hnd" bind:value={handle} placeholder="@yourhandle" />
			</div>
			<div class="flex justify-end gap-2">
				<button class="btn btn-ghost" onclick={() => (connectTarget = null)}>Cancel</button>
				<button class="btn btn-primary" onclick={connect} disabled={connecting}>{connecting ? 'Connecting…' : 'Connect'}</button>
			</div>
		</div>
	{/if}
</Modal>
