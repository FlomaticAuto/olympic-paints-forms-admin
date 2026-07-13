// Minimal Cloudflare R2 upload via AWS SigV4 (no SDK). Extracted from the
// resin-leads photo-upload route so the estimate PDF can be archived too.

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID ?? '';
const R2_ACCESS_KEY = process.env.R2_ACCESS_KEY ?? '';
const R2_SECRET_KEY = process.env.R2_SECRET_KEY ?? '';
const R2_BUCKET     = process.env.R2_BUCKET     ?? 'olympic-paints-merch';
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL ?? ''; // e.g. https://pub-xxx.r2.dev

export function r2Configured(): boolean {
  return Boolean(R2_ACCOUNT_ID && R2_ACCESS_KEY && R2_SECRET_KEY);
}

/**
 * Upload bytes to R2 at objectKey and return a browser-openable URL.
 * Throws if R2 is not configured or the PUT fails.
 */
export async function uploadToR2(
  objectKey: string, body: ArrayBuffer | Uint8Array, contentType: string,
): Promise<string> {
  if (!r2Configured()) throw new Error('R2 not configured');
  const buf: ArrayBuffer = body instanceof Uint8Array
    ? (body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer)
    : body;
  const endpoint = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}/${objectKey}`;
  await r2Put(endpoint, contentType, buf, R2_ACCESS_KEY, R2_SECRET_KEY);
  return R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/${objectKey}` : endpoint;
}

// ── AWS Signature v4 PUT ─────────────────────────────────────────────────────
async function r2Put(endpoint: string, contentType: string, body: ArrayBuffer, accessKey: string, secretKey: string) {
  const url      = new URL(endpoint);
  const now      = new Date();
  const date     = now.toISOString().slice(0, 10).replace(/-/g, '');
  const datetime = now.toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z';
  const region   = 'auto';
  const service  = 's3';

  const bodyHash = await sha256hex(body);

  const canonHeaders =
    `content-type:${contentType}\n` +
    `host:${url.host}\n` +
    `x-amz-content-sha256:${bodyHash}\n` +
    `x-amz-date:${datetime}\n`;
  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';

  const canonReq  = ['PUT', url.pathname, '', canonHeaders, signedHeaders, bodyHash].join('\n');
  const credScope = `${date}/${region}/${service}/aws4_request`;
  const strToSign = ['AWS4-HMAC-SHA256', datetime, credScope, await sha256hex(new TextEncoder().encode(canonReq))].join('\n');

  const sigKey  = await deriveKey(secretKey, date, region, service);
  const sig     = await hmacHex(sigKey, strToSign);
  const authHdr = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credScope},SignedHeaders=${signedHeaders},Signature=${sig}`;

  const res = await fetch(endpoint, {
    method: 'PUT',
    headers: {
      'Content-Type':         contentType,
      'x-amz-content-sha256': bodyHash,
      'x-amz-date':           datetime,
      'Authorization':        authHdr,
    },
    body,
  });
  if (!res.ok) throw new Error(`R2 PUT ${res.status}: ${await res.text()}`);
}

async function sha256hex(data: ArrayBuffer | Uint8Array): Promise<string> {
  const src = data instanceof Uint8Array
    ? (data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer)
    : data;
  const buf = await crypto.subtle.digest('SHA-256', src);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
async function hmacRaw(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const rawKey = key instanceof Uint8Array
    ? (key.buffer.slice(key.byteOffset, key.byteOffset + key.byteLength) as ArrayBuffer)
    : key;
  const k = await crypto.subtle.importKey('raw', rawKey, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', k, new TextEncoder().encode(data));
}
async function hmacHex(key: ArrayBuffer, data: string): Promise<string> {
  const raw = await hmacRaw(key, data);
  return Array.from(new Uint8Array(raw)).map(b => b.toString(16).padStart(2, '0')).join('');
}
async function deriveKey(secret: string, date: string, region: string, service: string): Promise<ArrayBuffer> {
  const kDate    = await hmacRaw(new TextEncoder().encode('AWS4' + secret), date);
  const kRegion  = await hmacRaw(kDate, region);
  const kService = await hmacRaw(kRegion, service);
  return hmacRaw(kService, 'aws4_request');
}
