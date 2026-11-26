<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { session, signOut, backendMode, storedToken, dataSource, data } from '$lib/data';
	import { can } from '$lib/auth/rbac';
	import { NAVIGATION, MOBILE_NAV } from '$lib/config/navigation';
	import Toaster from './Toaster.svelte';
	import Logo from './Logo.svelte';
	import ThemeToggle from './ThemeToggle.svelte';
	import { toast } from '$lib/stores/toast';
	import { onMount } from 'svelte';

	let { children }: { children?: any } = $props();
	let open = $state(false);
	let installEvent = $state<any>(null);
	let messagesUnread = $state(0);
	let notificationCount = $state(0);

	const user = $derived($session.user);
	const token = $derived($session.token);
	const visibleNav = $derived(
		NAVIGATION.map((section) => ({
			...section,
			items: section.items.filter((item) => !item.permission || can(user, item.permission))
		})).filter((section) => section.items.length > 0)
	);
	const allItems = $derived(NAVIGATION.flatMap((section) => section.items));
	const current = $derived(
		allItems.find((item) => item.href === page.url.pathname) ??
			allItems
				.filter((item) => item.href !== '/dashboard' && page.url.pathname.startsWith(item.href))
				.sort((a, b) => b.href.length - a.href.length)[0] ??
			null
	);
	const initials = $derived(
		(user?.name ?? 'G')
			.split(/\s+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((part) => part[0]?.toUpperCase())
			.join('') || 'G'
	);

	onMount(() => {
		const handler = (event: Event) => {
			event.preventDefault();
			installEvent = event;
		};
		window.addEventListener('beforeinstallprompt', handler);
		void refreshCounts();
		const interval = setInterval(refreshCounts, 60_000);
		return () => {
			window.removeEventListener('beforeinstallprompt', handler);
			clearInterval(interval);
		};
	});

	async function refreshCounts() {
		if (!storedToken() || !$session.token) return;
		try {
			const [m, n] = await Promise.all([
				data.messaging.unreadCount($session.token),
				data.notifications.unreadCount($session.token)
			]);
			messagesUnread = m;
			notificationCount = n;
		} catch {
			/* counts are decorative; never block the shell */
		}
	}

	async function installApp() {
		if (installEvent) {
			installEvent.prompt();
			const choice = await installEvent.userChoice;
			if (choice?.outcome === 'accepted') toast('GuruSocial installed.');
			installEvent = null;
			return;
		}
		toast(
			'On iPhone/iPad: Share → Add to Home Screen. On desktop Chrome/Edge: install icon in the address bar.',
			'info'
		);
	}
</script>

<div class="flex min-h-screen bg-ink-950">
	{#if open}
		<div
			class="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
			role="presentation"
			onclick={() => (open = false)}
			onkeydown={(e) => e.key === 'Escape' && (open = false)}
		></div>
	{/if}

	<aside
		class={`fixed inset-y-0 left-0 z-50 flex w-[17rem] transform flex-col border-r border-ink-800 bg-ink-900 transition-transform duration-200 lg:static lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}
		aria-label="Workspace navigation"
	>
		<div class="flex items-center gap-3 border-b border-ink-800 px-5 py-5">
			<Logo size={36} />
			<div class="min-w-0">
				<p class="truncate text-2xs text-slate-500">Social operations · E-WIN</p>
			</div>
			<ThemeToggle compact />
			<button
				class="ml-auto text-slate-400 hover:text-white lg:hidden"
				onclick={() => (open = false)}
				aria-label="Close navigation">✕</button
			>
		</div>

		<nav class="flex-1 space-y-5 overflow-y-auto px-3 py-4">
			{#each visibleNav as section}
				<div>
					<p class="eyebrow px-3">{section.group}</p>
					{#each section.items as item (item.id)}
						{@const active = page.url.pathname === item.href}
						<a
							href={item.href}
							onclick={() => (open = false)}
							aria-current={active ? 'page' : undefined}
							class={`group mb-0.5 flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] font-medium transition ${
								active
									? 'bg-guru-600/15 text-white ring-1 ring-inset ring-guru-500/30'
									: 'text-slate-400 hover:bg-ink-800 hover:text-slate-100'
							}`}
						>
							<span
								class={`grid h-5 w-5 place-items-center rounded text-[11px] ${
									active ? 'text-guru-300' : 'text-slate-500 group-hover:text-slate-300'
								}`}>{item.icon}</span
							>
							<span class="flex-1 truncate">{item.label}</span>
							{#if item.badge === 'messages' && messagesUnread > 0}
								<span class="chip bg-guru-600 px-1.5 py-0 text-[10px] text-white">{messagesUnread}</span>
							{/if}
							{#if item.badge === 'notifications' && notificationCount > 0}
								<span class="chip bg-ink-700 px-1.5 py-0 text-[10px] text-slate-200">{notificationCount}</span>
							{/if}
						</a>
					{/each}
				</div>
			{/each}
		</nav>

		<div class="space-y-2 border-t border-ink-800 px-4 py-3">
			<button class="btn btn-ghost btn-sm w-full justify-start" onclick={installApp}>
				<span aria-hidden="true">⬇</span> Install app
			</button>
			<a href="/console" class="block text-2xs text-slate-500 transition hover:text-slate-300">
				Ecosystem console →
			</a>
			<p class="text-2xs text-slate-600">
				{backendMode === 'convex' ? 'Convex backend' : 'Local demo provider'} · v1.2.0
			</p>
		</div>
	</aside>

	<div class="flex min-w-0 flex-1 flex-col">
		<header
			class="sticky top-0 z-30 flex items-center gap-2 border-b border-ink-800 bg-ink-950/85 px-4 py-2.5 backdrop-blur-xl lg:px-8"
		>
			<button
				class="btn btn-ghost btn-sm px-2 lg:hidden"
				onclick={() => (open = true)}
				aria-label="Open navigation">☰</button
			>

			<div class="hidden min-w-0 items-center gap-2 lg:flex">
				<span class="text-xs text-slate-500">Workspace</span>
				<span class="text-slate-700" aria-hidden="true">/</span>
				<span class="truncate text-xs font-semibold text-slate-200">{current?.label ?? 'Overview'}</span>
				{#if backendMode === 'convex' && $dataSource === 'demo'}
					<span
						class="chip ml-2 border border-amber-500/30 bg-amber-500/10 text-[10px] text-amber-300"
						title="The live backend is unreachable, so bundled demo data is being shown. Live data resumes automatically.">
						Demo data
					</span>
				{/if}
			</div>

			<div class="flex flex-1 items-center justify-end gap-2">
				<a href="/docs" class="btn btn-ghost btn-sm hidden sm:inline-flex">API docs</a>
				<a href="/dashboard/composer" class="btn btn-primary btn-sm">✦ Compose</a>

				<a
					href="/dashboard/notifications"
					class="btn btn-ghost relative px-2 py-1.5"
					aria-label={`Notifications${notificationCount ? `, ${notificationCount} unread` : ''}`}
				>
					<span aria-hidden="true">◔</span>
					{#if notificationCount > 0}
						<span
							class="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white"
							>{notificationCount > 9 ? '9+' : notificationCount}</span
						>
					{/if}
				</a>

				<div class="ml-1 flex items-center gap-2 border-l border-ink-800 pl-2.5">
					<div
						class="grid h-8 w-8 place-items-center rounded-full bg-ink-700 text-xs font-bold text-slate-100"
						title={user?.email}
					>
						{initials}
					</div>
					<div class="hidden sm:block">
						<p class="max-w-[10rem] truncate text-[13px] font-semibold text-white">{user?.name ?? 'Workspace'}</p>
						<p class="text-2xs capitalize text-slate-500">{user?.role ?? 'member'} · {user?.plan ?? 'free'} plan</p>
					</div>
					<button
						class="btn btn-ghost btn-sm px-2"
						onclick={() => signOut().then(() => goto('/auth'))}
						title="Sign out"
						aria-label="Sign out">⇥</button
					>
				</div>
			</div>
		</header>

		<main class="mx-auto w-full max-w-[90rem] flex-1 px-4 py-6 lg:px-8 lg:py-8">
			{@render children()}
		</main>

		<!-- Mobile primary destinations -->
		<nav
			class="sticky bottom-0 z-20 flex border-t border-ink-800 bg-ink-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
			aria-label="Primary"
		>
			{#each MOBILE_NAV as item}
				<a
					href={item.href}
					class={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-semibold ${
						page.url.pathname === item.href ? 'text-guru-300' : 'text-slate-500'
					}`}
				>
					<span class="text-base" aria-hidden="true">{item.icon}</span>
					{item.label.split(' ')[0]}
				</a>
			{/each}
		</nav>

		<Toaster />
	</div>
</div>
