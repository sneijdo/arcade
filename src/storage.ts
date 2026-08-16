import { supabase, isSupabaseConfigured } from './supabaseClient';

/**
 * Storage abstraction. Every caller only ever talks to this interface,
 * never to localStorage or Supabase directly — that's what let the backend
 * swap below happen without touching state.ts or any page/game module.
 *
 * `shared` distinguishes data meant to be visible to other players
 * (leaderboard entries) from private per-user data (profile, settings).
 */
export interface StorageAdapter {
  get<T>(key: string, shared?: boolean): Promise<T | null>;
  set<T>(key: string, value: T, shared?: boolean): Promise<boolean>;
  list(prefix: string, shared?: boolean): Promise<string[]>;
  remove(key: string, shared?: boolean): Promise<void>;
}

const PRIVATE_NS = 'arcade:private:';
const SHARED_NS = 'arcade:shared:';

function namespacedKey(key: string, shared: boolean): string {
  return (shared ? SHARED_NS : PRIVATE_NS) + key;
}

class LocalStorageAdapter implements StorageAdapter {
  async get<T>(key: string, shared = false): Promise<T | null> {
    try {
      const raw = localStorage.getItem(namespacedKey(key, shared));
      return raw ? (JSON.parse(raw) as T) : null;
    } catch (e) {
      console.error('storage get failed', e);
      return null;
    }
  }

  async set<T>(key: string, value: T, shared = false): Promise<boolean> {
    try {
      localStorage.setItem(namespacedKey(key, shared), JSON.stringify(value));
      return true;
    } catch (e) {
      console.error('storage set failed', e);
      return false;
    }
  }

  async list(prefix: string, shared = false): Promise<string[]> {
    try {
      const nsPrefix = namespacedKey(prefix, shared);
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(nsPrefix)) {
          keys.push(k.slice((shared ? SHARED_NS : PRIVATE_NS).length));
        }
      }
      return keys;
    } catch (e) {
      console.error('storage list failed', e);
      return [];
    }
  }

  async remove(key: string, shared = false): Promise<void> {
    try {
      localStorage.removeItem(namespacedKey(key, shared));
    } catch (e) {
      console.error('storage remove failed', e);
    }
  }
}

/**
 * Backed by a single generic `kv` table in Postgres (see supabase/schema.sql):
 * owner_id defaults to auth.uid() at the database level, so this adapter
 * never needs to know who's signed in — Row Level Security does the rest
 * (own rows always readable/writable; shared=true rows readable by everyone).
 */
class SupabaseKvAdapter implements StorageAdapter {
  async get<T>(key: string, shared = false): Promise<T | null> {
    if (!supabase) return null;
    const { data, error } = await supabase.from('kv').select('value').eq('key', key).eq('shared', shared).maybeSingle();
    if (error) {
      console.error('storage get failed', error);
      return null;
    }
    return data ? ((data.value as unknown) as T) : null;
  }

  async set<T>(key: string, value: T, shared = false): Promise<boolean> {
    if (!supabase) return false;
    const { error } = await supabase
      .from('kv')
      .upsert({ key, shared, value: value as unknown, updated_at: new Date().toISOString() }, { onConflict: 'owner_id,shared,key' });
    if (error) {
      console.error('storage set failed', error);
      return false;
    }
    return true;
  }

  async list(prefix: string, shared = false): Promise<string[]> {
    if (!supabase) return [];
    const escapedPrefix = prefix.replace(/[%_]/g, (m) => '\\' + m);
    const { data, error } = await supabase.from('kv').select('key').eq('shared', shared).like('key', `${escapedPrefix}%`);
    if (error) {
      console.error('storage list failed', error);
      return [];
    }
    return (data ?? []).map((row) => row.key as string);
  }

  async remove(key: string, shared = false): Promise<void> {
    if (!supabase) return;
    const { error } = await supabase.from('kv').delete().eq('key', key).eq('shared', shared);
    if (error) console.error('storage remove failed', error);
  }
}

let activeAdapter: StorageAdapter = isSupabaseConfigured ? new SupabaseKvAdapter() : new LocalStorageAdapter();
let guestMode = false;

/**
 * Switches persistence to the device-local adapter for the rest of this session — used by the
 * "play as guest" flow (see onboarding.ts) so a new visitor can start playing immediately
 * without creating a Supabase account first. `storage` below is a stable object that always
 * delegates to whichever adapter is currently active, so every existing call site (state.ts,
 * merge.ts's autosave, tactical/meta.ts, etc.) keeps working unchanged regardless of which mode
 * is active — nothing needs to know or care.
 */
export function useLocalGuestStorage(): void {
  activeAdapter = new LocalStorageAdapter();
  guestMode = true;
}

/** True only once a Supabase-configured deployment has explicitly switched to guest mode — not true for a dev/local-only deployment, which has no account path to upgrade to anyway. */
export function isGuestMode(): boolean {
  return guestMode;
}

/** Switches back to the Supabase adapter — used when a guest creates a real account mid-session. Safe to call even if already on Supabase (harmless no-op re-creation of the adapter). */
export function useSupabaseStorage(): void {
  activeAdapter = new SupabaseKvAdapter();
  guestMode = false;
}

/** Detects a guest profile left over from a previous visit, straight from localStorage — checked at boot, before any adapter is chosen, so a returning guest resumes locally instead of hitting the signup wall again every reload. */
export function hasLocalGuestProfile(): boolean {
  try {
    return localStorage.getItem(namespacedKey('profile', false)) != null;
  } catch {
    return false;
  }
}

/** Clears a leftover local guest profile once its owner has created a real account, so a future reload doesn't keep detecting it and resuming guest mode instead of the new account. */
export function clearLocalGuestProfile(): void {
  try {
    localStorage.removeItem(namespacedKey('profile', false));
  } catch {
    // best-effort — a leftover guest profile just means one more local-storage check next boot
  }
}

export const storage: StorageAdapter = {
  // Method shorthand (not arrow-function properties) so each method's own <T> stays generic —
  // an arrow property here would collapse T to unknown instead of flowing through to callers.
  get<T>(key: string, shared?: boolean): Promise<T | null> {
    return activeAdapter.get<T>(key, shared);
  },
  set<T>(key: string, value: T, shared?: boolean): Promise<boolean> {
    return activeAdapter.set<T>(key, value, shared);
  },
  list(prefix: string, shared?: boolean): Promise<string[]> {
    return activeAdapter.list(prefix, shared);
  },
  remove(key: string, shared?: boolean): Promise<void> {
    return activeAdapter.remove(key, shared);
  },
};
