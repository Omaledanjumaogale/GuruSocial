/**
 * Data layer selector + session store.
 *
 * Live mode: when VITE_CONVEX_URL is set, reads/writes go to the deployed Convex
 * backend. Reads may fall back to the bundled demo dataset during a network
 * outage so the interface keeps rendering; writes never fall back (a silently
 * dropped write is worse than an error), and authentication never falls back at
 * all. Storage is wrapped (src/lib/util/storage.ts) so blocked localStorage can
 * never break sign-in.
 */
import { writable, get } from 'svelte/store';
import type { DataProvider, User } from '../types';
import { localProvider, ensureDemoSession } from './local';
import { createConvexProvider } from './convex';
import { storage } from '../util/storage';

const CONVEX_URL = import.meta.env.VITE_CONVEX_URL as string | undefined;
export const CONVEX_HTTP_URL =
	(import.meta.env.VITE_CONVEX_HTTP_URL as string | undefined) ??
	(CONVEX_URL ? CONVEX_URL.replace('.cloud', '.site') : undefined);
export const PUBLIC_APP_URL =
	(import.meta.env.VITE_PUBLIC_APP_URL as string | undefined) ??
	(typeof location !== 'undefined' ? location.origin : 'https://gurusocial.ewinproject.org');
export const backendMode: 'convex' | 'local' = CONVEX_URL ? 'convex' : 'local';

/**
 * Which data is actually on screen. The shell reads this to label demo
 * fallbacks honestly: mock data is shown, and live data replaces it as soon as
 * the backend answers again.
 */
export const dataSource = writable<'live' | 'demo'>(CONVEX_URL ? 'live' : 'demo');

/** Only network-shaped failures trigger the demo read fallback. */
function isNetworkError(e: unknown): boolean {
	const msg = String((e as any)?.message ?? e);
	if (
		/unauthor|invalid|expired|already exists|incorrect|must be|required|not found|forbidden|permission|not available/i.test(
			msg
		)
	) {
		return false;
	}
	return /failed to fetch|networkerror|network error|typeerror|fetch failed|timed out|timeout|econn|dns|load failed|offline|unreachable/i.test(
		msg
	);
}

/**
 * Short-lived read cache for the live provider.
 *
 * Convex bills egress and database I/O per query. Navigating between dashboard
 * pages re-requests the same overview/profiles/posts repeatedly, so identical
 * reads within the TTL are served from memory instead of the backend. Any
 * mutation clears the cache, so writes are never stale.
 */
const CACHE_TTL_MS = 15_000;
const READ_METHODS: Record<string, string[]> = {
	profiles: ['list'],
	posts: ['list', 'queueSlots', 'nextFreeSlot'],
	analytics: ['overview', 'topPosts', 'audience', 'competitors'],
	inbox: ['list'],
	automations: ['list', 'agentRuns'],
	crm: ['contacts', 'campaigns', 'brandKits', 'visualTemplates'],
	keys: ['listKeys', 'webhooks', 'logs', 'auditTrail'],
	harvest: ['list'],
	messaging: ['conversations', 'messages', 'unreadCount'],
	notifications: ['list', 'preferences'],
	ewin: ['status']
};

/** Reads that may degrade to demo data during an outage. */
const FALLBACK_READS = new Set(
	Object.entries(READ_METHODS).flatMap(([section, methods]) => methods.map((m) => `${section}.${m}`))
);
FALLBACK_READS.add('auth.me');

function withReadCache(provider: DataProvider): DataProvider {
	const cache = new Map<string, { at: number; value: unknown }>();
	const out: Record<string, any> = {};
	for (const [section, methods] of Object.entries(provider as any)) {
		out[section] = { ...(methods as Record<string, unknown>) };
		for (const [name, fn] of Object.entries(methods as Record<string, Function>)) {
			const cacheable = READ_METHODS[section]?.includes(name);
			out[section][name] = async (...args: any[]) => {
				const key = `${section}.${name}:${JSON.stringify(args)}`;
				if (cacheable) {
					const hit = cache.get(key);
					if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;
				}
				const value = await fn(...args);
				if (cacheable) cache.set(key, { at: Date.now(), value });
				else cache.clear();
				return value;
			};
		}
	}
	return out as DataProvider;
}

function withFallback(convex: DataProvider, local: DataProvider): DataProvider {
	const wrapSection = <S extends keyof DataProvider>(section: S): DataProvider[S] => {
		const out: Record<string, unknown> = {};
		for (const [method, fn] of Object.entries(convex[section])) {
			const key = `${String(section)}.${method}`;
			const mayUseDemo = FALLBACK_READS.has(key);
			out[method] = async (...args: any[]) => {
				try {
					const value = await (fn as any)(...args);
					if (mayUseDemo) dataSource.set('live');
					return value;
				} catch (e) {
					if (!isNetworkError(e)) throw e;
					if (!mayUseDemo) {
						throw new Error(
							'We could not reach the server, so this change was not saved. Try again when your connection returns.'
						);
					}
					console.warn(`[gurusocial] Convex unreachable for ${key} — showing demo data`);
					// A Convex session token has no local session; create one so the
					// demo workspace can answer this read, then seed it once.
					try {
						await ensureDemoSession(String(args[0] ?? ''));
					} catch {
						/* seeding is best effort */
					}
					dataSource.set('demo');
					return (local[section] as any)[method](...args);
				}
			};
		}
		return out as DataProvider[S];
	};
	const sections = Object.keys(convex) as (keyof DataProvider)[];
	const wrapped: Record<string, unknown> = {};
	for (const section of sections) wrapped[section as string] = wrapSection(section);
	return wrapped as unknown as DataProvider;
}

