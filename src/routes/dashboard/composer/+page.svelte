<script lang="ts">
	import { data, session, backendMode } from '$lib/data';
	import { generateDrafts, generateWithLLM, extractFromUrl, PLATFORM_SPECS, bestTimes } from '$lib/ai/generator';
	import PlatformBadge from '$lib/components/PlatformBadge.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import { toast } from '$lib/stores/toast';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	let step = $state<'input' | 'preview'>('input');
	let topic = $state('');
	let sourceText = $state('');
	let brandTone = $state('');
	let selected = $state<string[]>(['linkedin', 'x', 'instagram']);
	let drafts = $state<any[]>([]);
	let edited = $state<Record<string, string>>({});
	let generating = $state(false);
	let scheduleMode = $state<'now' | 'next_slot' | 'at'>('next_slot');
	let scheduleAt = $state('');
	let useBrandKit = $state(true);
	let brandKit = $state<any>(null);
	let urlInput = $state('');
	let extracting = $state(false);
	let firstComment = $state('');
	let mediaUrls = $state<string[]>([]);
	let uploadingMedia = $state(false);
	let showConnect = $state(false);

	onMount(async () => {
		try {
			const kits = await data.crm.brandKits($session.token!);
			brandKit = kits[0] ?? null;
		} catch { /* demo fallback */ }
	});

	const platforms = $derived(PLATFORM_SPECS.map((p) => p.slug));
	const selectedDrafts = $derived(drafts.filter((d) => selected.includes(d.platform)));
	const totalLimit = $derived(selectedDrafts.every((d) => d.warnings.length === 0));

	function toggle(platform: string) {
		selected = selected.includes(platform) ? selected.filter((p) => p !== platform) : [...selected, platform];
	}

	async function extract() {
		if (!urlInput.trim()) return;
		extracting = true;
		try {
			const { title, text } = await extractFromUrl(urlInput.trim());
			topic = topic || title;
			sourceText = text;
			toast(`Extracted "${title}". Review and generate.`);
		} catch (e: any) {
			toast(e.message, 'error');
		} finally {
			extracting = false;
		}
	}

	async function attachMedia() {
		uploadingMedia = true;
		try {
			const input = document.createElement('input');
			input.type = 'file';
			input.accept = 'image/*,video/*';
			input.onchange = async () => {
				const file = input.files?.[0];
				if (!file) { uploadingMedia = false; return; }
				try {
					const { uploadUrl, publicUrl } = await data.media.presignUpload($session.token!, file.name, file.type);
					if (uploadUrl.startsWith('data:')) {
						mediaUrls = [...mediaUrls, uploadUrl];
					} else {
						const put = await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'content-type': file.type } });
						if (!put.ok) throw new Error(`R2 upload failed (${put.status}).`);
						mediaUrls = [...mediaUrls, publicUrl];
					}
					toast('Media attached.');
				} catch (e: any) {
					toast(e.message, 'error');
				} finally {
					uploadingMedia = false;
				}
			};
			input.click();
		} catch (e: any) {
			toast(e.message, 'error');
			uploadingMedia = false;
		}
	}

	let pendingCharge = $state<any>(null);
	const naira = (kobo: number) => '₦' + (kobo / 100).toLocaleString('en-NG', { maximumFractionDigits: 2 });

	async function generate() {
		if (!topic.trim() && !sourceText.trim()) {
			toast('Add a topic or a source to start.', 'error');
			return;
		}
		if (!selected.length) {
			toast('Select at least one platform.', 'error');
			return;
		}
		generating = true;
		try {
			const settings = $session.user?.settings as any;
			let result: any[];
			if (backendMode === 'convex') {
				// Pay-as-you-use gate: central E-WIN wallet quote before a billable action.
				const pre = await data.billing.preflight($session.token!, 'record.ai_draft', selected.join(','));
				if (pre.billingEnabled) {
					generating = false;
					pendingCharge = pre;
					return;
				}
				// Live: model-backed generation server-side (Agnes AI hub, key held in Convex).
				result = await runGeneration(settings);
			} else if (settings?.llmProvider && settings?.llmApiKey) {
				result = await generateWithLLM({
					topic, sourceText, brandTone: brandKit?.tone, keyMessages: useBrandKit ? brandKit?.keyMessages : undefined,
					hashtags: useBrandKit ? brandKit?.hashtags : undefined, platforms: selected,
					provider: settings.llmProvider, apiKey: settings.llmApiKey
				});
			} else {
				result = generateDrafts({
					topic, sourceText, brandTone: brandKit?.tone, keyMessages: useBrandKit ? brandKit?.keyMessages : undefined,
					hashtags: useBrandKit ? [...(brandKit?.hashtags ?? []), 'gurusocial'] : ['gurusocial'],
					platforms: selected, variantSeed: Math.floor(Math.random() * 997)
				});
			}
			drafts = result;
			edited = {};
			step = 'preview';
		} catch (e: any) {
			toast(e.message, 'error');
		} finally {
			generating = false;
		}
	}

	async function runGeneration(settings: any): Promise<any[]> {
		try {
			return await data.ai.generate($session.token!, { topic, sourceText, platforms: selected });
		} catch (aiError: any) {
			toast(aiError.message, 'info');
			return generateDrafts({
				topic, sourceText, brandTone: brandKit?.tone, keyMessages: brandKit?.keyMessages,
				hashtags: [...(brandKit?.hashtags ?? []), 'gurusocial'], platforms: selected,
				variantSeed: Math.floor(Math.random() * 997)
			});
		}
	}

	async function confirmCharge() {
		const pre = pendingCharge;
		pendingCharge = null;
		generating = true;
		try {
			await data.billing.hold($session.token!, pre.refId);
			const result = await runGeneration($session.user?.settings as any);
			await data.billing.release($session.token!, pre.refId, `ai_draft.${Date.now().toString(36)}`);
			drafts = result;
			edited = {};
			step = 'preview';
		} catch (e: any) {
			try { await data.billing.refund($session.token!, pre.refId); } catch { /* best-effort */ }
			toast(e.message + ' — the charge was refunded to your E-WIN wallet.', 'error');
		} finally {
			generating = false;
		}
	}

	function regenerate(platform: string) {
		const fresh = generateDrafts({
			topic: topic || 'your idea', sourceText, brandTone: brandKit?.tone,
			keyMessages: brandKit?.keyMessages, hashtags: [...(brandKit?.hashtags ?? []), 'gurusocial'],
			platforms: [platform], variantSeed: Math.floor(Math.random() * 9973)
		});
		drafts = drafts.map((d) => (d.platform === platform ? fresh[0] : d));
		delete edited[platform];
	}

	async function publish() {
		generating = true;
		try {
			const token = $session.token!;
			let scheduledAt: number | undefined;
			if (scheduleMode === 'next_slot') scheduledAt = await data.posts.nextFreeSlot(token);
			else if (scheduleMode === 'at') scheduledAt = new Date(scheduleAt).getTime();
			for (const d of selectedDrafts) {
				await data.posts.create(token, {
					content: edited[d.platform] ?? d.content,
					platforms: [d.platform],
					scheduledAt,
					mediaUrls,
					draft: false,
					generatedBy: 'ai:composer'
				});
			}
			toast(`${selectedDrafts.length} post${selectedDrafts.length > 1 ? 's' : ''} ${scheduledAt ? 'scheduled' : 'published'} — see the calendar.`);
			goto('/dashboard/calendar');
		} catch (e: any) {
			toast(e.message, 'error');
		} finally {
			generating = false;
		}
	}

	async function saveDrafts() {
		generating = true;
		try {
			for (const d of selectedDrafts) {
				await data.posts.create($session.token!, {
					content: edited[d.platform] ?? d.content,
					platforms: [d.platform],
					draft: true,
					generatedBy: 'ai:composer'
				});
			}
			toast('Drafts saved to Posts.');
			goto('/dashboard/posts');
		} catch (e: any) {
			toast(e.message, 'error');
		} finally {
			generating = false;
		}
	}

	function charClass(d: any, value: string) {
		return value.length > d.charLimit ? 'text-rose-400' : value.length > d.charLimit * 0.9 ? 'text-amber-400' : 'text-slate-500';
	}

	const connectedProfiles = $state([]);
