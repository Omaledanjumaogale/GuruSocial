<script lang="ts">
	import Logo from '$lib/components/Logo.svelte';
	import { storedToken } from '$lib/data';
	import { onMount } from 'svelte';

	let hasSession = $state(false);
	onMount(() => {
		hasSession = !!storedToken();
	});

	const PLANS = [
		{
			id: 'free',
			name: 'Free',
			price: '0',
			cadence: 'forever',
			summary: 'One workspace, the full dashboard and the demo dataset.',
			features: ['1 workspace', '9 connected channels', 'AI composer', 'Unified inbox', '30-day analytics', 'API sandbox keys']
		},
		{
			id: 'starter',
			name: 'Starter',
			price: '19',
			cadence: 'per month',
			summary: 'For a solo operator running a real publishing calendar.',
			features: ['3 team members', 'Live API keys', 'Scheduled queue', '90-day analytics', 'CSV reports', 'Email notifications'],
			highlight: true
		},
		{
			id: 'pro',
			name: 'Pro',
			price: '49',
			cadence: 'per month',
			summary: 'For in-house teams with approvals and automations.',
			features: ['10 team members', 'Approval workflow', 'Keyword automations', 'Competitor benchmarks', 'Webhooks', 'Priority support']
		},
		{
			id: 'agency',
			name: 'Agency',
			price: '129',
			cadence: 'per month',
			summary: 'Multi-client operations with per-client access.',
			features: ['Unlimited members', 'Per-client API keys', 'Brand kits', 'White-label reports', 'Audit trail', 'E-WIN hub sync']
		},
		{
			id: 'enterprise',
			name: 'Enterprise',
			price: 'Custom',
			cadence: 'annual',
			summary: 'Procurement, residency and custom platform connectors.',
			features: ['SSO via the E-WIN hub', 'Custom connectors', 'Dedicated environment', 'Data processing agreement', '99.9% uptime target', 'Named engineer']
		}
	];
</script>

<div class="min-h-screen">
	<nav class="sticky top-0 z-40 border-b border-ink-800 bg-ink-950/85 backdrop-blur">
		<div class="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
			<a href="/" class="flex items-center gap-2.5">
				<Logo size={32} wordClass="text-base" />
			</a>
			<div class="flex items-center gap-2">
				<a href="/docs" class="btn btn-ghost btn-sm hidden sm:inline-flex">API docs</a>
				<a href={hasSession ? '/dashboard' : '/auth'} class="btn btn-primary btn-sm">
					{hasSession ? 'Open dashboard' : 'Start free'}
				</a>
			</div>
		</div>
	</nav>

	<main class="mx-auto max-w-6xl px-4 py-14">
		<header class="mx-auto max-w-2xl text-center">
			<p class="eyebrow">Plans</p>
			<h1 class="font-display text-display-md font-semibold tracking-tight text-white">Priced for the work, not the seats you might add.</h1>
			<p class="mt-4 text-sm leading-relaxed text-slate-400">
				Every plan includes the full publishing pipeline, unified inbox, analytics and the developer API. Higher tiers add
				team controls, automation volume and ecosystem integration.
			</p>
		</header>

		<div class="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each PLANS as plan}
				<section class={`card flex flex-col p-6 ${plan.highlight ? 'ring-1 ring-guru-500/40' : ''}`}>
					<div class="flex items-center justify-between">
						<h2 class="font-display text-lg font-semibold text-white">{plan.name}</h2>
						{#if plan.highlight}<span class="chip bg-guru-600/15 text-[10px] text-guru-300 ring-1 ring-guru-500/30">Most popular</span>{/if}
					</div>
					<p class="mt-4 flex items-baseline gap-1.5">
						<span class="font-display text-3xl font-semibold tracking-tight text-white">
							{plan.price === 'Custom' ? 'Custom' : `$${plan.price}`}
						</span>
						<span class="text-xs text-slate-500">{plan.cadence}</span>
					</p>
					<p class="mt-2 text-sm leading-relaxed text-slate-400">{plan.summary}</p>
					<ul class="mt-5 flex-1 space-y-2 text-sm text-slate-300">
						{#each plan.features as feature}
							<li class="flex items-start gap-2"><span class="mt-0.5 text-mint-400" aria-hidden="true">✓</span>{feature}</li>
						{/each}
					</ul>
					<a
						class={`btn mt-6 w-full ${plan.highlight ? 'btn-primary' : 'btn-ghost'}`}
						href={hasSession ? '/dashboard/settings' : '/auth'}
					>
						{plan.id === 'enterprise' ? 'Talk to the operator team' : hasSession ? 'View workspace' : 'Start free'}
					</a>
				</section>
			{/each}
		</div>

		<p class="mx-auto mt-10 max-w-2xl text-center text-xs leading-relaxed text-slate-600">
			Plan changes are applied by the E-WIN operator team — automated billing is not enabled in this deployment. Every
			workspace starts on the Free plan with the full product available.
		</p>

		<div class="mt-10 text-center">
			<a href="/" class="text-xs text-slate-500 hover:text-slate-300">← Back to GuruSocial</a>
		</div>
	</main>
</div>
