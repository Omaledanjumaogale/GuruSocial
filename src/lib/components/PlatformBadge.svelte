<script lang="ts">
	const PLATFORM_META: Record<string, { name: string; color: string; glyph: string }> = {
		facebook: { name: 'Facebook', color: '#1877f2', glyph: 'f' },
		instagram: { name: 'Instagram', color: '#d6336c', glyph: '◎' },
		x: { name: 'X', color: '#0f172a', glyph: '𝕏' },
		linkedin: { name: 'LinkedIn', color: '#0a66c2', glyph: 'in' },
		tiktok: { name: 'TikTok', color: '#fe2c55', glyph: '♪' },
		youtube: { name: 'YouTube', color: '#ff0000', glyph: '▶' },
		threads: { name: 'Threads', color: '#a855f7', glyph: '@' },
		bluesky: { name: 'Bluesky', color: '#4169e1', glyph: '🦋' },
		pinterest: { name: 'Pinterest', color: '#e60023', glyph: 'P' },
		telegram: { name: 'Telegram', color: '#0088cc', glyph: '✈' },
		whatsapp: { name: 'WhatsApp', color: '#25d366', glyph: '✆' },
		'google-business': { name: 'Google Business', color: '#f4b400', glyph: 'G' },
		zalo: { name: 'Zalo', color: '#0e84f5', glyph: 'Z' },
		slack: { name: 'Slack', color: '#611f69', glyph: '#' },
		discord: { name: 'Discord', color: '#5865f2', glyph: '◆' }
	};
	let { platform, size = 'md' } = $props();
	const meta = $derived(PLATFORM_META[platform] ?? { name: platform, color: '#6366f1', glyph: '·' });
	const dims = $derived(size === 'sm' ? 'h-5 w-5 text-[9px]' : size === 'lg' ? 'h-9 w-9 text-sm' : 'h-7 w-7 text-[11px]');
</script>

<span
	class={`inline-flex ${dims} items-center justify-center rounded-full font-bold text-white shadow`}
	style={`background:${meta.color}`}
	title={meta.name}
>{meta.glyph}</span>