</script>

<div class="mx-auto max-w-4xl">
	<h1 class="text-2xl font-black tracking-tight text-white">AI Composer</h1>
	<p class="mt-1 text-sm text-slate-400">Point it at anything — an idea, a URL, pasted notes — and get platform-tuned drafts with per-network character intelligence.</p>

	{#if step === 'input'}
		<div class="card mt-6 space-y-5 p-6">
			<div>
				<label class="label" for="topic">What is this post about?</label>
				<input class="input" id="topic" bind:value={topic} placeholder="e.g. Why per-platform publishing beats copy-paste scheduling" />
			</div>

			<div>
				<label class="label" for="url">Or extract from a URL (article, YouTube link, PDF…)</label>
				<div class="flex gap-2">
					<input class="input" id="url" bind:value={urlInput} placeholder="https://example.com/your-article" />
					<button class="btn btn-ghost shrink-0" onclick={extract} disabled={extracting}>{extracting ? 'Reading…' : 'Extract'}</button>
				</div>
				<p class="mt-1.5 text-xs text-slate-600">Uses the Reader pipeline to turn the page into clean text for the composer.</p>
			</div>

			<div>
				<label class="label" for="source">Or paste source text / notes / transcript (optional)</label>
				<textarea class="input min-h-24" id="source" bind:value={sourceText} placeholder="Paste an article, a customer interview, or your raw notes here…"></textarea>
			</div>

			<div>
				<span class="label">Platforms</span>
				<div class="flex flex-wrap gap-2">
					{#each platforms as slug}
						<button
							onclick={() => toggle(slug)}
							class={`chip border transition ${selected.includes(slug) ? 'border-guru-500 bg-guru-600/25 text-white' : 'border-ink-600 bg-ink-800 text-slate-400 hover:border-guru-500/50'}`}
						>
							<PlatformBadge platform={slug} size="sm" /> {PLATFORM_SPECS.find((p) => p.slug === slug)!.name}
						</button>
					{/each}
				</div>
			</div>

			<div class="grid gap-4 sm:grid-cols-2">
				<div>
					<span class="label">Brand voice {brandKit ? `(${brandKit.name})` : ''}</span>
					<input class="input" bind:value={brandTone} placeholder={brandKit?.tone ?? 'confident, plain-spoken, helpful'} />
					{#if brandKit}
						<label class="mt-2 flex items-center gap-2 text-xs text-slate-400">
							<input type="checkbox" bind:checked={useBrandKit} class="accent-sky-500" />
							Use key messages & hashtags from brand kit
						</label>
					{/if}
				</div>
				<div>
					<span class="label">First comment (optional)</span>
					<input class="input" bind:value={firstComment} placeholder="Links and resources in the reply 👇" />
				</div>
			</div>

			<div>
				<span class="label">Media (R2-backed, direct browser upload)</span>
				<div class="flex flex-wrap items-center gap-2">
					<button class="btn btn-ghost" onclick={attachMedia} disabled={uploadingMedia}>{uploadingMedia ? 'Uploading…' : '⇪ Attach image / video'}</button>
					{#each mediaUrls as u, i}
						<span class="chip max-w-48 truncate bg-ink-700 text-slate-300">{i + 1}. {u.startsWith('data:') ? 'inline file' : u}</span>
					{/each}
				</div>
			</div>

			<div class="flex justify-end">
				<button class="btn btn-primary px-6" onclick={generate} disabled={generating}>{generating ? 'Generating…' : '✦ Generate drafts'}</button>
			</div>
		</div>
	{:else}
		<div class="mt-6 space-y-4">
			<div class="flex flex-wrap items-center justify-between gap-3">
				<button class="btn btn-ghost" onclick={() => (step = 'input')}>← Edit source</button>
				<span class="text-xs text-slate-500">{selectedDrafts.length} draft{selectedDrafts.length > 1 ? 's' : ''} ready{!totalLimit ? ' — fix character limits below' : ''}</span>
			</div>

			{#each selectedDrafts as d}
				{@const spec = PLATFORM_SPECS.find((p) => p.slug === d.platform)}
				<div class="card p-5">
					<div class="mb-3 flex items-center justify-between">
						<div class="flex items-center gap-2">
							<PlatformBadge platform={d.platform} />
							<span class="text-sm font-bold text-white">{spec?.name}</span>
							{#if (spec?.tone === 'concise')}
								<span class="chip bg-ink-700 text-[10px] text-slate-400">tight limit</span>
							{/if}
						</div>
						<button class="btn btn-ghost px-2.5 py-1 text-xs" onclick={() => regenerate(d.platform)}>↻ Regenerate</button>
					</div>
					<!-- per-network preview card -->
					<div class="rounded-xl border border-ink-600 bg-ink-900 p-4">
						<div class="flex items-center gap-2.5">
							<PlatformBadge platform={d.platform} size="lg" />
							<div>
								<p class="text-sm font-bold text-white">{$session.user?.name}</p>
								<p class="text-[10px] text-slate-500">Preview · {spec?.name}</p>
							</div>
						</div>
						<textarea class="mt-3 w-full resize-y rounded-lg bg-transparent text-sm leading-relaxed text-slate-200 outline-none" value={edited[d.platform] ?? d.content} oninput={(e) => (edited[d.platform] = e.currentTarget.value)} rows="6"></textarea>
					</div>
					<div class="mt-2 flex items-center justify-between text-xs">
						<span class={charClass(d, edited[d.platform] ?? d.content)}>
							{(edited[d.platform] ?? d.content).length} / {d.charLimit} characters
						</span>
						{#if d.warnings.length}
							<span class="text-amber-400">⚠ {d.warnings[0]}</span>
						{:else}
							<span class="text-mint-400">✓ fits {spec?.name}</span>
						{/if}
					</div>
				</div>
			{/each}

			<div class="card p-5">
				<span class="label">Deliver</span>
				<div class="flex flex-wrap gap-2">
					{#each ['now', 'next_slot', 'at'] as m}
						<button class={`chip border ${scheduleMode === m ? 'border-guru-500 bg-guru-600/25 text-white' : 'border-ink-600 bg-ink-800 text-slate-400'}`} onclick={() => (scheduleMode = m as any)}>
							{m === 'now' ? 'Publish now' : m === 'next_slot' ? 'Next queue slot' : 'Schedule at…'}
						</button>
					{/each}
				</div>
				{#if scheduleMode === 'next_slot'}
					<p class="mt-2 text-xs text-slate-500">Finds the next open recurring timeslot across your queue — {bestTimes(selected[0] ?? 'linkedin').join(' · ')} are historically strong for {selected[0] ?? 'your platform'}.</p>
				{/if}
				{#if scheduleMode === 'at'}
					<input class="input mt-2" type="datetime-local" bind:value={scheduleAt} />
				{/if}
				<div class="mt-4 flex flex-wrap justify-end gap-2">
					<button class="btn btn-ghost" onclick={saveDrafts} disabled={generating}>Save as drafts</button>
					<button class="btn btn-primary px-6" onclick={publish} disabled={generating || !totalLimit}>{generating ? 'Delivering…' : scheduleMode === 'now' ? 'Publish to all' : 'Schedule all'}</button>
				</div>
			</div>
		</div>
	{/if}
</div>

<Modal bind:open={showConnect} title="Connect a platform">
	<p class="text-sm text-slate-400">Channels are managed in the Channels page — composer drafts will target them once connected.</p>
	<a href="/dashboard/channels" class="btn btn-primary mt-4 w-full">Go to Channels</a>
</Modal>

{#if pendingCharge}
	<div class="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" role="dialog" aria-modal="true">
		<div class="card w-full max-w-md p-6">
			{#if pendingCharge.balanceKobo != null && pendingCharge.balanceKobo < pendingCharge.totalKobo}
				<h3 class="font-display text-lg font-semibold text-white">Insufficient wallet balance</h3>
				<p class="mt-2 text-sm text-slate-400">This action costs <strong class="text-white">{naira(pendingCharge.totalKobo)}</strong> but your E-WIN wallet balance is <strong class="text-white">{naira(pendingCharge.balanceKobo)}</strong>. Payment is processed securely through the central E-WIN ecosystem.</p>
				<div class="mt-5 flex gap-2">
					<a class="btn btn-primary flex-1" href={`https://ewinproject.org/wallet/confirm?quote=${pendingCharge.quoteId}`} target="_blank" rel="noopener">Deposit funds</a>
					<button class="btn btn-ghost" onclick={() => (pendingCharge = null)}>Cancel</button>
				</div>
			{:else}
				<h3 class="font-display text-lg font-semibold text-white">Confirm charge</h3>
				<p class="mt-2 text-sm text-slate-400">AI draft generation is a billable action settled through your central E-WIN wallet.</p>
				<dl class="mt-4 space-y-2 rounded-xl bg-ink-900 p-4 text-sm">
					<div class="flex justify-between"><dt class="text-slate-400">Charge</dt><dd class="font-semibold text-white">{naira(pendingCharge.totalKobo)}</dd></div>
					{#if pendingCharge.balanceKobo != null}<div class="flex justify-between"><dt class="text-slate-400">Wallet balance</dt><dd class="text-slate-200">{naira(pendingCharge.balanceKobo)}</dd></div>{/if}
					{#if pendingCharge.balanceAfterKobo != null}<div class="flex justify-between"><dt class="text-slate-400">Balance after</dt><dd class="text-slate-200">{naira(pendingCharge.balanceAfterKobo)}</dd></div>{/if}
					<div class="flex justify-between"><dt class="text-slate-400">Quote expires</dt><dd class="text-slate-200">{new Date(pendingCharge.expiresAt).toLocaleTimeString()}</dd></div>
				</dl>
				<div class="mt-5 flex gap-2">
					<button class="btn btn-primary flex-1" onclick={confirmCharge}>Confirm & generate</button>
					<button class="btn btn-ghost" onclick={() => (pendingCharge = null)}>Cancel</button>
				</div>
			{/if}
		</div>
	</div>
{/if}
