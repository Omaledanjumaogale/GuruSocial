<script lang="ts">
	import Logo from '$lib/components/Logo.svelte';
	const ENDPOINTS = [
		{ method: 'POST', path: '/api/v1/posts', desc: 'Publish now, schedule or save a draft. Body: content, platforms[], scheduledAt (ISO), mediaUrls[], firstComment, draft. Sandbox keys return a validation payload instead of publishing.' },
		{ method: 'GET', path: '/api/v1/posts?status=&limit=', desc: 'List posts. Filter by status: draft, pending_approval, scheduled, published, failed.' },
		{ method: 'GET', path: '/api/v1/profiles', desc: 'List connected social profiles with platform, handle and status.' },
		{ method: 'GET', path: '/api/v1/analytics/top?metric=impressions&limit=10', desc: 'Rank published posts by impressions, reach, likes, comments or shares.' },
		{ method: 'POST', path: '/api/v1/inbox/reply', desc: 'Reply to an inbox item. Body: inboxItemId, message.' },
		{ method: 'POST', path: '/mcp', desc: 'MCP JSON-RPC endpoint — initialize, tools/list, tools/call.' }
	];

	const TOOLS = [
		['list_profiles', 'Connected social profiles.'],
		['preflight_post', 'Dry-run: platform limits, media ceilings, content warnings.'],
		['create_post', 'Publish or schedule to any connected platforms in one call.'],
		['list_posts', 'Recent posts with status filters.'],
		['get_post_analytics', 'Per-platform analytics for one post.']
	];

	const PLATFORM_SLUGS = 'facebook · instagram · x · linkedin · tiktok · youtube · threads · bluesky · pinterest · telegram · whatsapp · google-business · zalo · slack · discord';
</script>

<div class="mx-auto max-w-4xl px-4 py-10">
	<nav class="mb-8 flex items-center justify-between">
		<a href="/" class="flex items-center gap-2.5">
			<Logo size={36} wordClass="text-base" />
		</a>
		<a href="/dashboard" class="btn btn-ghost">Open dashboard</a>
	</nav>

	<h1 class="text-3xl font-black text-white">Developer API & MCP</h1>
	<p class="mt-2 text-slate-400">One contract for publishing, scheduling, engagement and analytics across 15 platforms. Bearer-token auth, scoped keys, sandbox mode, per-platform delivery results.</p>

	<section class="card mt-8 p-5">
		<h2 class="text-base font-bold text-white">Authentication</h2>
		<p class="mt-2 text-sm text-slate-400">Send your key in the Authorization header. Keys are created in <a class="text-guru-400 underline" href="/dashboard/developer">Developer & API</a>; the full key is shown once at creation.</p>
		<pre class="mt-3 overflow-x-auto rounded-xl bg-ink-950 p-4 text-xs text-slate-300"><code>Authorization: Bearer gs_live_xxxxxxxxxxxx   # live — publishes
Authorization: Bearer gs_sandbox_xxxxxxxxxxxx # sandbox — dry-run only</code></pre>
	</section>

	<section class="card mt-4 p-5">
		<h2 class="text-base font-bold text-white">REST endpoints</h2>
		<div class="mt-3 space-y-3">
			{#each ENDPOINTS as e}
				<div class="rounded-xl border border-ink-600 p-4">
					<p class="flex items-center gap-2 font-mono text-sm">
						<span class={`chip font-bold ${e.method === 'GET' ? 'bg-sky-500/15 text-sky-300' : 'bg-mint-500/15 text-mint-400'}`}>{e.method}</span>
						<span class="text-slate-200">{e.path}</span>
					</p>
					<p class="mt-1.5 text-xs leading-relaxed text-slate-400">{e.desc}</p>
				</div>
			{/each}
		</div>
	</section>

	<section class="card mt-4 p-5">
		<h2 class="text-base font-bold text-white">Create a post</h2>
		<pre class="mt-3 overflow-x-auto rounded-xl bg-ink-950 p-4 text-xs leading-relaxed text-slate-300"><code>{`POST /api/v1/posts
{
  "content": "Ship day 🚀",
  "platforms": ["x", "linkedin", "instagram"],
  "scheduledAt": "2026-12-01T09:30:00Z",   // omit to publish now
  "mediaUrls": ["https://cdn.example.com/hero.png"],
  "firstComment": "Links in the reply 👇"
}`}</code></pre>
		<p class="mt-2 text-xs text-slate-500">Responses include per-platform delivery results: <code>{`{"postId":"…","status":"published"}`}</code>. Failed deliveries are listed with the platform and message.</p>
	</section>

	<section class="card mt-4 p-5">
		<h2 class="text-base font-bold text-white">MCP tools</h2>
		<p class="mt-2 text-sm text-slate-400">Connect Claude, ChatGPT, Cursor or Claude Code over streamable HTTP. Auth is the same Bearer key; the MCP server never sees model prompts and mutating tools go through the client's approval prompt.</p>
		<div class="mt-3 space-y-2">
			{#each TOOLS as [name, desc]}
				<div class="flex gap-3 rounded-xl bg-ink-900 p-3 text-sm">
					<code class="font-mono font-bold text-guru-400">{name}</code>
					<span class="text-slate-400">{desc}</span>
				</div>
			{/each}
		</div>
	</section>

	<section class="card mt-4 p-5">
		<h2 class="text-base font-bold text-white">Platform slugs</h2>
		<p class="mt-2 font-mono text-xs leading-relaxed text-slate-300">{PLATFORM_SLUGS}</p>
		<p class="mt-2 text-xs text-slate-500">Per-network character limits and hashtag norms are enforced client-side by the composer and server-side by <code>preflight_post</code>.</p>
	</section>

	<section class="card mt-4 p-5">
		<h2 class="text-base font-bold text-white">Webhooks</h2>
		<p class="mt-2 text-sm text-slate-400">Subscribe in the Developer portal: <code>post.published</code>, <code>post.failed</code>, <code>inbox.received</code>, <code>automation.ran</code>. Deliveries are logged with status and duration in the request log.</p>
	</section>

	<section class="card mt-4 p-5">
		<h2 class="text-base font-bold text-white">Rate limits & retries</h2>
		<p class="mt-2 text-sm text-slate-400">Scheduled posts retry per-platform with attempts tracked on the delivery record. Sandbox mode exists on all plans: develop against the same contract without touching real accounts.</p>
	</section>

	<footer class="py-10 text-center text-xs text-slate-600">GuruSocial Developer Docs · v1.0.0 · SvelteKit + Convex + Cloudflare Pages</footer>
</div>
