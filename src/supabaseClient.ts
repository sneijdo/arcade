import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** Present only once VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY are set. Everything else
 * (storage adapter choice, auth gate) branches on this so local dev works with plain
 * localStorage before Supabase is configured, and switches over automatically once it is. */
export const supabase: SupabaseClient | null = url && anonKey ? createClient(url, anonKey) : null;

export const isSupabaseConfigured = supabase !== null;
