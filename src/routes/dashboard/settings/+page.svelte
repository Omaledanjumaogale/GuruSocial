<script lang="ts">
	import { data, session, backendMode } from '$lib/data';
	import { toast } from '$lib/stores/toast';
	import { onMount } from 'svelte';

	let name = $state('');
	let brandVoice = $state('');
	let currentPassword = $state('');
	let newPassword = $state('');
	let llmApiKey = $state('');
	let llmProvider = $state('');
	let saving = $state(false);
	let ewinCode = $state<string | null>(null);
	let ewinExpiry = $state<number | null>(null);
	let issuingCode = $state(false);
	let prefs = $state({ inApp: true, email: false, product: true, security: true });
	let savingPrefs = $state(false);

	async function loadPrefs() {
		if (!$session.token) return;
		try {
			prefs = await data.notifications.preferences($session.token);
		} catch {
			/* defaults are fine */
		}
	}

	async function savePrefs() {
		if (!$session.token) return;
		savingPrefs = true;
		try {
			await data.notifications.savePreferences($session.token, prefs);
			toast('Notification preferences saved.');
		} catch (e: any) {
			toast(e.message, 'error');
		} finally {
			savingPrefs = false;
		}
	}

	onMount(() => {
		void loadPrefs();
		const u = $session.user;
		if (u) {
			name = u.name;
			brandVoice = u.brandVoice ?? '';
			const s = (u as any).settings ?? {};
			llmProvider = s.llmProvider ?? '';
			llmApiKey = s.llmApiKey ?? '';
		}
	});

	async function saveProfile() {
		saving = true;
		try {
			await data.auth.updateProfile($session.token!, {
				name,
				brandVoice,
				llmProvider,
				llmApiKey
			} as any);
			toast('Profile saved.');
		} catch (e: any) {
			toast(e.message, 'error');
		} finally {
			saving = false;
		}
	}

	async function issueEwinCode() {
		issuingCode = true;
		try {
			const res = await data.ewin.issueCode($session.token!);
			ewinCode = res.code;
			ewinExpiry = res.expiresAt;
			toast('Connection code generated — use it in E-WIN → Settings → Connections.');
		} catch (e: any) {
			toast(e.message, 'error');
		} finally {
			issuingCode = false;
		}
	}

	async function savePassword() {
		try {
			await data.auth.changePassword($session.token!, currentPassword, newPassword);
			currentPassword = '';
			newPassword = '';
			toast('Password updated.');
		} catch (e: any) {
			toast(e.message, 'error');
		}
	}
</script>

