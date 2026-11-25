/**
 * Data layer selector + session store.
 * Uses Convex when VITE_CONVEX_URL is set (production / connected dev), and the
 * complete local demo provider otherwise, so the product always renders.
 */
import { writable } from 'svelte/store';
import type { DataProvider, User } from '../types';
import { localProvider } from './local';
import { createConvexProvider } from './convex';

const CONVEX_URL = import.meta.env.VITE_CONVEX_URL as string | undefined;
export const backendMode: 'convex' | 'local' = CONVEX_URL ? 'convex' : 'local';
export const data: DataProvider = CONVEX_URL ? createConvexProvider(CONVEX_URL) : localProvider;

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
	} catch (e) {
		console.error('[gurusocial] session restore failed:', e);
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
