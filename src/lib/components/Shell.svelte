<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { session, signOut, backendMode, storedToken } from '$lib/data';
	import { can } from '$lib/auth/rbac';
	import { NAVIGATION, MOBILE_NAV } from '$lib/config/navigation';
	import Toaster from './Toaster.svelte';
	import { toast } from '$lib/stores/toast';
	import { onMount } from 'svelte';

	let { children }: { children?: any } = $props();
	let open = $state(false);
	let bellOpen = $state(false);
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
		if (!storedToken()) return;
		try {
			const [m, n] = await Promise.all([
				$session.token ? import('$lib/data').then((m) => m.data.messaging.unreadCount($session.token!)) : 0,
				$session.token ? import('$lib/data').then((m) => m.data.notifications.unreadCount($session.token!)) : 0
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
		toast('On iPhone/iPad: Share → Add to Home Screen. On desktop Chrome/Edge: install icon in the address bar.', 'info');
	}

	function toggleBell() {
		bellOpen = !bellOpen;
	}

	async function openNotifications() {
		if (!token) return;
		try {
			await import('$lib/data').then((m) => m.data.notifications.markAllRead(token));
			notificationCount = 0;
		} catch {
			/* ignore */
		}
		bellOpen = false;
		goto('/dashboard/messages');
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
		class={`fixed inset-y-0 left-0 z-50 flex w-72 transform flex-col border-r border-ink-700 bg-ink-900 transition-transform duration-200 lg:static lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}
		aria-label="Workspace navigation"
	>
		<div class="flex items-center gap-3 px-5 py-5">
			<div class="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-guru-500 to-mint-500 text-lg font-black text-white shadow-lg shadow-guru-600/30">G</div>
			<div class="min-w-0">
				<p class="truncate text-base font-black tracking-tight text-white">GuruSocial</p>
				<p class="text-2xs font-semibold uppercase tracking-widest text-slate-500">Command center</p>
			</div>
			<button class="ml-auto text-slate-400 lg:hidden" onclick={() => (open = false)} aria-label="Close navigation">✕</button>
		</div>

		<nav class="flex-1 space-y-4 overflow-y-auto px-3 pb-4">
			{#each visibleNav as section}
				<div>
					<p class="mb-1 px-3 text-2xs font-bold uppercase tracking-widest text-slate-500">{section.group}</p>
					{#each section.items as item (item.id)}
						<a
							href={item.href}
							onclick={() => (open = false)}
							aria-current={page.url.pathname === item.href ? 'page' : undefined}
							class={`mb-0.5 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${page.url.pathname === item.href ? 'bg-guru-600/20 text-white ring-1 ring-guru-500/40' : 'text-slate-400 hover:bg-ink-800 hover:text-slate-100'}`}
						>
							<span class={`grid h-6 w-6 place-items-center rounded-lg text-xs ${page.url.pathname === item.href ? 'bg-guru-600 text-white' : 'bg-ink-800 text-slate-400'}`}>{item.icon}</span>
							<span class="flex-1">{item.label}</span>
							{#if item.badge === 'messages' && messagesUnread > 0}
								<span class="chip bg-guru-600 text-[10px] text-white">{messagesUnread}</span>
							{/if}
						</a>
					{/each}
				</div>
			{/each}
		</nav>

		<div class="space-y-2 border-t border-ink-700 px-4 py-3">
			<button class="btn btn-ghost w-full justify-start text-xs" onclick={installApp}>
				<span aria-hidden="true">⬇</span> Get the app
			</button>
			<a href="/console" class="block text-2xs text-slate-500 hover:text-slate-300">Ecosystem console →</a>
			<p class="text-2xs text-slate-600">Backend: {backendMode === 'convex' ? 'Convex (live)' : 'local demo'} · v1.1.0</p>
		</div>
	</aside>

	<div class="flex min-w-0 flex-1 flex-col">
		<header class="sticky top-0 z-30 flex items-center gap-2 border-b border-ink-700 bg-ink-950/85 px-4 py-3 backdrop-blur-xl lg:px-8">
			<button class="btn btn-ghost px-2.5 py-1.5 lg:hidden" onclick={() => (open = true)} aria-label="Open navigation">☰</button>
			<div class="hidden flex-1 lg:block"></div>
			<a href="/docs" class="btn btn-ghost hidden sm:inline-flex">API docs</a>
			<a href="/dashboard/composer" class="btn btn-primary">✦ Compose</a>

			<div class="relative">
				<button
					class="btn btn-ghost relative px-2.5 py-1.5"
					onclick={toggleBell}
					aria-label="Notifications"
					aria-expanded={bellOpen}
				>
					<span aria-hidden="true">🔔</span>
					{#if notificationCount > 0}
						<span class="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">{notificationCount > 9 ? '9+' : notificationCount}</span>
					{/if}
				</button>
				{#if bellOpen}
					<div class="absolute right-0 mt-2 w-72 rounded-2xl border border-ink-700 bg-ink-850 p-3 shadow-2xl" role="dialog" aria-label="Notifications">
						<div class="mb-2 flex items-center justify-between">
							<p class="text-xs font-bold uppercase tracking-wide text-slate-400">Notifications</p>
							<button class="text-2xs text-guru-300 hover:underline" onclick={openNotifications}>Mark all read</button>
						</div>
						<p class="text-xs leading-relaxed text-slate-400">
							{notificationCount > 0 ? `${notificationCount} unread update${notificationCount === 1 ? '' : 's'}.` : 'You are all caught up.'}
						</p>
						<a href="/dashboard/messages" class="mt-3 block text-xs font-semibold text-guru-300 hover:underline" onclick={() => (bellOpen = false)}>Open messages →</a>
					</div>
				{/if}
			</div>

			<div class="flex items-center gap-2.5">
				<div class="grid h-9 w-9 place-items-center rounded-full bg-guru-600 text-sm font-bold text-white" title={user?.email}>
					{user?.name?.slice(0, 1)?.toUpperCase() ?? 'U'}
				</div>
				<div class="hidden sm:block">
					<p class="text-sm font-semibold text-white">{user?.name ?? 'Workspace'}</p>
					<p class="text-2xs uppercase tracking-wide text-slate-500">{user?.role ?? 'member'} · {user?.plan ?? 'free'}</p>
				</div>
				<button class="btn btn-ghost px-2.5 py-1.5" onclick={() => signOut().then(() => goto('/auth'))} title="Sign out" aria-label="Sign out">⇥</button>
			</div>
		</header>

		<main class="mx-auto w-full max-w-7xl flex-1 px-4 py-6 lg:px-8">
			{@render children()}
		</main>

		<!-- Mobile primary destinations -->
		<nav class="sticky bottom-0 z-20 flex border-t border-ink-700 bg-ink-950/95 backdrop-blur lg:hidden" aria-label="Primary">
			{#each MOBILE_NAV as item}
				<a
					href={item.href}
					class={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-2xs font-semibold ${page.url.pathname === item.href ? 'text-guru-300' : 'text-slate-500'}`}
				>
					<span class="text-base" aria-hidden="true">{item.icon}</span>
					{item.label.split(' ')[0]}
				</a>
			{/each}
		</nav>

		<Toaster />
	</div>
</div>
