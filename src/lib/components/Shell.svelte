<script lang="ts">
	import { goto } from '$app/navigation';
	import { session, signOut, backendMode } from '$lib/data';
	import Toaster from './Toaster.svelte';
	import { page } from '$app/state';
	import PlatformBadge from './PlatformBadge.svelte';

	const NAV = [
		{ group: 'Command center', items: [
			{ href: '/dashboard', label: 'Overview', icon: '◈' },
			{ href: '/dashboard/composer', label: 'AI Composer', icon: '✦' },
			{ href: '/dashboard/calendar', label: 'Calendar & queue', icon: '▦' },
			{ href: '/dashboard/posts', label: 'Posts & approvals', icon: '▤' },
			{ href: '/dashboard/inbox', label: 'Unified inbox', icon: '✉' }
		]},
		{ group: 'Intelligence', items: [
			{ href: '/dashboard/analytics', label: 'Analytics', icon: '◔' },
			{ href: '/dashboard/agents', label: 'AI agents & automations', icon: '⚙' },
			{ href: '/dashboard/studio', label: 'Visual studio', icon: '▣' }
		]},
		{ group: 'Growth', items: [
			{ href: '/dashboard/crm', label: 'CRM & pipeline', icon: '◔' },
			{ href: '/dashboard/campaigns', label: 'Campaigns', icon: '◈' },
			{ href: '/dashboard/channels', label: 'Channels', icon: '⚯' }
		]},
		{ group: 'Enterprise', items: [
			{ href: '/dashboard/integrations', label: 'Reverse Studio', icon: '⟐' },
			{ href: '/dashboard/developer', label: 'Developer & API', icon: '⌨' },
			{ href: '/dashboard/team', label: 'Team & audit', icon: '⚇' },
			{ href: '/dashboard/settings', label: 'Settings', icon: '⚙' }
		]}
	];

	let { children }: { children?: any } = $props();
	let open = $state(false);
	const user = $derived($session.user);
	const isActive = $derived((href: string) => page.url.pathname === href);
</script>

<div class="flex min-h-screen bg-ink-900">
	<!-- Sidebar: slide-over on mobile, fixed rail on desktop -->
	{#if open}
		<div class="fixed inset-0 z-40 bg-black/60 lg:hidden" role="presentation" onclick={() => (open = false)} onkeydown={(e) => e.key === "Escape" && (open = false)}></div>
	{/if}
	<aside class={`fixed inset-y-0 left-0 z-50 w-72 transform border-r border-ink-700 bg-ink-850 transition-transform duration-200 lg:static lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
		<div class="flex items-center gap-3 px-5 py-5">
			<div class="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-guru-500 to-mint-500 text-lg font-black text-white shadow-lg shadow-guru-600/30">G</div>
			<div>
				<p class="text-base font-black tracking-tight text-white">GuruSocial</p>
				<p class="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Command center</p>
			</div>
		</div>
		<nav class="flex-1 space-y-4 overflow-y-auto px-3 pb-6" style="height: calc(100vh - 6rem)">
			{#each NAV as section}
				<div>
					<p class="mb-1 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-600">{section.group}</p>
					{#each section.items as item}
						<a
							href={item.href}
							onclick={() => open = false}
							class={`mb-0.5 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${isActive(item.href) ? 'bg-guru-600/20 text-white ring-1 ring-guru-500/40' : 'text-slate-400 hover:bg-ink-700/50 hover:text-slate-200'}`}
						>
							<span class={`grid h-6 w-6 place-items-center rounded-lg text-xs ${isActive(item.href) ? 'bg-guru-600 text-white' : 'bg-ink-700 text-slate-400'}`}>{item.icon}</span>
							{item.label}
						</a>
					{/each}
				</div>
			{/each}
		</nav>
		<div class="border-t border-ink-700 px-4 py-3 text-[10px] text-slate-600">
			Backend: {backendMode === 'convex' ? 'Convex (live)' : 'local demo'} · v1.0.0
		</div>
	</aside>

	<div class="flex min-w-0 flex-1 flex-col">
		<header class="sticky top-0 z-30 flex items-center gap-3 border-b border-ink-700 bg-ink-900/85 px-4 py-3 backdrop-blur lg:px-8">
			<button class="btn btn-ghost px-2.5 py-1.5 lg:hidden" onclick={() => (open = true)} aria-label="Open navigation">☰</button>
			<div class="hidden flex-1 lg:block"></div>
			<a href="/docs" class="btn btn-ghost hidden sm:inline-flex">API docs</a>
			<a href="/dashboard/composer" class="btn btn-primary">✦ Compose</a>
			<div class="flex items-center gap-2.5">
				<div class="grid h-9 w-9 place-items-center rounded-full bg-guru-600 text-sm font-bold text-white" title={user?.email}>
					{user?.name?.slice(0, 1)?.toUpperCase() ?? 'U'}
				</div>
				<div class="hidden sm:block">
					<p class="text-sm font-semibold text-white">{user?.name}</p>
					<p class="text-[10px] uppercase tracking-wide text-slate-500">{user?.plan} plan</p>
				</div>
				<button class="btn btn-ghost px-2.5 py-1.5" onclick={() => signOut().then(() => goto('/auth'))} title="Sign out">⇥</button>
			</div>
		</header>
		<main class="mx-auto w-full max-w-7xl flex-1 px-4 py-6 lg:px-8">
			{@render children()}
		</main>
		<Toaster />
	</div>
</div>