const liveProvider = CONVEX_URL ? createConvexProvider(CONVEX_URL) : null;
const baseProvider: DataProvider = liveProvider ? withFallback(liveProvider, localProvider) : localProvider;
export const data: DataProvider = liveProvider ? withReadCache(baseProvider) : baseProvider;

const TOKEN_KEY = 'gurusocial.token.v1';

export interface SessionState {
	token: string | null;
	user: User | null;
	/** False until the persisted token has been checked once. */
	ready: boolean;
}

export const session = writable<SessionState>({ token: null, user: null, ready: false });

export function storedToken(): string | null {
	return storage.getItem(TOKEN_KEY);
}

export function persistToken(token: string | null) {
	if (token) storage.setItem(TOKEN_KEY, token);
	else storage.removeItem(TOKEN_KEY);
}

/** Map backend errors onto actionable, non-leaky messages. */
export function friendlyError(e: unknown): string {
	const raw = String((e as any)?.message ?? e ?? '').replace(/^Error:\s*/, '').trim();
	if (!raw) return 'Something went wrong. Please try again.';
	if (/failed to fetch|networkerror|network error|load failed|timed out|timeout/i.test(raw)) {
		return 'We could not reach the server. Check your connection and try again.';
	}
	if (/ArgumentValidationError|validator/i.test(raw)) {
		return 'That request was not valid. Check the fields and try again.';
	}
	if (/Request ID/i.test(raw) && /Server Error/i.test(raw)) {
		return `The server rejected that request. Retry — if it persists, quote this reference: ${raw.replace(/\s+/g, ' ').trim()}`;
	}
	if (/CouldNotFindFunction|not found/i.test(raw)) {
		return 'This feature is not available on the current backend build. Retry once the deployment finishes.';
	}
	if (/not configured/i.test(raw)) {
		return raw;
	}
	return raw.length > 300 ? raw.slice(0, 300) + '…' : raw;
}

/** Attempt to restore a session on boot. Always resolves. */
export async function restoreSession(): Promise<boolean> {
	const token = storedToken();
	if (!token) {
		session.set({ token: null, user: null, ready: true });
		return false;
	}
	try {
		const user = await data.auth.me(token);
		session.set({ token, user, ready: true });
		return true;
	} catch (e) {
		// Only discard the token when the backend positively rejects it; a network
		// blip must not silently sign the user out.
		if (!isNetworkError(e)) {
			persistToken(null);
			session.set({ token: null, user: null, ready: true });
			return false;
		}
		session.set({ token, user: null, ready: true });
		return false;
	}
}

/**
 * Sign in atomically: the backend returns the profile with the token, so a
 * successful sign-in can never be reported as a failure by a follow-up request.
 */
export async function signIn(email: string, password: string) {
	const res = await data.auth.signIn(email, password);
	persistToken(res.token);
	const user = res.user ?? (await data.auth.me(res.token));
	session.set({ token: res.token, user, ready: true });
	return user;
}

export async function signUp(email: string, name: string, password: string) {
	const res = await data.auth.signUp(email, name, password);
	persistToken(res.token);
	try {
		await data.auth.seedWorkspace(res.token);
	} catch {
		/* the demo provider seeds synchronously at signup; a live backend seeds lazily */
	}
	const user = res.user ?? (await data.auth.me(res.token));
	session.set({ token: res.token, user, ready: true });
	return user;
}

/** Refresh the cached user after a profile change. */
export async function refreshUser() {
	const token = storedToken();
	if (!token) return null;
	const user = await data.auth.me(token);
	session.set({ token, user, ready: true });
	return user;
}

/** Complete an OAuth or E-WIN hub sign-in with the token from the callback. */
export async function completeOAuth(token: string) {
	persistToken(token);
	const user = await data.auth.me(token);
	session.set({ token, user, ready: true });
	return user;
}

export async function signOut() {
	const token = storedToken();
	if (token) {
		try {
			await data.auth.signOut(token);
		} catch {
			/* local session ends regardless */
		}
	}
	persistToken(null);
	session.set({ token: null, user: null, ready: true });
}

/** Convenience: current token or throws with a helpful message. */
export function requireToken(): string {
	const token = storedToken() ?? get(session).token;
	if (!token) throw new Error('Your session has expired. Please sign in again.');
	return token;
}
