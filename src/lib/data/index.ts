/**
 * Data layer selector + session store.
 *
 * Live mode: when VITE_CONVEX_URL is set, reads/writes go to the deployed Convex
 * backend. Network failures fall through to the demo provider so the interface
 * keeps rendering, and live data resumes automatically on recovery.
 * Demo mode: without VITE_CONVEX_URL the demo provider is used directly.
 *
 * Storage is wrapped (src/lib/util/storage.ts) so blocked localStorage in a
 * sandboxed frame or private window can never break sign-in.
 */
import { writable, get } from 'svelte/store';
import type { DataProvider, User } from '../types';
import { localProvider } from './local';
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

/** Only network-shaped failures trigger the demo fallback. */
function isNetworkError(e: unknown): boolean {
	const msg = String((e as any)?.message ?? e);
	if (/unauthor|invalid|expired|already exists|incorrect|must be|required|not found|forbidden|permission/i.test(msg)) {
		return false;
	}
	return /failed to fetch|networkerror|network error|typeerror|fetch failed|timeout|econn|dns|load failed|offline/i.test(msg);
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
	notifications: ['list', 'preferences']
};

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
			out[method] = async (...args: any[]) => {
				try {
					return await (fn as any)(...args);
				} catch (e) {
					if (isNetworkError(e)) {
						console.warn(`[gurusocial] Convex unreachable for ${String(section)}.${method} — using demo data`);
						return (local[section] as any)[method](...args);
					}
					throw e;
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
	if (/failed to fetch|networkerror|network error|load failed|timeout/i.test(raw)) {
		return 'We could not reach the server. Check your connection and try again — the app will use local data meanwhile.';
	}
	if (/ArgumentValidationError|validator/i.test(raw)) {
		return 'That request was not valid. Check the fields and try again.';
	}
	if (/CouldNotFindFunction|not found/i.test(raw)) {
		return 'This feature is not available on the current backend build. Please retry after the deployment finishes.';
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

export async function signIn(email: string, password: string) {
	const { token } = await data.auth.signIn(email, password);
	persistToken(token);
	const user = await data.auth.me(token);
	session.set({ token, user, ready: true });
	return user;
}

export async function signUp(email: string, name: string, password: string) {
	const { token } = await data.auth.signUp(email, name, password);
	persistToken(token);
	try {
		await data.auth.seedWorkspace(token);
	} catch {
		/* demo provider seeds synchronously at signup */
	}
	const user = await data.auth.me(token);
	session.set({ token, user, ready: true });
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

/** Complete an OAuth sign-in (Google/GitHub) with the token from the callback. */
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
