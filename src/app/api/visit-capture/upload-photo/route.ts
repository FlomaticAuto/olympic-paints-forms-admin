import { NextRequest, NextResponse } from 'next/server';
import { corsHeaders } from '@/lib/cors';

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID  ?? '';
const R2_ACCESS_KEY = process.env.R2_ACCESS_KEY   ?? '';
const R2_SECRET_KEY = process.env.R2_SECRET_KEY   ?? '';
const R2_BUCKET     = process.env.R2_BUCKET       ?? 'olympic-paints-merch';
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL   ?? ''; // e.g. https://pub-xxx.r2.dev

// POST /api/visit-capture/upload-photo  (multipart/form-data)
// Fields: file (File), key (string), ref (string)
export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin');

  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY || !R2_SECRET_KEY) {
    return NextResponse.json({ error: 'R2 not configured' }, { status: 503, headers: corsHeaders(origin) });
  }

  let fd: FormData;
  try { fd = await req.formData(); }
  catch { return NextResponse.json({ error: 'Invalid form data' }, { status: 400, headers: corsHeaders(origin) }); }

  const file = fd.get('file');
  const key  = (fd.get('key')  as string | null)?.trim() ?? '';
  const ref  = (fd.get('ref')  as string | null)?.trim().toUpperCase() ?? '';

  if (!(file instanceof Blob) || !key || !ref) {
    return NextResponse.json({ error: 'Missing file, key, or ref' }, { status: 400, headers: corsHeaders(origin) });
  }

  const ext       = (file instanceof File ? file.name.split('.').pop() : '') || 'jpg';
  const objectKey = `merch-visits/${ref}/${key}-${Date.now()}.${ext}`;
  const endpoint  = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}/${objectKey}`;
  const mimeType  = file.type || 'image/jpeg';
  const body      = await file.arrayBuffer();

  try {
    await r2Put(endpoint, mimeType, body, R2_ACCESS_KEY, R2_SECRET_KEY);
  } catch (err) {
    console.error('[upload-photo] R2 PUT failed', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 502, headers: corsHeaders(origin) });
  }

  const publicUrl = R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/${objectKey}` : endpoint;
  return NextResponse.json({ url: publicUrl }, { headers: corsHeaders(origin) });
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: { ...corsHeaders(req.headers.get('origin')), 'Access-Control-Allow-Methods': 'POST, OPTIONS' },
  });
}

// ── AWS Signature v4 PUT (no SDK) ─────────────────────────────────────────────
async function r2Put(endpoint: string, contentType: string, body: ArrayBuffer, accessKey: string, secretKey: string) {
  const url     = new URL(endpoint);
  const now     = new Date();
  const date    = now.toISOString().slice(0, 10).replace(/-/g, '');          // YYYYMMDD
  const datetime= now.toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z'; // YYYYMMDDTHHmmssZ
  const region  = 'auto';
  const service = 's3';

  const bodyHash = await sha256hex(body);

  const canonHeaders =
    `content-type:${contentType}\n` +
    `host:${url.host}\n` +
    `x-amz-content-sha256:${bodyHash}\n` +
    `x-amz-date:${datetime}\n`;
  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';

  const canonReq = ['PUT', url.pathname, '', canonHeaders, signedHeaders, bodyHash].join('\n');
  const credScope = `${date}/${region}/${service}/aws4_request`;
  const strToSign = ['AWS4-HMAC-SHA256', datetime, credScope, await sha256hex(new TextEncoder().encode(canonReq))].join('\n');

  const sigKey  = await deriveKey(secretKey, date, region, service);
  const sig     = await hmacHex(sigKey, strToSign);
  const authHdr = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credScope},SignedHeaders=${signedHeaders},Signature=${sig}`;

  const res = await fetch(endpoint, {
    method: 'PUT',
    headers: {
      'Content-Type':          contentType,
      'x-amz-content-sha256':  bodyHash,
      'x-amz-date':            datetime,
      'Authorization':          authHdr,
    },
    body,
  });

  if (!res.ok) {
    throw new Error(`R2 PUT ${res.status}: ${await res.text()}`);
  }
}

async function sha256hex(data: ArrayBuffer | Uint8Array): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', data instanceof Uint8Array ? data.buffer as ArrayBuffer : data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hmacRaw(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const rawKey = key instanceof Uint8Array ? key.buffer as ArrayBuffer : key;
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
