<script lang="ts">
	import { goto } from '$app/navigation';
	import { storedToken } from '$lib/data';
	import { onMount } from 'svelte';
	import ImageSlider from '$lib/components/media/ImageSlider.svelte';
	import StorySequence from '$lib/components/storytelling/StorySequence.svelte';
	import NavigationBanner from '$lib/components/banners/NavigationBanner.svelte';
	import { NAVIGATION_BANNERS } from '$lib/config/navigation-banners';

	const PLATFORMS = [
		{ name: 'Facebook', color: '#1877f2', glyph: 'f' }, { name: 'Instagram', color: '#d6336c', glyph: '◎' },
		{ name: 'X', color: '#111827', glyph: '𝕏' }, { name: 'LinkedIn', color: '#0a66c2', glyph: 'in' },
		{ name: 'TikTok', color: '#fe2c55', glyph: '♪' }, { name: 'YouTube', color: '#ff0000', glyph: '▶' },
		{ name: 'Threads', color: '#a855f7', glyph: '@' }, { name: 'Bluesky', color: '#4169e1', glyph: '🦋' },
		{ name: 'Pinterest', color: '#e60023', glyph: 'P' }, { name: 'Telegram', color: '#0088cc', glyph: '✈' },
		{ name: 'WhatsApp', color: '#25d366', glyph: '✆' }, { name: 'Google Business', color: '#f4b400', glyph: 'G' },
		{ name: 'Zalo', color: '#0e84f5', glyph: 'Z' }, { name: 'Slack', color: '#611f69', glyph: '#' },
		{ name: 'Discord', color: '#5865f2', glyph: '◆' }
	];

	const PILLARS = [
		{ icon: '✦', title: 'AI Composer', text: 'Point it at a URL, article, PDF or a one-line idea and get platform-tuned drafts — hook formulas, per-network rewrites, first comments and hashtags, ready to schedule.', tag: 'Blotato × Buffer' },
		{ icon: '⌨', title: 'One API + MCP server', text: 'Publish, schedule, engage and read analytics over REST or MCP. API keys with scopes, sandbox mode, webhooks and request logs — docs included.', tag: 'Ayrshare × PostMCP' },
		{ icon: '▦', title: 'Calendar & queue', text: 'Recurring timeslots per platform, next-free-slot scheduling, approval workflows and per-platform delivery results on every post.', tag: 'Buffer × PostProxy' },
		{ icon: '✉', title: 'Unified inbox', text: 'Comments, DMs, mentions and Google reviews in one cockpit with sentiment tagging, AI-suggested replies and one-click CRM handoff.', tag: 'Sprout × SocialAPI' },
		{ icon: '⚙', title: 'Agents & automations', text: 'Keyword-triggered DM and comment auto-replies within platform windows, content pipelines and best-time requeue rules that run while you sleep.', tag: 'ManyChat × GoHighLevel' },
		{ icon: '⟐', title: 'Reverse Studio', text: 'Powered by reverse-api-engineer: capture any website\'s network traffic and generate a typed API client — then wire discovered credentials into your connectors.', tag: 'kalil0321' }
	];

	let hasSession = $state(false);
	onMount(() => { hasSession = !!storedToken(); });
</script>

