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

export async function publicFunction<T>(body: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new Error('The online services are not configured yet.');
  const { data, error } = await supabase.functions.invoke('public-api', { body });
  if (error) throw new Error(error.message || 'The service could not be reached.');
  return data as T;
}

export async function gateFunction<T>(body: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new Error('Member access becomes available after setup.');
  const { data, error } = await supabase.functions.invoke('verify-shared-gate', { body });
  if (error) throw new Error(error.message || 'The shared password could not be verified.');
  return data as T;
}

export async function memberFunction<T>(body: Record<string, unknown>, gateToken: string): Promise<T> {
  if (!supabase) throw new Error('Member services are not configured yet.');
  const { data, error } = await supabase.functions.invoke('member-api', {
    body,
    headers: { 'x-member-gate': gateToken },
  });
  if (error) throw new Error(error.message || 'The member service could not be reached.');
  return data as T;
}
