import { v } from 'convex/values';
import { queryGeneric as query, mutationGeneric as mutation } from 'convex/server';
import { requireUser, type Ctx, type MutCtx, type Doc } from './lib';

/**
 * RBAC — the authoritative permission layer.
 *
 * Roles live on the user record and are only ever changed by an owner/admin
 * through `adminOps.setUserRole` (or by signup, which creates an owner). Every
 * protected operation resolves the role from the database; a role or permission
 * supplied by the client is never trusted.
 */
export type Role = 'owner' | 'admin' | 'approver' | 'member';

export const ROLE_PERMISSIONS: Record<Role, readonly string[]> = {
	member: [
		'profile.read.self',
		'profile.update.self',
		'workspace.read',
		'posts.create',
		'analytics.read',
		'inbox.read',
		'inbox.reply',
		'crm.read',
		'messages.read.participant',
		'messages.create',
		'notifications.manage_preferences'
	],
	approver: [
		'profile.read.self',
		'profile.update.self',
		'workspace.read',
		'posts.create',
		'analytics.read',
		'inbox.read',
		'inbox.reply',
		'crm.read',
		'crm.write',
		'messages.read.participant',
		'messages.create',
		'notifications.manage_preferences',
		'posts.approve',
		'posts.delete'
	],
	admin: [
		'profile.read.self',
		'profile.update.self',
		'workspace.read',
		'posts.create',
		'analytics.read',
		'inbox.read',
		'inbox.reply',
		'crm.read',
		'crm.write',
		'messages.read.participant',
		'messages.create',
		'notifications.manage_preferences',
		'posts.approve',
		'posts.delete',
		'team.read',
		'team.manage',
		'developer.keys'
	],
	owner: []
};

// Owner inherits every permission.
ROLE_PERMISSIONS.owner = Array.from(new Set(Object.values(ROLE_PERMISSIONS).flat()));

export function hasPermission(role: string | undefined | null, permission: string): boolean {
	const permissions = ROLE_PERMISSIONS[(role ?? 'member') as Role] ?? ROLE_PERMISSIONS.member;
	return permissions.includes(permission);
}

/** Throws unless the signed-in user's stored role grants the permission. */
export function assertPermission(user: Doc<'users'>, permission: string): void {
	if (!hasPermission(user.role, permission)) {
		throw new Error(`Forbidden: your role (${user.role}) cannot perform ${permission}.`);
	}
}

/** Resolve an operator session token (super-admin console). */
export async function requireAdmin(ctx: Ctx | MutCtx, adminToken: string) {
	const session = await ctx.db
		.query('adminSessions')
		.withIndex('by_token', (q) => q.eq('token', adminToken))
		.unique();
	if (!session || session.expiresAt < Date.now()) throw new Error('Admin session invalid or expired. Sign in again.');
	return session;
}

/** Record a privacy-aware activity event (never message bodies or secrets). */
export async function recordActivity(
	ctx: MutCtx,
	event: {
		userId?: any;
		actor: string;
		eventType: string;
		targetType: string;
		targetId: string;
		outcome?: string;
		metadata?: Record<string, unknown>;
	}
) {
	await ctx.db.insert('activityEvents', {
		userId: event.userId,
		actor: event.actor,
		eventType: event.eventType,
		targetType: event.targetType,
		targetId: String(event.targetId),
		outcome: event.outcome ?? 'success',
		metadata: event.metadata,
		createdAt: Date.now()
	});
}

/** Public: the caller's effective permissions, resolved server-side. */
export const myPermissions = query({
	args: { token: v.string() },
	returns: v.object({ role: v.string(), permissions: v.array(v.string()) }),
	handler: async (ctx, { token }) => {
		const user = await requireUser(ctx, token);
		return { role: user.role, permissions: [...(ROLE_PERMISSIONS[user.role as Role] ?? [])] };
	}
});
