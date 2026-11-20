import { createClient } from 'npm:@supabase/supabase-js@2';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-member-gate',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

export function getAdminClient() {
  const url = Deno.env.get('SUPABASE_URL');
  let secretKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const secretKeysJson = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (secretKeysJson) {
    try {
      const secretKeys = JSON.parse(secretKeysJson) as Record<string, string>;
      secretKey = secretKeys.default ?? secretKey;
    } catch {
      // Keep the legacy service-role variable as a fallback for local development.
    }
  }
  if (!url || !secretKey) throw new Error('Supabase server credentials are not configured.');
  return createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || request.headers.get('x-real-ip') || 'unknown';
}

export async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function identifierHash(value: string): Promise<string> {
  const salt = Deno.env.get('RATE_LIMIT_SALT');
  if (!salt) throw new Error('RATE_LIMIT_SALT is not configured.');
  return await sha256Hex(`${salt}|${value}`);
}

export async function enforceLimit(
  admin: ReturnType<typeof getAdminClient>,
  request: Request,
  scope: string,
  limit: number,
  windowSeconds: number,
  browserId = '',
): Promise<boolean> {
  const ipHash = await identifierHash(getClientIp(request));
  // Keep an IP-level ceiling even when a visitor clears or rotates their browser ID.
  // A higher IP allowance avoids punishing a whole school/network for one visitor's limit.
  const ipLimit = browserId ? limit * 10 : limit;
  const ipResult = await admin.rpc('consume_rate_limit', {
    p_bucket_key: `ip:${scope}:${ipHash}`,
    p_limit: ipLimit,
    p_window_seconds: windowSeconds,
  });
  if (ipResult.error) throw new Error('Rate limiting is temporarily unavailable.');
  if (!ipResult.data) return false;
  if (!browserId) return true;
  const browserHash = await identifierHash(browserId.slice(0, 256));
  const browserResult = await admin.rpc('consume_rate_limit', {
    p_bucket_key: `browser:${scope}:${browserHash}`,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (browserResult.error) throw new Error('Rate limiting is temporarily unavailable.');
  return Boolean(browserResult.data);
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - value.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function hmacKey(): Promise<CryptoKey> {
  const secret = Deno.env.get('GATE_TOKEN_SECRET');
  if (!secret || secret.length < 32) throw new Error('GATE_TOKEN_SECRET must contain at least 32 characters.');
  return await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function createGateToken(): Promise<string> {
  const header = toBase64Url(new TextEncoder().encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const now = Math.floor(Date.now() / 1000);
  const payload = toBase64Url(new TextEncoder().encode(JSON.stringify({ sub: 'project-member-gate', iat: now, exp: now + 28_800 })));
  const unsigned = `${header}.${payload}`;
  const signature = await crypto.subtle.sign('HMAC', await hmacKey(), new TextEncoder().encode(unsigned));
  return `${unsigned}.${toBase64Url(new Uint8Array(signature))}`;
}

export async function verifyGateToken(token: string): Promise<boolean> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const unsigned = `${parts[0]}.${parts[1]}`;
    const valid = await crypto.subtle.verify('HMAC', await hmacKey(), fromBase64Url(parts[2]), new TextEncoder().encode(unsigned));
    if (!valid) return false;
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(parts[1]))) as { sub?: string; exp?: number };
    return payload.sub === 'project-member-gate' && typeof payload.exp === 'number' && payload.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export function cleanString(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

export function isHttpsUrl(value: string): boolean {
  try { return new URL(value).protocol === 'https:'; } catch { return false; }
}
