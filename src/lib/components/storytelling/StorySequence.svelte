<script lang="ts">
	interface Stage {
		step: string;
		title: string;
		body: string;
		image: string;
		small: string;
		alt: string;
	}

	const stages: Stage[] = [
		{
			step: '01 · The customer',
			title: 'You run the whole social operation',
			body: 'Agencies and in-house teams juggle a dozen tools: one for scheduling, one for replies, one for reports, another spreadsheet for leads. The work is real — the fragmentation is not your fault.',
			image: '/images/generated/story-customer.webp',
			small: '/images/responsive/story-customer-640.webp',
			alt: 'A social media manager working late surrounded by too many open screens'
		},
		{
			step: '02 · The turning point',
			title: 'One workspace instead of seven tabs',
			body: 'GuruSocial brings publishing, the inbox, analytics, CRM and automations into a single command center — with an API and MCP server so your own tools plug in too.',
			image: '/images/generated/story-discovery.webp',
			small: '/images/responsive/story-discovery-640.webp',
			alt: 'A calm, minimal desk with a single dashboard after the work has been consolidated'
		},
		{
			step: '03 · The outcome',
			title: 'Plan once, approve once, measure once',
			body: 'Queue a week across every network, route drafts through approval, answer customers where they are, and export a report that matches what actually happened. No inflated numbers, no pretend delivery.',
			image: '/images/generated/story-guide.webp',
			small: '/images/responsive/story-guide-640.webp',
			alt: 'A marketing lead presenting a unified social calendar to colleagues'
		}
	];
</script>

<section class="mx-auto max-w-6xl px-4 pb-16" aria-labelledby="story-heading">
	<h2 id="story-heading" class="text-2xl font-bold text-white">Built around how social teams actually work</h2>
	<p class="mt-2 max-w-2xl text-slate-400">
		The product is the guide; you are the one doing the work. Here is the progression every workspace follows.
	</p>
	<div class="mt-8 space-y-4">
		{#each stages as stage, i}
			<article class={`card grid items-center gap-0 overflow-hidden md:grid-cols-2 ${i % 2 === 1 ? 'md:[&>figure]:order-2' : ''}`}>
				<div class="p-6 sm:p-8">
					<p class="text-2xs font-bold uppercase tracking-widest text-guru-300">{stage.step}</p>
					<h3 class="mt-2 text-xl font-bold text-white">{stage.title}</h3>
					<p class="mt-2 text-sm leading-relaxed text-slate-400">{stage.body}</p>
				</div>
				<figure class="relative aspect-[16/10] border-t border-ink-700 md:border-l md:border-t-0">
					<picture>
						<source media="(max-width: 640px)" srcset={stage.small} type="image/webp" />
						<img
							src={stage.image}
							alt={stage.alt}
							width="1536"
							height="832"
							loading="lazy"
							decoding="async"
							class="h-full w-full object-cover"
						/>
					</picture>
				</figure>
			</article>
		{/each}
	</div>
</section>
