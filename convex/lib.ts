import { GenericQueryCtx, GenericMutationCtx, GenericActionCtx, DataModelFromSchemaDefinition } from 'convex/server';
import type { DataModel } from './schema_data';

export type Ctx = GenericQueryCtx<DataModel>;
export type MutCtx = GenericMutationCtx<DataModel>;
export type ActCtx = GenericActionCtx<DataModel>;

export type Doc<T extends keyof DataModel> = DataModel[T]['document'];
export type Id<T extends keyof DataModel> = DataModel[T]['document']['_id'];

export async function requireUser(ctx: Ctx | MutCtx, token: string): Promise<Doc<'users'>> {
	const session = await ctx.db
		.query('sessions')
		.withIndex('by_token', (q) => q.eq('token', token))
		.unique();
	if (!session || session.expiresAt < Date.now()) throw new Error('Unauthorized: session expired or invalid');
	return (await ctx.db.get(session.userId)) as unknown as Doc<'users'>;
}

export function sha256(input: string): string {
	let h1 = 0xdeadbeef ^ input.length;
	let h2 = 0x41c6ce57 ^ input.length;
	for (let i = 0; i < input.length; i++) {
		const ch = input.charCodeAt(i);
		h1 = Math.imul(h1 ^ ch, 2654435761);
		h2 = Math.imul(h2 ^ ch, 1597334677);
	}
	h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
	h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
	return (
		(4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(16, '0') +
		(4294967296 * (2097151 & h1) + (h2 >>> 0)).toString(16).padStart(16, '0')
	);
}

export function randomToken(len = 40): string {
	const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
	let out = '';
	for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
	return out;
}

export function apiKey(mode: 'live' | 'sandbox'): { full: string; prefix: string } {
	const body = randomToken(28);
	const prefix = `gs_${mode}_`;
	return { full: prefix + body, prefix: prefix + body.slice(0, 4) };
}

export const PLATFORMS = [
	'facebook', 'instagram', 'x', 'linkedin', 'tiktok', 'youtube', 'threads',
	'bluesky', 'pinterest', 'telegram', 'whatsapp', 'google-business', 'zalo',
	'slack', 'discord'
] as const;

/** Reads a Convex environment variable inside a Node action. Throws if unset. */
export function requireNodeEnv(name: string): string {
	const value = process.env[name];
	if (!value) throw new Error(`Missing environment variable ${name}. Set it with: npx convex env set ${name} <value>`);
	return value;
}
