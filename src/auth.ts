import type { Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from './supabaseClient';

export function authAvailable(): boolean {
  return isSupabaseConfigured;
}

export async function getSession(): Promise<Session | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/** Fires on sign-in, sign-out, and magic-link redirect completion. Returns an unsubscribe fn. */
export function onAuthStateChange(cb: (event: string, session: Session | null) => void): () => void {
  if (!supabase) return () => {};
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((event, session) => cb(event, session));
  return () => subscription.unsubscribe();
}

export async function sendMagicLink(email: string): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Supabase er ikke konfigureret endnu.' };
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin },
  });
  return { error: error?.message ?? null };
}

export async function signOut(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut();
}
