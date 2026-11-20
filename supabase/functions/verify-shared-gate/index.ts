import { createGateToken, enforceLimit, getAdminClient, jsonResponse } from '../_shared/server.ts';

function fromHex(value: string): Uint8Array {
  if (!/^[0-9a-f]+$/i.test(value) || value.length % 2 !== 0) throw new Error('Invalid hash encoding.');
  return Uint8Array.from(value.match(/.{2}/g) ?? [], (byte) => Number.parseInt(byte, 16));
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, iterationText, saltHex, hashHex] = stored.split('$');
  if (scheme !== 'pbkdf2' || !iterationText || !saltHex || !hashHex) return false;
  const iterations = Number(iterationText);
  if (!Number.isInteger(iterations) || iterations < 100_000 || iterations > 1_000_000) return false;
  const salt = fromHex(saltHex);
  const expected = fromHex(hashHex);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, key, expected.length * 8);
  return constantTimeEqual(new Uint8Array(bits), expected);
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' } });
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);
  try {
    const admin = getAdminClient();
    if (!await enforceLimit(admin, request, 'shared-gate', 5, 900)) return jsonResponse({ error: 'Too many attempts. Please try again later.' }, 429);
    const body = await request.json() as { password?: unknown };
    const password = typeof body.password === 'string' ? body.password : '';
    if (password.length < 1 || password.length > 256) return jsonResponse({ error: 'Enter the shared website password.' }, 400);
    const storedHash = Deno.env.get('SHARED_PASSWORD_HASH') ?? '';
    if (!storedHash) return jsonResponse({ error: 'Shared-password security is not configured yet.' }, 503);
    if (!await verifyPassword(password, storedHash)) return jsonResponse({ error: 'The shared website password was not accepted.' }, 401);
    return jsonResponse({ gate_token: await createGateToken(), expires_in: 28800 });
  } catch (error) {
    console.error('verify-shared-gate error:', error);
    return jsonResponse({ error: 'Verification is temporarily unavailable. Please retry.' }, 500);
  }
});
