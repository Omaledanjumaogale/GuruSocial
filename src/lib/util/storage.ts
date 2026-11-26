/**
 * Storage that cannot break the app.
 *
 * Plain `localStorage` throws a SecurityError in sandboxed iframes, Safari
 * private mode and blocked third-party contexts. Every data call is wrapped in
 * storage access, so a throwing localStorage previously made sign-in and
 * sign-up fail with a confusing error. This wrapper degrades to an in-memory
 * map instead of throwing.
 */

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const memory = new Map<string, string>();
let backend: StorageLike | null | undefined;

function resolve(): StorageLike | null {
	if (backend !== undefined) return backend;
	try {
		if (typeof window === 'undefined' || !window.localStorage) {
			backend = null;
			return backend;
		}
		const probe = '__gurusocial_probe__';
		window.localStorage.setItem(probe, '1');
		window.localStorage.removeItem(probe);
		backend = window.localStorage;
	} catch {
		backend = null;
	}
	return backend;
}

export const storage = {
	get available(): boolean {
		return resolve() !== null;
	},
	getItem(key: string): string | null {
		const b = resolve();
		if (!b) return memory.get(key) ?? null;
		try {
			return b.getItem(key);
		} catch {
			return memory.get(key) ?? null;
		}
	},
	setItem(key: string, value: string): void {
		const b = resolve();
		if (b) {
			try {
				b.setItem(key, value);
				return;
			} catch {
				/* quota or blocked — fall through to memory */
			}
		}
		memory.set(key, value);
	},
	removeItem(key: string): void {
		memory.delete(key);
		const b = resolve();
		if (!b) return;
		try {
			b.removeItem(key);
		} catch {
			/* ignore */
		}
	}
};