<div class="min-h-screen">
	<nav class="sticky top-0 z-40 border-b border-ink-700/60 bg-ink-900/80 backdrop-blur">
		<div class="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5">
			<div class="flex items-center gap-2.5">
				<div class="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-guru-500 to-mint-500 text-lg font-black text-white">G</div>
				<span class="text-lg font-black tracking-tight text-white">GuruSocial</span>
			</div>
			<div class="flex items-center gap-2">
				<a href="/pricing" class="btn btn-ghost btn-sm hidden sm:inline-flex">Pricing</a>
				<a href="/docs" class="btn btn-ghost btn-sm hidden sm:inline-flex">API & MCP docs</a>
				<a href="/auth" class="btn btn-ghost btn-sm">{hasSession ? 'Open dashboard' : 'Sign in'}</a>
				<a href="/dashboard" class="btn btn-primary">{hasSession ? 'Dashboard' : 'Start free'}</a>
			</div>
		</div>
	</nav>

	<!-- Hero -->
	<section class="relative mx-auto max-w-6xl px-4 pb-16 pt-16 sm:pt-24">
		<div class="pointer-events-none absolute -top-24 left-1/2 h-72 w-[42rem] -translate-x-1/2 rounded-full bg-guru-600/20 blur-3xl"></div>
		<div class="relative">
			<span class="chip bg-guru-600/15 text-guru-400 ring-1 ring-guru-500/30">Enterprise-grade · installable PWA · 15 platforms</span>
			<h1 class="mt-5 max-w-3xl font-display text-display-lg font-semibold leading-[1.04] tracking-[-0.03em] text-white">
				One command center for your entire<br class="hidden sm:block" />
				<span class="bg-gradient-to-r from-guru-400 via-guru-500 to-mint-400 bg-clip-text text-transparent"> social operation.</span>
			</h1>
			<p class="mt-5 max-w-2xl text-base leading-relaxed text-slate-400 sm:text-lg">
				GuruSocial harmonizes the best of the social stack — Ayrshare's unified publishing API, Buffer's queue, Sprout's analytics and inbox, ManyChat's automations, GoHighLevel's CRM and Blotato's AI content engine — into a single app, API and MCP server. Publish once, measure everything, automate the rest.
			</p>
			<div class="mt-8 flex flex-wrap gap-3">
				<a href="/dashboard" class="btn btn-primary px-6 py-3 text-base">Start free — no card needed</a>
				<a href="/docs" class="btn btn-ghost px-6 py-3 text-base">Read the API docs →</a>
			</div>
			<div class="mt-10 flex flex-wrap items-center gap-2">
				{#each PLATFORMS as p}
					<span class="inline-flex items-center gap-1.5 rounded-full border border-ink-700 bg-ink-850 px-3 py-1.5 text-xs font-semibold text-slate-300">
						<span class="grid h-4.5 w-4.5 place-items-center rounded-full text-[8px] font-black text-white" style={`background:${p.color}`}>{p.glyph}</span>
						{p.name}
					</span>
				{/each}
			</div>
		</div>
	</section>

	<!-- Promotional slider (proof of work, beneath the hero) -->
	<section class="mx-auto max-w-6xl px-4 pt-2 sm:pt-4">
		<ImageSlider />
	</section>

	<!-- Pillars -->
	<section class="mx-auto max-w-6xl px-4 pb-16">
		<h2 class="font-display text-display-sm font-semibold tracking-tight text-white">Everything the best tools have. One place.</h2>
		<p class="mt-3 max-w-2xl text-sm leading-relaxed text-slate-400">We audited eleven platforms and two API engines so you don't have to tab-juggle again.</p>
		<div class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each PILLARS as pillar}
				<div class="card p-5">
					<div class="flex items-center justify-between">
						<span class="grid h-10 w-10 place-items-center rounded-xl bg-guru-600/20 text-lg text-guru-400">{pillar.icon}</span>
						<span class="text-[10px] font-bold uppercase tracking-widest text-slate-600">{pillar.tag}</span>
					</div>
					<h3 class="mt-3 text-base font-bold text-white">{pillar.title}</h3>
					<p class="mt-1.5 text-sm leading-relaxed text-slate-400">{pillar.text}</p>
				</div>
			{/each}
		</div>
	</section>

	<StorySequence />

	<!-- Navigation banners -->
	<section class="mx-auto max-w-6xl px-4 pb-16">
		<div class="grid gap-4 md:grid-cols-3">
			{#each NAVIGATION_BANNERS as banner (banner.id)}
				<NavigationBanner
					id={banner.id}
					inscription={banner.inscription}
					description={banner.description}
					href={banner.href}
					theme={banner.theme}
				/>
			{/each}
		</div>
	</section>

	<!-- How it works -->
	<section class="mx-auto max-w-6xl px-4 pb-16">
		<div class="card overflow-hidden">
			<div class="grid md:grid-cols-2">
				<div class="p-8">
					<h2 class="text-2xl font-bold text-white">Give other apps your API keys — we'll deliver the posts</h2>
					<p class="mt-3 text-sm leading-relaxed text-slate-400">
						Create live or sandbox keys in the Developer portal, hand them to any external app — your content generator, your n8n flows, your Claude or GPT agent — and that app posts to every linked platform and reads analytics through GuruSocial. Your content engine stays where it is; delivery, scheduling, engagement and measurement come to us.
					</p>
					<ol class="mt-6 space-y-4 text-sm">
						<li class="flex gap-3"><span class="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-guru-600 text-xs font-black text-white">1</span><div><p class="font-semibold text-white">Connect your platforms</p><p class="text-slate-500">Hosted OAuth (we own the per-network quirks) or bring your own platform credentials.</p></div></li>
						<li class="flex gap-3"><span class="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-guru-600 text-xs font-black text-white">2</span><div><p class="font-semibold text-white">Create API keys with scopes</p><p class="text-slate-500">posts:write, analytics:read, inbox:read, crm:write, mcp:use. Sandbox mode for safe testing.</p></div></li>
						<li class="flex gap-3"><span class="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-guru-600 text-xs font-black text-white">3</span><div><p class="font-semibold text-white">Post from anywhere</p><p class="text-slate-500">One POST /api/v1/posts call or one MCP create_post tool call publishes everywhere.</p></div></li>
					</ol>
				</div>
				<div class="border-t border-ink-700 bg-ink-900/50 p-8 md:border-l md:border-t-0">
					<p class="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">POST /api/v1/posts</p>
					<pre class="overflow-x-auto rounded-xl bg-ink-950 p-4 text-xs leading-relaxed text-slate-300"><code>{`curl -X POST https://your-gurusocial.convex.site/api/v1/posts \\
  -H "Authorization: Bearer gs_live_xxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "content": "Ship day 🚀",
    "platforms": ["x", "linkedin", "instagram"],
    "mediaUrls": ["https://cdn.example/hero.png"],
    "firstComment": "Links in the reply 👇"
  }'`}</code></pre>
					<p class="mt-4 text-xs text-slate-500">Same call works from n8n, Make, Zapier, Python, TypeScript, Go or any MCP client. Per-platform delivery results come back in the response and the dashboard.</p>
				</div>
			</div>
		</div>
	</section>

	<!-- Install / deploy -->
	<section class="mx-auto max-w-6xl px-4 pb-20">
		<div class="grid gap-4 sm:grid-cols-3">
			<div class="card p-6">
				<h3 class="text-base font-bold text-white">💻 Install on laptop</h3>
				<p class="mt-2 text-sm text-slate-400">Runs on Windows and macOS. <code class="text-guru-400">npm install && npm run dev</code> — or deploy Convex and host anywhere.</p>
			</div>
			<div class="card p-6">
				<h3 class="text-base font-bold text-white">☁️ Deploy to Cloudflare Pages</h3>
				<p class="mt-2 text-sm text-slate-400">Static SvelteKit build + Convex backend. <code class="text-guru-400">npm run build</code>, point Pages at <code class="text-guru-400">build/</code>.</p>
			</div>
			<div class="card p-6">
				<h3 class="text-base font-bold text-white">📱 PWA on mobile</h3>
				<p class="mt-2 text-sm text-slate-400">Installable, offline-capable, fully responsive. Add to home screen on iOS and Android.</p>
			</div>
		</div>
	</section>

	<footer class="border-t border-ink-700/60 py-8 text-center text-xs text-slate-600">
		<p>GuruSocial v1.2.0 — built with SvelteKit, Convex, Tailwind CSS and reverse-api-engineer. © 2026</p>
		<p class="mt-2 flex justify-center gap-4">
			<a href="/pricing" class="hover:text-slate-400">Pricing</a>
			<a href="/docs" class="hover:text-slate-400">API docs</a>
			<a href="/console" class="hover:text-slate-400">Admin console</a>
			<a href="https://beaming-bobcat-890.eu-west-1.convex.site/mcp" class="hover:text-slate-400">MCP endpoint</a>
		</p>
	</footer>
</div>
