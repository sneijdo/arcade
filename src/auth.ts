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

/** Fires on sign-in, sign-out, and initial session restore. Returns an unsubscribe fn. */
export function onAuthStateChange(cb: (event: string, session: Session | null) => void): () => void {
  if (!supabase) return () => {};
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((event, session) => cb(event, session));
  return () => subscription.unsubscribe();
}

/**
 * Supabase Auth is email-based under the hood, but this app wants plain
 * username/password with zero email round-trips (no SMTP, no rate limits,
 * no "check your inbox" friction). We deterministically derive a synthetic,
 * undeliverable email from the username and use that as the Supabase
 * identity — usernames get uniqueness enforcement for free via Supabase's
 * existing unique-email constraint. Requires "Confirm email" to be
 * disabled in the Supabase dashboard (Authentication → Providers → Email),
 * since these addresses can never actually receive a confirmation mail.
 */
const USERNAME_DOMAIN = '@players.arcade.internal';

export interface UsernameValidation {
  valid: boolean;
  error?: string;
}

export function validateUsername(username: string): UsernameValidation {
  const trimmed = username.trim();
  if (trimmed.length < 3) return { valid: false, error: 'Brugernavn skal være mindst 3 tegn.' };
  if (trimmed.length > 18) return { valid: false, error: 'Brugernavn må højst være 18 tegn.' };
  if (!/^[a-zA-Z0-9_æøåÆØÅ]+$/.test(trimmed)) return { valid: false, error: 'Kun bogstaver, tal og underscore er tilladt.' };
  return { valid: true };
}

function usernameToEmail(username: string): string {
  const slug = username
    .trim()
    .toLowerCase()
    .replace(/[æå]/g, 'a')
    .replace(/ø/g, 'o')
    .replace(/[^a-z0-9_]/g, '');
  return `${slug}${USERNAME_DOMAIN}`;
}

function translateAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('already registered') || m.includes('already exists')) return 'Det brugernavn er allerede taget.';
  if (m.includes('invalid login credentials')) return 'Forkert brugernavn eller adgangskode.';
  if (m.includes('password') && (m.includes('at least') || m.includes('should be'))) return 'Adgangskoden er for kort, mindst 6 tegn.';
  if (m.includes('rate limit')) return 'For mange forsøg, vent et øjeblik og prøv igen.';
  return 'Der gik noget galt. Prøv igen.';
}

export async function signUpWithUsername(username: string, password: string): Promise<{ error: string | null; userId: string | null }> {
  if (!supabase) return { error: 'Supabase er ikke konfigureret endnu.', userId: null };
  const { data, error } = await supabase.auth.signUp({ email: usernameToEmail(username), password });
  if (error) return { error: translateAuthError(error.message), userId: null };
  if (!data.session) {
    // Signed up but no active session — "Confirm email" is still enabled in the
    // Supabase dashboard, which this flow can't satisfy (the email is fake).
    return { error: 'Kontoen kunne ikke logges ind automatisk. Kontakt administratoren (email-bekræftelse skal slås fra i Supabase).', userId: null };
  }
  return { error: null, userId: data.user?.id ?? null };
}

export async function signInWithUsername(username: string, password: string): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Supabase er ikke konfigureret endnu.' };
  const { error } = await supabase.auth.signInWithPassword({ email: usernameToEmail(username), password });
  return { error: error ? translateAuthError(error.message) : null };
}

export async function signOut(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut();
}

/** Unambiguous alphabet — no 0/O/1/I/l — so a hand-copied or hand-typed code doesn't fail from a misread character. */
const RECOVERY_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generateRecoveryCode(): string {
  let code = '';
  for (let i = 0; i < 10; i++) {
    if (i === 5) code += '-';
    code += RECOVERY_CODE_ALPHABET[Math.floor(Math.random() * RECOVERY_CODE_ALPHABET.length)];
  }
  return code;
}

/** Requires an active session — call right after signup, and again after a successful redeemRecoveryCode() so the user always has a fresh, unused code. */
export async function setRecoveryCode(code: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.rpc('set_recovery_code', { p_code: code });
  if (error) {
    console.error('setRecoveryCode failed', error);
    return false;
  }
  return true;
}

/** The logged-out "forgot password" path — see schema_recovery.sql for what this actually does server-side. */
export async function redeemRecoveryCode(username: string, code: string, newPassword: string): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Ikke tilgængeligt.' };
  const { data, error } = await supabase.rpc('redeem_recovery_code', {
    p_username: username,
    p_code: code,
    p_new_password: newPassword,
  });
  if (error) return { error: translateAuthError(error.message) };
  if (!data) return { error: 'Forkert brugernavn eller gendannelseskode.' };
  return { error: null };
}

/** Requires an active session — used by the "change password" section in Profile. */
export async function changePassword(newPassword: string): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Ikke tilgængeligt.' };
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  return { error: error ? translateAuthError(error.message) : null };
}
