/**
 * Navigation banner registry.
 *
 * Each banner has a unique id, inscription, palette and destination. The
 * uniqueness is asserted by `scripts/verify-assets.mjs` (normalised inscription
 * comparison) so a copy-pasted banner cannot ship.
 */
export interface NavigationBannerConfig {
	id: string;
	inscription: string;
	description: string;
	href: string;
	theme: 'indigo' | 'mint' | 'amber';
}

export const NAVIGATION_BANNERS: NavigationBannerConfig[] = [
	{
		id: 'banner-compose',
		inscription: 'Write once, tune per network',
		description: 'Open the AI Composer and get platform-shaped drafts in seconds.',
		href: '/dashboard/composer',
		theme: 'indigo'
	},
	{
		id: 'banner-inbox',
		inscription: 'Answer where the customer is',
		description: 'Comments, DMs, mentions and reviews in one inbox with CRM handoff.',
		href: '/dashboard/inbox',
		theme: 'mint'
	},
	{
		id: 'banner-developer',
		inscription: 'Hand an API key to your own tools',
		description: 'REST and MCP endpoints, scoped keys, sandbox mode and request logs.',
		href: '/dashboard/developer',
		theme: 'amber'
	}
];
