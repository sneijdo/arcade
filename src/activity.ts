import { supabase } from './supabaseClient';
import { isGuestMode } from './storage';
import type { RealtimeChannel } from '@supabase/supabase-js';

/**
 * Live "what's happening right now" feed, backed by the append-only
 * `activity` table (see supabase/schema_activity.sql) plus a Realtime
 * presence channel — deliberately separate from state.ts's leaderboard
 * plumbing, which only ever holds *current best* per player+game+week and
 * has no notion of "just now" or "who's online."
 *
 * Guests never appear here and never see live data (no Supabase session to
 * subscribe with), matching how they're already excluded from the shared
 * leaderboard elsewhere in the app.
 */

export interface ActivityEntry {
  id: number;
  ownerId: string;
  kind: 'session' | 'personal_best' | 'duel_result';
  gameId: string;
  score: number;
  name: string;
  avatar: string | null;
  frame: string | null;
  createdAt: string;
  /** Only set on 'duel_result' rows — the opponent's name, so the feed can render a full sentence without joining anything (see finishDuelSession in state.ts). */
  opponentName: string | null;
  /** Snapshot of the equipped name-effect id at push time — see NAME_EFFECTS in shop.ts. */
  nameEffect: string | null;
  /** A TAUNTS id (see shop.ts) — only set on the specific session that took over a game's
   * all-time #1 spot or won a duel, and only if the player had one equipped. Resolved to display
   * text via findTaunt() at render time (see activityRowHtml in pages/activity.ts). */
  taunt: string | null;
}

export interface PresenceUser {
  id: string;
  name: string;
  avatar: string | null;
}

function rowToEntry(row: Record<string, unknown>): ActivityEntry {
  return {
    id: row.id as number,
    ownerId: row.owner_id as string,
    kind: row.kind as ActivityEntry['kind'],
    gameId: row.game_id as string,
    score: Number(row.score),
    name: row.name as string,
    avatar: (row.avatar as string | null) ?? null,
    frame: (row.frame as string | null) ?? null,
    createdAt: row.created_at as string,
    opponentName: (row.opponent_name as string | null) ?? null,
    nameEffect: (row.name_effect as string | null) ?? null,
    taunt: (row.taunt as string | null) ?? null,
  };
}

/** Fire-and-forget: records that a session just finished, for the live Activity page.
 * Never awaited by a caller mid-result-screen — same "don't block on non-essential
 * writes" reasoning as settleSessionExtras() in state.ts. */
export async function pushActivity(
  gameId: string,
  score: number,
  kind: 'session' | 'personal_best' | 'duel_result',
  name: string,
  avatar: string | null,
  frame: string | null,
  opponentName: string | null = null,
  nameEffect: string | null = null,
  taunt: string | null = null,
): Promise<void> {
  if (!supabase || isGuestMode()) return;
  const { error } = await supabase
    .from('activity')
    .insert({ kind, game_id: gameId, score, name, avatar, frame, opponent_name: opponentName, name_effect: nameEffect, taunt });
  if (error) console.error('activity push failed', error);
}

export async function fetchRecentActivity(limit = 30): Promise<ActivityEntry[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('activity').select('*').order('created_at', { ascending: false }).limit(limit);
  if (error) {
    console.error('activity fetch failed', error);
    return [];
  }
  return (data ?? []).map(rowToEntry);
}

/** Returns an unsubscribe function. Caller is expected to stop calling it once its
 * own DOM is gone rather than unsubscribing eagerly on navigation — see the
 * DOM-presence check used by the Activity page itself, matching the pattern
 * snake.ts/reaction.ts already use for their tick/round timers. */
export function subscribeActivity(onInsert: (entry: ActivityEntry) => void): () => void {
  if (!supabase) return () => {};
  const client = supabase;
  const channel = client
    .channel('activity-feed')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity' }, (payload) => {
      onInsert(rowToEntry(payload.new as Record<string, unknown>));
    })
    .subscribe();
  return () => client.removeChannel(channel);
}

const PRESENCE_TOPIC = 'arcade-presence';
let presenceChannel: RealtimeChannel | null = null;
const presenceListeners = new Set<(users: PresenceUser[]) => void>();

function currentPresenceUsers(): PresenceUser[] {
  if (!presenceChannel) return [];
  // presenceState()'s outer object is keyed by the presence key each client tracked
  // under — id, per startPresence() below — which the tracked payload itself doesn't
  // repeat, so the id has to come from here rather than from `e`.
  const state = presenceChannel.presenceState<{ name: string; avatar: string | null }>();
  return Object.entries(state).flatMap(([id, entries]) => entries.map((e) => ({ id, name: e.name, avatar: e.avatar ?? null })));
}

/** Joins the shared presence channel once per app session — call at boot, right after
 * a real (non-guest) profile is known. Leaving is automatic: the Realtime SDK drops
 * this client's presence the moment its socket disconnects (tab close/navigation away
 * from the site), no explicit beforeunload handling needed.
 *
 * Note: the tracked name/avatar snapshot is taken once at join time — renaming or
 * re-equipping mid-session won't update it here until the next reload. Not worth the
 * extra plumbing for a same-session-only presence list. */
export function startPresence(id: string, name: string, avatar: string | null): void {
  if (!supabase || isGuestMode() || presenceChannel) return;
  const channel = supabase.channel(PRESENCE_TOPIC, { config: { presence: { key: id } } });
  channel.on('presence', { event: 'sync' }, () => {
    const users = currentPresenceUsers();
    presenceListeners.forEach((fn) => fn(users));
  });
  channel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') await channel.track({ name, avatar });
  });
  presenceChannel = channel;
}

/** Returns an unsubscribe function. Safe to call repeatedly (e.g. revisiting the
 * Activity page) — listeners are deduped in a Set and removed on unsubscribe. */
export function onPresenceChange(cb: (users: PresenceUser[]) => void): () => void {
  presenceListeners.add(cb);
  cb(currentPresenceUsers());
  return () => presenceListeners.delete(cb);
}
