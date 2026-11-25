import { writable } from 'svelte/store';

export interface Toast {
	id: number;
	message: string;
	kind: 'success' | 'error' | 'info';
}

export const toasts = writable<Toast[]>([]);
let nextId = 1;

export function toast(message: string, kind: Toast['kind'] = 'success') {
	const id = nextId++;
	toasts.update((t) => [...t, { id, message, kind }]);
	setTimeout(() => toasts.update((t) => t.filter((x) => x.id !== id)), 4200);
}
