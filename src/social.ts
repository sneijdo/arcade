import { supabase, isSupabaseConfigured } from './supabaseClient';

export function socialAvailable(): boolean {
  return isSupabaseConfigured;
}

export interface PublicProfileHit {
  id: string;
  name: string;
}

export interface FriendEntry {
  friendshipId: string;
  userId: string;
  name: string;
}

/** Keeps the public {id, name} directory in sync — called once right after a profile is created. */
export async function syncPublicProfile(name: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('public_profiles').upsert({ name, updated_at: new Date().toISOString() });
  if (error) console.error('syncPublicProfile failed', error);
}

export async function searchProfiles(query: string, excludeId: string): Promise<PublicProfileHit[]> {
  if (!supabase || !query.trim()) return [];
  const { data, error } = await supabase.from('public_profiles').select('id, name').ilike('name', `%${query.trim()}%`).neq('id', excludeId).limit(12);
  if (error) {
    console.error('searchProfiles failed', error);
    return [];
  }
  return data ?? [];
}

export async function sendFriendRequest(addresseeId: string): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Ikke tilgængeligt.' };
  const { error } = await supabase.from('friendships').insert({ addressee_id: addresseeId });
  if (error) {
    if (error.code === '23505') return { error: 'Du har allerede sendt en anmodning til den her spiller.' };
    console.error('sendFriendRequest failed', error);
    return { error: 'Kunne ikke sende anmodning.' };
  }
  return { error: null };
}

export async function acceptFriendRequest(friendshipId: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId);
  if (error) console.error('acceptFriendRequest failed', error);
}

/** Also used to decline a pending request or unfriend an accepted one — same "remove the row" semantics. */
export async function removeFriendship(friendshipId: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('friendships').delete().eq('id', friendshipId);
  if (error) console.error('removeFriendship failed', error);
}

async function fetchNames(ids: string[]): Promise<Record<string, string>> {
  if (!supabase || ids.length === 0) return {};
  const { data, error } = await supabase.from('public_profiles').select('id, name').in('id', ids);
  if (error) {
    console.error('fetchNames failed', error);
    return {};
  }
  const map: Record<string, string> = {};
  (data ?? []).forEach((r) => {
    map[r.id] = r.name;
  });
  return map;
}

export async function listFriendsAndRequests(
  myId: string,
): Promise<{ friends: FriendEntry[]; incoming: FriendEntry[]; outgoing: FriendEntry[] }> {
  if (!supabase) return { friends: [], incoming: [], outgoing: [] };
  const { data, error } = await supabase
    .from('friendships')
    .select('id, requester_id, addressee_id, status')
    .or(`requester_id.eq.${myId},addressee_id.eq.${myId}`);
  if (error || !data) {
    if (error) console.error('listFriendsAndRequests failed', error);
    return { friends: [], incoming: [], outgoing: [] };
  }

  const otherIds = data.map((r) => (r.requester_id === myId ? r.addressee_id : r.requester_id));
  const namesById = await fetchNames(otherIds);

  const friends: FriendEntry[] = [];
  const incoming: FriendEntry[] = [];
  const outgoing: FriendEntry[] = [];
  for (const row of data) {
    const otherId = row.requester_id === myId ? row.addressee_id : row.requester_id;
    const entry: FriendEntry = { friendshipId: row.id, userId: otherId, name: namesById[otherId] ?? '???' };
    if (row.status === 'accepted') friends.push(entry);
    else if (row.addressee_id === myId) incoming.push(entry);
    else outgoing.push(entry);
  }
  return { friends, incoming, outgoing };
}
