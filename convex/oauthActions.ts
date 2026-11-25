"use node";
import { v } from 'convex/values';
import { internalActionGeneric as internalAction } from 'convex/server';
import { requireNodeEnv } from './lib';

/**
 * Exchanges OAuth authorization codes for user profiles.
 * Runs in the Node action runtime so provider secrets (Convex env vars) and
 * fetch are available. Returns a normalized profile or throws.
 */
export const exchangeGoogle = internalAction({
	args: { code: v.string(), redirectUri: v.string() },
	returns: v.object({ email: v.string(), name: v.string(), providerAccountId: v.string() }),
	handler: async (ctx, { code, redirectUri }) => {
		const clientId = requireNodeEnv('GOOGLE_CLIENT_ID');
		const clientSecret = requireNodeEnv('GOOGLE_CLIENT_SECRET');
		const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code'
			})
		});
		if (!tokenRes.ok) throw new Error(`Google token exchange failed: ${tokenRes.status}`);
		const { access_token } = await tokenRes.json();
		const infoRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
			headers: { authorization: `Bearer ${access_token}` }
		});
		if (!infoRes.ok) throw new Error(`Google userinfo failed: ${infoRes.status}`);
		const info = await infoRes.json();
		if (!info.email) throw new Error('Google account has no verified email.');
		return { email: info.email, name: info.name ?? info.email.split('@')[0], providerAccountId: String(info.sub) };
	}
});

export const exchangeGithub = internalAction({
	args: { code: v.string(), redirectUri: v.string() },
	returns: v.object({ email: v.string(), name: v.string(), providerAccountId: v.string() }),
	handler: async (ctx, { code, redirectUri }) => {
		const clientId = requireNodeEnv('GITHUB_CLIENT_ID');
		const clientSecret = requireNodeEnv('GITHUB_CLIENT_SECRET');
		const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
			method: 'POST',
			headers: { 'content-type': 'application/json', accept: 'application/json' },
			body: JSON.stringify({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri })
		});
		if (!tokenRes.ok) throw new Error(`GitHub token exchange failed: ${tokenRes.status}`);
		const { access_token } = await tokenRes.json();
		if (!access_token) throw new Error('GitHub did not return an access token.');
		const userRes = await fetch('https://api.github.com/user', { headers: { authorization: `Bearer ${access_token}`, accept: 'application/vnd.github+json' } });
		if (!userRes.ok) throw new Error(`GitHub user fetch failed: ${userRes.status}`);
		const user = await userRes.json();
		let email = user.email;
		if (!email) {
			const emailRes = await fetch('https://api.github.com/user/emails', { headers: { authorization: `Bearer ${access_token}`, accept: 'application/vnd.github+json' } });
			if (emailRes.ok) {
				const emails = await emailRes.json();
				email = (emails.find((e: any) => e.primary && e.verified) ?? emails[0])?.email;
			}
		}
		if (!email) throw new Error('GitHub account has no accessible email. Enable the user:email scope.');
		return { email, name: user.name ?? user.login, providerAccountId: String(user.id) };
	}
});
