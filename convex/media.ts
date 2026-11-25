"use node";
import { v } from 'convex/values';
import { actionGeneric as action } from 'convex/server';
import { requireNodeEnv, sha256 } from './lib';
import { anyApi } from 'convex/server';
import { createHmac, createHash } from 'node:crypto';

const api = anyApi;

/**
 * Cloudflare R2 (S3-compatible) presigned PUT uploads.
 * SigV4 query presigning so the browser uploads media directly to R2 without
 * touching GuruSocial servers. Credentials come from encrypted Convex env vars.
 */
function presignPutR2(opts: {
	accessKeyId: string; secretAccessKey: string; accountId: string; bucket: string; key: string; expiresIn: number;
}): string {
	const host = `${opts.accountId}.r2.cloudflarestorage.com`;
	const region = 'auto';
	const service = 's3';
	const now = new Date();
	const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
	const dateStamp = amzDate.slice(0, 8);
	const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;

	const query = new URLSearchParams({
		'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
		'X-Amz-Credential': `${opts.accessKeyId}/${credentialScope}`,
		'X-Amz-Date': amzDate,
		'X-Amz-Expires': String(opts.expiresIn),
		'X-Amz-SignedHeaders': 'host'
	});

	const canonicalUri = `/${opts.bucket}/${opts.key.split('/').map(encodeURIComponent).join('/')}`;
	const canonicalRequest = [
		'PUT', canonicalUri, query.toString(),
		`host:${host}\n`, 'host', 'UNSIGNED-PAYLOAD'
	].join('\n');

	const hmac = (key: Buffer | string, data: string) => createHmac('sha256', key).update(data).digest();
	const kDate = hmac(`AWS4${opts.secretAccessKey}`, dateStamp);
	const kRegion = hmac(kDate, region);
	const kService = hmac(kRegion, service);
	const kSigning = hmac(kService, 'aws4_request');
	const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, sha256hex(canonicalRequest)].join('\n');
	const signature = createHmac('sha256', kSigning).update(stringToSign).digest('hex');
	return `https://${host}${canonicalUri}?${query.toString()}&X-Amz-Signature=${signature}`;
}

function sha256hex(input: string): string {
	return createHash('sha256').update(input).digest('hex');
}

export const presignUpload = action({
	args: { token: v.string(), fileName: v.string(), contentType: v.string() },
	returns: v.object({ uploadUrl: v.string(), publicUrl: v.string(), key: v.string() }),
	handler: async (ctx, { token, fileName, contentType }) => {
		const session = await ctx.runQuery(api.authInternal.byToken, { token });
		if (!session) throw new Error('Your session has expired. Please sign in again.');
		const accountId = requireNodeEnv('R2_ACCOUNT_ID');
		const accessKeyId = requireNodeEnv('R2_ACCESS_KEY_ID');
		const secretAccessKey = requireNodeEnv('R2_SECRET_ACCESS_KEY');
		const bucket = process.env.R2_BUCKET ?? 'gurusocial-media';
		const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
		const key = `${String(session.userId).slice(-8)}/${Date.now()}-${sha256(safe).slice(0, 8)}-${safe}`;
		const uploadUrl = presignPutR2({
			accessKeyId, secretAccessKey, accountId, bucket, key, expiresIn: 900
		});
		return { uploadUrl, publicUrl: uploadUrl.split('?')[0], key };
	}
});

/** Admin/utility: verify R2 bucket reachability (writes a probe object). */
export const healthCheck = action({
	args: {},
	returns: v.object({ ok: v.boolean(), detail: v.string() }),
	handler: async (ctx) => {
		try {
			const accountId = requireNodeEnv('R2_ACCOUNT_ID');
			const accessKeyId = requireNodeEnv('R2_ACCESS_KEY_ID');
			const secretAccessKey = requireNodeEnv('R2_SECRET_ACCESS_KEY');
			const bucket = process.env.R2_BUCKET ?? 'gurusocial-media';
			const url = presignPutR2({ accessKeyId, secretAccessKey, accountId, bucket, key: `healthcheck-${Date.now()}.txt`, expiresIn: 60 });
			const res = await fetch(url, { method: 'PUT', body: 'gurusocial healthcheck' });
			return { ok: res.ok, detail: `R2 PUT returned ${res.status} on bucket "${bucket}"` };
		} catch (e: any) {
			return { ok: false, detail: e.message };
		}
	}
});
