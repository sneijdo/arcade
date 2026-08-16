import { supabase } from '../supabaseClient';
import { isGuestMode } from '../storage';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { PresenceUser } from '../activity';

/**
 * Invite lifecycle for Quiz Duel, backed by the `duel_challenges` table
 * (see supabase/schema_duels.sql) — same "typed row mapper + Realtime subscription"
 * shape as activity.ts, but two-party (both sender and recipient can read/update a
 * row they're part of) rather than owner-only.
 */

export type DuelStatus = 'pending' | 'accepted' | 'declined' | 'expired' | 'cancelled' | 'completed';
export type DuelResult = 'sender_win' | 'recipient_win' | 'draw';

export interface DuelChallenge {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar: string | null;
  senderFrame: string | null;
  recipientId: string;
  status: DuelStatus;
  result: DuelResult | null;
  createdAt: string;
}

function rowToChallenge(row: Record<string, unknown>): DuelChallenge {
  return {
    id: row.id as string,
    senderId: row.sender_id as string,
    senderName: row.sender_name as string,
    senderAvatar: (row.sender_avatar as string | null) ?? null,
    senderFrame: (row.sender_frame as string | null) ?? null,
    recipientId: row.recipient_id as string,
    status: row.status as DuelStatus,
    result: (row.result as DuelResult | null) ?? null,
    createdAt: row.created_at as string,
  };
}

export async function sendChallenge(senderName: string, senderAvatar: string | null, senderFrame: string | null, recipient: PresenceUser): Promise<DuelChallenge | null> {
  if (!supabase || isGuestMode()) return null;
  const { data, error } = await supabase
    .from('duel_challenges')
    .insert({ sender_name: senderName, sender_avatar: senderAvatar, sender_frame: senderFrame, recipient_id: recipient.id })
    .select()
    .single();
  if (error || !data) {
    console.error('duel challenge send failed', error);
    return null;
  }
  return rowToChallenge(data);
}

export async function respondToChallenge(id: string, status: 'accepted' | 'declined'): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('duel_challenges').update({ status, responded_at: new Date().toISOString() }).eq('id', id);
  if (error) console.error('duel challenge respond failed', error);
}

export async function cancelChallenge(id: string): Promise<void> {
  if (!supabase) return;
  await supabase.from('duel_challenges').update({ status: 'cancelled' }).eq('id', id);
}

/** Only actually expires a still-pending row — guards against overwriting a response
 * the recipient sent in the same instant the sender's own 20s timer fired. */
export async function expireChallenge(id: string): Promise<void> {
  if (!supabase) return;
  await supabase.from('duel_challenges').update({ status: 'expired' }).eq('id', id).eq('status', 'pending');
}

export async function fetchChallenge(id: string): Promise<DuelChallenge | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('duel_challenges').select('*').eq('id', id).maybeSingle();
  if (error || !data) return null;
  return rowToChallenge(data);
}

export async function writeDuelResult(id: string, result: DuelResult): Promise<void> {
  if (!supabase) return;
  await supabase.from('duel_challenges').update({ status: 'completed', result, completed_at: new Date().toISOString() }).eq('id', id);
}

let incomingChannel: RealtimeChannel | null = null;
const incomingListeners = new Set<(invite: DuelChallenge) => void>();
const outgoingListeners = new Set<(invite: DuelChallenge) => void>();

/** Called once at boot (main.ts), next to startPresence — live app-wide, not just on
 * the Activity page. Two separate subscriptions rather than one: postgres_changes
 * filters are single-column, so "rows where I'm the recipient" and "rows where I'm
 * the sender" can't be expressed as a single OR'd filter the way subscribeActivity's
 * unfiltered feed subscription doesn't need to worry about. */
export function startInviteListener(myId: string): void {
  if (!supabase || isGuestMode() || incomingChannel) return;
  const client = supabase;
  incomingChannel = client
    .channel('duel-incoming-' + myId)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'duel_challenges', filter: `recipient_id=eq.${myId}` }, (payload) => {
      if (payload.eventType === 'DELETE') return;
      const c = rowToChallenge(payload.new as Record<string, unknown>);
      incomingListeners.forEach((fn) => fn(c));
    })
    .subscribe();
  client
    .channel('duel-outgoing-' + myId)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'duel_challenges', filter: `sender_id=eq.${myId}` }, (payload) => {
      if (payload.eventType === 'DELETE') return;
      const c = rowToChallenge(payload.new as Record<string, unknown>);
      outgoingListeners.forEach((fn) => fn(c));
    })
    .subscribe();
}

/** Fires for every INSERT/UPDATE on a challenge where I'm the recipient — including my
 * own sendChallenge()'s insert echoing back is impossible here since this is scoped to
 * MY incoming invites, not outgoing ones. Returns an unsubscribe function. */
export function onIncomingInvite(cb: (invite: DuelChallenge) => void): () => void {
  incomingListeners.add(cb);
  return () => incomingListeners.delete(cb);
}

/** Fires for every INSERT/UPDATE on a challenge I sent — including the initial INSERT
 * from my own sendChallenge() call, so a listener mounted before sendChallenge() resolves
 * still sees it. Returns an unsubscribe function. */
export function onOutgoingInviteUpdate(cb: (invite: DuelChallenge) => void): () => void {
  outgoingListeners.add(cb);
  return () => outgoingListeners.delete(cb);
}
