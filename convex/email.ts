"use node";
import { v } from 'convex/values';
import { internalActionGeneric as internalAction, actionGeneric as action } from 'convex/server';
import { requireNodeEnv } from './lib';

const FROM = 'onboarding@resend.dev';

async function resendSend(to: string[], subject: string, html: string): Promise<string> {
	const key = requireNodeEnv('RESEND_API_KEY');
	const res = await fetch('https://api.resend.com/emails', {
		method: 'POST',
		headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
		body: JSON.stringify({ from: FROM, to: to.map((t) => t.toLowerCase()), subject, html })
	});
	const data = await res.json();
	if (!res.ok) throw new Error(`Resend error (${res.status}): ${data?.message ?? 'unknown'}`);
	return data.id as string;
}

async function requireAdmin(ctx: any, adminToken: string): Promise<string> {
	const session = await ctx.runQuery(api.adminInternal.byToken, { token: adminToken });
	if (!session) throw new Error('Admin session invalid or expired.');
	return session.email;
}

import { anyApi } from 'convex/server';
const api = anyApi;

/** Internal: sends the Resend test email to the super admin. */
export const sendTestInternal = internalAction({
	args: {},
	returns: v.object({ id: v.string() }),
	handler: async () => {
		const to = requireNodeEnv('SUPER_ADMIN_EMAIL');
		const id = await resendSend([to], 'GuruSocial — Resend integration test ✅', [
			'<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px">',
			'<h2 style="color:#4f46e5">GuruSocial ✉️ Resend test</h2>',
			'<p>Your Resend integration is live and connected to the GuruSocial Convex backend.</p>',
			`<p>Sent at <b>${new Date().toISOString()}</b> from deployment <b>beaming-bobcat-890</b>.</p>`,
			'<p style="color:#64748b;font-size:12px">Welcome emails, digest reports and automation notifications use this same channel.</p>',
			'</div>'
		].join(''));
		return { id };
	}
});

/** Admin console action: verify token then send the test email. */
export const sendTestEmail = action({
	args: { adminToken: v.string() },
	returns: v.object({ id: v.string() }),
	handler: async (ctx, { adminToken }) => {
		await requireAdmin(ctx, adminToken);
		return await ctx.runAction(api.email.sendTestInternal, {});
	}
});

/** Internal: welcome email for new signups (best-effort, never blocks). */
export const sendWelcomeInternal = internalAction({
	args: { to: v.string(), name: v.string() },
	returns: v.null(),
	handler: async (ctx, { to, name }) => {
		try {
			await resendSend([to], 'Welcome to GuruSocial 👋', [
				'<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px">',
				`<h2 style="color:#4f46e5">Welcome, ${name}!</h2>`,
				'<p>Your GuruSocial command center is ready: AI Composer, unified inbox, analytics, CRM, automations, API and MCP — across 15 platforms.</p>',
				'<p>Start in the <b>AI Composer</b>, then connect your channels.</p>',
				'</div>'
			].join(''));
		} catch (e: any) {
			// Resend sandbox only delivers to the account owner until a domain is verified.
			console.error(`[welcome-email] skipped: ${e.message}`);
		}
	}
});
