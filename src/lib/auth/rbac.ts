/**
 * Role-based access control — presentation layer.
 *
 * The authoritative checks live in Convex (`convex/rbac.ts`). This module only
 * decides what the interface offers; hiding a control is never treated as a
 * security boundary.
 */

export type Role = 'owner' | 'admin' | 'approver' | 'member';

export type Permission =
	| 'profile.read.self'
	| 'profile.update.self'
	| 'workspace.read'
	| 'posts.create'
	| 'posts.approve'
	| 'posts.delete'
	| 'analytics.read'
	| 'inbox.read'
	| 'inbox.reply'
	| 'crm.read'
	| 'crm.write'
	| 'messages.read.participant'
	| 'messages.create'
	| 'notifications.manage_preferences'
	| 'team.read'
	| 'team.manage'
	| 'developer.keys'
	| 'admin.users.read'
	| 'admin.users.manage'
	| 'admin.audit.read'
	| 'admin.broadcast'
	| 'admin.console';

export interface RoleDefinition {
	id: Role;
	name: string;
	description: string;
	selfSelectable: boolean;
	requiresReview: boolean;
	permissions: Permission[];
}

const MEMBER_PERMISSIONS: Permission[] = [
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
];

const APPROVER_PERMISSIONS: Permission[] = [
	...MEMBER_PERMISSIONS,
	'posts.approve',
	'posts.delete',
	'crm.write'
];

const ADMIN_PERMISSIONS: Permission[] = [
	...APPROVER_PERMISSIONS,
	'team.read',
	'team.manage',
	'developer.keys'
];

const OWNER_PERMISSIONS: Permission[] = [...ADMIN_PERMISSIONS];

export const ROLES: Record<Role, RoleDefinition> = {
	member: {
		id: 'member',
		name: 'Member',
		description: 'Creates and schedules content, works the inbox and reads analytics.',
		selfSelectable: true,
		requiresReview: false,
		permissions: MEMBER_PERMISSIONS
	},
	approver: {
		id: 'approver',
		name: 'Approver',
		description: 'Reviews and approves queued posts, can publish and delete.',
		selfSelectable: true,
		requiresReview: true,
		permissions: APPROVER_PERMISSIONS
	},
	admin: {
		id: 'admin',
		name: 'Workspace admin',
		description: 'Manages channels, team access, API keys and billing for one workspace.',
		selfSelectable: false,
		requiresReview: false,
		permissions: ADMIN_PERMISSIONS
	},
	owner: {
		id: 'owner',
		name: 'Owner',
		description: 'Full control of the workspace, including role assignment.',
		selfSelectable: false,
		requiresReview: false,
		permissions: OWNER_PERMISSIONS
	}
};

export const SELF_SELECTABLE_ROLES: RoleDefinition[] = Object.values(ROLES).filter((r) => r.selfSelectable);

export function permissionsFor(role: string | undefined | null): Permission[] {
	if (!role) return MEMBER_PERMISSIONS;
	return ROLES[role as Role]?.permissions ?? MEMBER_PERMISSIONS;
}

/** True when the signed-in user holds a permission in their workspace. */
export function can(user: { role?: string | null } | null | undefined, permission: Permission): boolean {
	return permissionsFor(user?.role).includes(permission);
}
