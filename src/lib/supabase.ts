import { createClient } from '@supabase/supabase-js';
import { env, hasSupabaseConfig } from './config';

export const supabase = hasSupabaseConfig
  ? createClient(env.supabaseUrl, env.supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

type FunctionErrorLike = { message?: string; context?: unknown };

async function safeFunctionError(error: FunctionErrorLike, fallback: string): Promise<Error> {
  const context = error.context;
  if (typeof Response !== 'undefined' && context instanceof Response) {
    const status = context.status;
    try {
      const payload = await context.clone().json() as { error?: unknown; message?: unknown };
      if (typeof payload.error === 'string' && payload.error.trim()) return new Error(payload.error);
      if (typeof payload.message === 'string' && payload.message.trim()) return new Error(payload.message);
    } catch {
      // Do not expose raw transport exceptions or non-JSON response bodies to members.
    }
    if (status === 429) return new Error('RATE_LIMITED');
    if (status === 401) return new Error('ACCESS_SESSION_EXPIRED');
    if (status >= 500) return new Error(fallback);
  }
  return new Error(fallback);
}

export async function publicFunction<T>(body: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new Error('The online services are not configured yet.');
  const { data, error } = await supabase.functions.invoke('public-api', { body });
  if (error) throw await safeFunctionError(error, 'A project service is temporarily unavailable.');
  return data as T;
}

export async function gateFunction<T>(body: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new Error('Member access becomes available after setup.');
  const { data, error } = await supabase.functions.invoke('verify-shared-gate', { body });
  if (error) {
    const safeError = await safeFunctionError(error, 'SHARED_GATE_UNAVAILABLE');
    // The shared-gate endpoint uses 401 specifically for an invalid shared password.
    if (safeError.message === 'ACCESS_SESSION_EXPIRED') throw new Error('SHARED_PASSWORD_NOT_ACCEPTED');
    throw safeError;
  }
  return data as T;
}

export async function memberFunction<T>(body: Record<string, unknown>, gateToken: string): Promise<T> {
  if (!supabase) throw new Error('Member services are not configured yet.');
  const { data, error } = await supabase.functions.invoke('member-api', {
    body,
    headers: { 'x-member-gate': gateToken },
  });
  if (error) throw await safeFunctionError(error, 'MEMBER_SERVICE_UNAVAILABLE');
  return data as T;
}
