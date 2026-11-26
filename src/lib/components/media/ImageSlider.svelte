<script lang="ts">
	import { onMount } from 'svelte';

	interface Slide {
		id: string;
		image: string;
		small: string;
		alt: string;
		eyebrow: string;
		title: string;
		body: string;
		keywords: string[];
		href: string;
		cta: string;
	}

	const slides: Slide[] = [
		{
			id: 'publish',
			image: '/images/generated/promo-slide-01.webp',
			small: '/images/responsive/promo-slide-01-640.webp',
			alt: 'A content strategist planning a multi-platform campaign at a dark command-center desk',
			eyebrow: 'Unified publishing',
			title: 'One queue. Fifteen networks.',
			body: 'Compose once and schedule per-platform, with limits, hashtags and first comments handled for each network.',
			keywords: ['Scheduling', '15 platforms', 'Approvals'],
			href: '/dashboard/composer',
			cta: 'Open the composer'
		},
		{
			id: 'engage',
			image: '/images/generated/promo-slide-02.webp',
			small: '/images/responsive/promo-slide-02-640.webp',
			alt: 'A phone publishing a post in a dark studio with indigo and emerald light streaks',
			eyebrow: 'Unified inbox',
			title: 'Every conversation, one cockpit.',
			body: 'Comments, DMs, mentions and reviews arrive together — reply, run an automation, or hand the lead to CRM.',
			keywords: ['Inbox', 'Automations', 'CRM handoff'],
			href: '/dashboard/inbox',
			cta: 'Open the inbox'
		},
		{
			id: 'measure',
			image: '/images/generated/promo-slide-03.webp',
			small: '/images/responsive/promo-slide-03-640.webp',
			alt: 'A small agency team reviewing performance together in a dark meeting room',
			eyebrow: 'Proof of work',
			title: 'Reporting your clients actually read.',
			body: 'Per-platform reach, engagement and follower movement with competitor benchmarks and CSV export.',
			keywords: ['Analytics', 'Benchmarks', 'Export'],
			href: '/dashboard/analytics',
			cta: 'See analytics'
		}
	];

	let index = $state(0);
	let paused = $state(false);
	let timer: ReturnType<typeof setInterval> | null = null;

	const current = $derived(slides[index]);

	function go(next: number) {
		index = (next + slides.length) % slides.length;
	}

	onMount(() => {
		const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		if (reduced) return;
		timer = setInterval(() => {
			if (!paused) go(index + 1);
		}, 7000);
		return () => {
			if (timer) clearInterval(timer);
		};
	});

	function onKeydown(event: KeyboardEvent) {
		if (event.key === 'ArrowRight') go(index + 1);
		if (event.key === 'ArrowLeft') go(index - 1);
	}
</script>

<section
	class="relative overflow-hidden rounded-3xl border border-ink-700 bg-ink-900"
	data-testid="promo-slider"
	aria-roledescription="carousel"
	aria-label="GuruSocial highlights"
	onmouseenter={() => (paused = true)}
	onmouseleave={() => (paused = false)}
	onfocusin={() => (paused = true)}
	onfocusout={() => (paused = false)}
	onkeydown={onKeydown}
>
	<div class="grid items-center gap-0 md:grid-cols-2">
		<div class="order-2 p-6 sm:p-9 md:order-1">
			<p class="chip bg-guru-600/15 text-2xs uppercase tracking-widest text-guru-300">{current.eyebrow}</p>
			<h2 class="mt-3 text-2xl font-black leading-tight text-white sm:text-3xl" aria-live="polite">{current.title}</h2>
			<p class="mt-3 max-w-md text-sm leading-relaxed text-slate-400">{current.body}</p>
			<ul class="mt-4 flex flex-wrap gap-2">
				{#each current.keywords as keyword}
					<li class="chip border border-ink-700 bg-ink-850 text-2xs text-slate-300">{keyword}</li>
				{/each}
			</ul>
			<div class="mt-6 flex flex-wrap items-center gap-2">
				<a class="btn btn-primary" href={current.href}>{current.cta}</a>
				<a class="btn btn-ghost" href="/docs">How the API works</a>
			</div>
		</div>

		<div class="relative order-1 aspect-[16/10] md:order-2 md:aspect-[4/3]">
			{#each slides as slide, i}
				<picture class={`absolute inset-0 transition-opacity duration-500 ${i === index ? 'opacity-100' : 'opacity-0'}`} aria-hidden={i !== index}>
					<source media="(max-width: 640px)" srcset={slide.small} type="image/webp" />
					<img
						src={slide.image}
						alt={slide.alt}
						width="1536"
						height="832"
						loading={i === 0 ? 'eager' : 'lazy'}
						decoding="async"
						class="h-full w-full object-cover"
						data-testid="promo-slide"
					/>
				</picture>
			{/each}
			<div class="absolute inset-0 bg-gradient-to-r from-ink-900 via-ink-900/20 to-transparent md:bg-gradient-to-l"></div>
		</div>
	</div>

	<div class="flex items-center justify-between gap-3 border-t border-ink-700 px-4 py-3">
		<div class="flex gap-1.5" role="tablist" aria-label="Choose a highlight">
			{#each slides as slide, i}
				<button
					role="tab"
					aria-selected={i === index}
					aria-label={slide.eyebrow}
					class={`h-2 rounded-full transition-all ${i === index ? 'w-7 bg-guru-400' : 'w-2 bg-ink-600 hover:bg-ink-600/80'}`}
					onclick={() => go(i)}
				></button>
			{/each}
		</div>
		<div class="flex gap-1.5">
			<button class="btn btn-ghost min-h-9 px-3 py-1.5" onclick={() => go(index - 1)} aria-label="Previous highlight">←</button>
			<button class="btn btn-ghost min-h-9 px-3 py-1.5" onclick={() => go(index + 1)} aria-label="Next highlight">→</button>
		</div>
	</div>
</section>
