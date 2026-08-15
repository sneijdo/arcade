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

export const storage: StorageAdapter = isSupabaseConfigured ? new SupabaseKvAdapter() : new LocalStorageAdapter();
