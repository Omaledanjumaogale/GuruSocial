import type { Permission } from '$lib/auth/rbac';

/**
 * Single source of truth for workspace navigation. Desktop sidebar, mobile
 * drawer and the bottom bar all read from here so destinations, labels and
 * permission requirements cannot drift apart.
 *
 * `permission` controls presentation only — the server enforces the same
 * capability on every request.
 */
export interface NavItem {
	id: string;
	label: string;
	href: string;
	icon: string;
	permission?: Permission;
	badge?: 'messages' | 'notifications';
	mobilePriority?: number;
}

export interface NavSection {
	group: string;
	items: NavItem[];
}

export const NAVIGATION: NavSection[] = [
	{
		group: 'Command center',
		items: [
			{ id: 'overview', label: 'Overview', href: '/dashboard', icon: '◈', permission: 'workspace.read', mobilePriority: 1 },
			{ id: 'composer', label: 'AI Composer', href: '/dashboard/composer', icon: '✦', permission: 'posts.create', mobilePriority: 2 },
			{ id: 'calendar', label: 'Calendar & queue', href: '/dashboard/calendar', icon: '▦', permission: 'posts.create' },
			{ id: 'posts', label: 'Posts & approvals', href: '/dashboard/posts', icon: '▤', permission: 'workspace.read' },
			{ id: 'inbox', label: 'Unified inbox', href: '/dashboard/inbox', icon: '✉', permission: 'inbox.read' },
			{ id: 'messages', label: 'Messages', href: '/dashboard/messages', icon: '✉', permission: 'messages.read.participant', badge: 'messages', mobilePriority: 3 },
			{ id: 'notifications', label: 'Notifications', href: '/dashboard/notifications', icon: '◔', permission: 'profile.read.self', badge: 'notifications' }
		]
	},
	{
		group: 'Intelligence',
		items: [
			{ id: 'analytics', label: 'Analytics', href: '/dashboard/analytics', icon: '◔', permission: 'analytics.read', mobilePriority: 4 },
			{ id: 'reports', label: 'Reports', href: '/dashboard/reports', icon: '▥', permission: 'analytics.read' },
			{ id: 'agents', label: 'AI agents & automations', href: '/dashboard/agents', icon: '⚙', permission: 'workspace.read' },
			{ id: 'studio', label: 'Visual studio', href: '/dashboard/studio', icon: '▣', permission: 'workspace.read' }
		]
	},
	{
		group: 'Growth',
		items: [
			{ id: 'crm', label: 'CRM & pipeline', href: '/dashboard/crm', icon: '◔', permission: 'crm.read' },
			{ id: 'campaigns', label: 'Campaigns', href: '/dashboard/campaigns', icon: '◈', permission: 'workspace.read' },
			{ id: 'channels', label: 'Channels', href: '/dashboard/channels', icon: '⚯', permission: 'workspace.read' }
		]
	},
	{
		group: 'Enterprise',
		items: [
			{ id: 'ecosystem', label: 'E-WIN ecosystem', href: '/dashboard/ecosystem', icon: '⟡', permission: 'workspace.read' },
			{ id: 'integrations', label: 'Reverse Studio', href: '/dashboard/integrations', icon: '⟐', permission: 'workspace.read' },
			{ id: 'developer', label: 'Developer & API', href: '/dashboard/developer', icon: '⌨', permission: 'developer.keys' },
			{ id: 'team', label: 'Team & audit', href: '/dashboard/team', icon: '⚇', permission: 'team.read' },
			{ id: 'settings', label: 'Settings', href: '/dashboard/settings', icon: '⚙', permission: 'profile.read.self' }
		]
	}
];

/** Items for a small-screen bottom bar, ordered by mobilePriority. */
export const MOBILE_NAV: NavItem[] = NAVIGATION.flatMap((section) => section.items)
	.filter((item) => item.mobilePriority)
	.sort((a, b) => (a.mobilePriority ?? 99) - (b.mobilePriority ?? 99));
