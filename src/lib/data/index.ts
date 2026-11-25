/**
 * Data layer selector + session store.
 *
 * Live mode: when VITE_CONVEX_URL is set, all reads/writes go to the deployed
 * Convex backend. If the backend is unreachable (offline, network error), the
 * complete in-browser demo provider transparently takes over so the app keeps
 * rendering — and switches back to live data automatically on recovery.
 * Mock mode: without VITE_CONVEX_URL, the demo provider is used directly.
 */
import { writable } from 'svelte/store';
import type { DataProvider, User } from '../types';
import { localProvider } from './local';
import { createConvexProvider } from './convex';

const CONVEX_URL = import.meta.env.VITE_CONVEX_URL as string | undefined;
export const CONVEX_HTTP_URL = (import.meta.env.VITE_CONVEX_HTTP_URL as string | undefined)
	?? (CONVEX_URL ? CONVEX_URL.replace('.cloud', '.site') : undefined);
export const PUBLIC_APP_URL = (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined) ?? (typeof location !== 'undefined' ? location.origin : '');
export const backendMode: 'convex' | 'local' = CONVEX_URL ? 'convex' : 'local';

/** Network-shaped failures are the only ones that trigger the demo fallback. */
function isNetworkError(e: unknown): boolean {
	const msg = String((e as any)?.message ?? e);
	return /failed to fetch|networkerror|network error|typeerror|fetch failed|timeout|econn|dns/i.test(msg);
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
	return {
		auth: wrapSection('auth'),
		profiles: wrapSection('profiles'),
		posts: wrapSection('posts'),
		analytics: wrapSection('analytics'),
		inbox: wrapSection('inbox'),
		automations: wrapSection('automations'),
		crm: wrapSection('crm'),
		keys: wrapSection('keys'),
		ewin: wrapSection('ewin'),
		ai: wrapSection('ai'),
		media: wrapSection('media'),
		harvest: wrapSection('harvest')
	};
}

const liveProvider = CONVEX_URL ? createConvexProvider(CONVEX_URL) : null;
export const data: DataProvider = liveProvider ? withFallback(liveProvider, localProvider) : localProvider;

const TOKEN_KEY = 'gurusocial.token.v1';

export const session = writable<{ token: string | null; user: User | null }>({ token: null, user: null });

export function storedToken(): string | null {
	return localStorage.getItem(TOKEN_KEY);
}

export function persistToken(token: string | null) {
	if (token) localStorage.setItem(TOKEN_KEY, token);
	else localStorage.removeItem(TOKEN_KEY);
}

/** Attempt to restore a session on app boot. */
export async function restoreSession(): Promise<boolean> {
	const token = storedToken();
	if (!token) return false;
	try {
		const user = await data.auth.me(token);
		session.set({ token, user });
		return true;
	} catch {
		persistToken(null);
		session.set({ token: null, user: null });
		return false;
	}
}

export async function signIn(email: string, password: string) {
	const { token } = await data.auth.signIn(email, password);
	persistToken(token);
	const user = await data.auth.me(token);
	session.set({ token, user });
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
	session.set({ token, user });
	return user;
}

/** Complete an OAuth sign-in (Google/GitHub) with the token from the callback. */
export async function completeOAuth(token: string) {
	persistToken(token);
	const user = await data.auth.me(token);
	session.set({ token, user });
	return user;
}

export async function signOut() {
	const token = storedToken();
	if (token) await data.auth.signOut(token);
	persistToken(null);
	session.set({ token: null, user: null });
}

/** Convenience: current token or throws with a helpful message. */
export function requireToken(): string {
	const token = storedToken();
	if (!token) throw new Error('Your session has expired. Please sign in again.');
	return token;
}