<div class="grid gap-4 lg:grid-cols-2">
	<div>
		<h1 class="text-2xl font-black tracking-tight text-white">Settings</h1>
		<p class="mt-1 mb-4 text-sm text-slate-400">Workspace identity, AI provider and security — in plain language.</p>

		<div class="card mb-4 p-5">
			<h3 class="mb-4 text-sm font-bold text-white">Profile & brand voice</h3>
			<div class="space-y-4">
				<div><label class="label" for="pn">Display name</label><input class="input" id="pn" bind:value={name} /></div>
				<div>
					<label class="label" for="bv">Brand voice</label>
					<input class="input" id="bv" bind:value={brandVoice} placeholder="confident, plain-spoken, helpful" />
					<p class="mt-1 text-xs text-slate-600">Used by the AI Composer to keep every draft on-brand.</p>
				</div>
				<button class="btn btn-primary" onclick={saveProfile} disabled={saving}>{saving ? 'Saving…' : 'Save profile'}</button>
			</div>
		</div>

		<div class="card mb-4 p-5">
			<h3 class="mb-2 text-sm font-bold text-white">Notifications</h3>
			<p class="mb-3 text-xs leading-relaxed text-slate-400">In-app notifications cover account, security and product events. Email is opt-in and only sent when the mail provider is configured — nothing is sent from a broadcast without your consent.</p>
			<div class="space-y-2">
				{#each [
					['inApp', 'In-app notifications', 'Bell and Messages updates inside GuruSocial'],
					['email', 'Email notifications', 'Requires Resend to be configured; opt-in'],
					['product', 'Product updates', 'New capabilities and workspace tips'],
					['security', 'Security alerts', 'Sign-ins, password and role changes']
				] as [key, label, hint]}
					<label class="flex items-start justify-between gap-3 rounded-xl bg-ink-900 px-3 py-2.5">
						<span>
							<span class="block text-sm font-semibold text-slate-200">{label}</span>
							<span class="block text-2xs text-slate-500">{hint}</span>
						</span>
						<input type="checkbox" class="mt-1 h-5 w-5 accent-indigo-500" bind:checked={prefs[key as 'inApp']} />
					</label>
				{/each}
			</div>
			<button class="btn btn-primary mt-3" onclick={savePrefs} disabled={savingPrefs}>{savingPrefs ? 'Saving…' : 'Save preferences'}</button>
		</div>

		<div class="card p-5">
			<h3 class="mb-2 text-sm font-bold text-white">Model-backed generation (optional)</h3>
			<p class="mb-3 text-xs leading-relaxed text-slate-400">The built-in composer works offline with deterministic copywriting heuristics. If you want model-backed drafts, connect your own LLM provider key here — it stays in your workspace and is never shown again.</p>
			<div class="grid gap-3 sm:grid-cols-2">
				<div>
					<span class="label">Provider</span>
					<select class="input" bind:value={llmProvider}>
						<option value="">Built-in engine (no key needed)</option>
						<option value="agnes">Agnes AI (server-side — key already configured)</option>
						<option value="openai">OpenAI (your own key)</option>
					</select>
				</div>
				<div><label class="label" for="llm">API key</label><input class="input" id="llm" type="password" bind:value={llmApiKey} placeholder={llmProvider === 'agnes' ? 'Held server-side on Convex — nothing to enter' : 'sk-…'} disabled={llmProvider !== 'openai'} /></div>
			</div>
			<button class="btn btn-ghost mt-3" onclick={saveProfile} disabled={saving}>Save provider</button>
		</div>
	</div>

	<div>
		<div class="card mb-4 p-5">
			<h3 class="mb-4 text-sm font-bold text-white">Change password</h3>
			<div class="space-y-4">
				<div><label class="label" for="cp">Current password</label><input class="input" id="cp" type="password" bind:value={currentPassword} /></div>
				<div><label class="label" for="np">New password</label><input class="input" id="np" type="password" bind:value={newPassword} placeholder="At least 8 characters" /></div>
				<button class="btn btn-primary" onclick={savePassword}>Update password</button>
			</div>
		</div>

		<div class="card mb-4 p-5">
			<h3 class="mb-2 text-sm font-bold text-white">E-WIN hub connection</h3>
			<p class="mb-3 text-xs leading-relaxed text-slate-400">Bind this workspace to the E-WIN central ecosystem. Generate a one-time code (valid 10 minutes) and paste it into E-WIN → Settings → Connections. E-WIN pulls a signed reporting snapshot — it never touches your wallet, credentials or message bodies.</p>
			{#if ewinCode}
				<div class="rounded-xl border border-mint-500/40 bg-mint-500/10 p-3">
					<p class="break-all font-mono text-sm text-mint-300">{ewinCode}</p>
					<p class="mt-1 text-[10px] text-slate-400">Shown once · expires {new Date(ewinExpiry!).toLocaleTimeString()}</p>
				</div>
			{/if}
			<button class="btn btn-ghost mt-3" onclick={issueEwinCode} disabled={issuingCode || backendMode !== 'convex'}>
				{issuingCode ? 'Generating…' : 'Generate connection code'}
			</button>
			{#if backendMode !== 'convex'}<p class="mt-2 text-[10px] text-amber-300">Requires the live backend.</p>{/if}
		</div>

		<div class="card p-5">
			<h3 class="mb-3 text-sm font-bold text-white">Workspace & backend</h3>
			<div class="space-y-2 text-sm">
				<div class="flex justify-between rounded-xl bg-ink-900 px-3 py-2"><span class="text-slate-400">Email</span><span class="text-white">{$session.user?.email}</span></div>
				<div class="flex justify-between rounded-xl bg-ink-900 px-3 py-2"><span class="text-slate-400">Plan</span><span class="font-bold text-guru-400 uppercase">{$session.user?.plan}</span></div>
				<div class="flex justify-between rounded-xl bg-ink-900 px-3 py-2"><span class="text-slate-400">Data backend</span><span class="text-white">{backendMode === 'convex' ? 'Convex (live)' : 'Local demo (browser)'}</span></div>
				<div class="flex justify-between rounded-xl bg-ink-900 px-3 py-2"><span class="text-slate-400">Version</span><span class="font-mono text-white">1.0.0</span></div>
			</div>
			{#if backendMode === 'local'}
				<p class="mt-3 rounded-xl border border-guru-500/30 bg-guru-600/10 p-3 text-xs leading-relaxed text-guru-300">
					This workspace is running on the in-browser demo provider. Set <code>VITE_CONVEX_URL</code> and run <code>npx convex deploy</code> to switch to the live Convex backend — schema and API are identical.
				</p>
			{/if}
		</div>
	</div>
</div>
