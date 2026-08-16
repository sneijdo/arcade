import { storage } from './storage';
import { ACHIEVEMENTS } from './achievements';
import { GAMES } from './games/registry';
import { ScoreKinds } from './scoring';
import { XP_RULES } from './xp';
import { toast } from './toast';
import { Sound } from './sound';
import { refreshHeader } from './header';
import type { AchievementStats, HallOfFameEntry, LeaderboardEntry, PlayerMeta, Profile } from './types';
import { getTodayChallenge, meetsChallengeTarget } from './dailyChallenge';
import { findAvatar } from './shop';

export let profile: Profile | null = null;

export function initials(name: string): string {
  return (
    (name || '?')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase() || '?'
  );
}

/** What to render in an avatar slot — resolves the equipped avatar id (see shop.ts) to its emoji if set, else the classic initials fallback. Works on any {name, avatar} shape so leaderboard entries (not just Profile) can use it too. */
export function avatarContent(name: string, avatarId?: string | null): string {
  const def = findAvatar(avatarId);
  return def ? def.emoji : initials(name);
}

/** The single place `xp` ever increases — keeps `xpBalance` (spendable in the shop) in lockstep with `xp` (lifetime, used for level) without every award site needing to remember both. */
export function addXp(amount: number): void {
  if (!profile) return;
  profile.xp += amount;
  profile.xpBalance += amount;
}

function directionForGame(gameId: string): 'asc' | 'desc' {
  const game = GAMES.find((g) => g.id === gameId);
  const kind = game?.scoreKind ? ScoreKinds[game.scoreKind] : null;
  return kind?.direction ?? 'asc';
}

export async function loadProfile(): Promise<Profile | null> {
  const p = await storage.get<Profile>('profile', false);
  if (p) {
    if (!p.bestScores) p.bestScores = {};
    if (p.currentStreak == null) p.currentStreak = 0;
    if (p.longestStreak == null) p.longestStreak = 0;
    if (p.lastPlayedDate === undefined) p.lastPlayedDate = null;
    if (p.dailyChallengeDate === undefined) p.dailyChallengeDate = null;
    if (p.xpBalance == null) p.xpBalance = 0;
    if (!p.unlockedAvatars) p.unlockedAvatars = [];
    if (!p.unlockedTitles) p.unlockedTitles = [];
    if (p.equippedAvatar === undefined) p.equippedAvatar = null;
    if (p.equippedTitle === undefined) p.equippedTitle = null;
    if (p.hofCheckedThroughWeek === undefined) p.hofCheckedThroughWeek = null;
    profile = p;
  }
  return profile;
}

export async function saveProfile(): Promise<void> {
  if (!profile) return;
  await storage.set('profile', profile, false);
  // Mirror the public-facing identity fields to a shared record so leaderboard/Hall
  // of Fame rows can resolve a player's *current* avatar/title/name instead of a
  // stale snapshot from whenever they last posted a score (see getCombinedLeaderboard).
  const meta: PlayerMeta = { name: profile.name, avatar: profile.equippedAvatar, title: profile.equippedTitle };
  await storage.set('playerMeta:' + profile.id, meta, true);
}

export function clearProfile(): void {
  profile = null;
}

export function bestScoreForGame(gameId: string): number | null {
  if (!profile) return null;
  if (gameId === 'reaction') return profile.bestReaction;
  return profile.bestScores[gameId] ?? null;
}

export async function createProfile(name: string, id?: string): Promise<void> {
  profile = {
    id: id ?? (crypto.randomUUID ? crypto.randomUUID() : 'p-' + Date.now() + '-' + Math.random().toString(36).slice(2)),
    name: name.slice(0, 18),
    xp: 0,
    bestReaction: null,
    bestAvg: null,
    sessionsPlayed: 0,
    history: [],
    bestScores: {},
    unlockedAchievements: [],
    muted: false,
    currentStreak: 0,
    longestStreak: 0,
    lastPlayedDate: null,
    dailyChallengeDate: null,
    xpBalance: 0,
    unlockedAvatars: [],
    unlockedTitles: [],
    equippedAvatar: null,
    equippedTitle: null,
    hofCheckedThroughWeek: null,
  };
  await saveProfile();
}

const STREAK_MILESTONE_XP: Record<number, number> = { 3: 15, 7: 35, 14: 75, 30: 200 };

export function todayLocalDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** ISO-8601 week key (e.g. "2026-W33", Monday-start) — the leaderboard's weekly reset boundary. */
export function isoWeekKey(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7; // Mon=0..Sun=6
  date.setUTCDate(date.getUTCDate() - dayNum + 3); // nearest Thursday determines the ISO week/year
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const weekNum = 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000));
  return `${date.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

/**
 * Called once per finished session (see finishGameSession). No-ops if
 * today's session was already counted. Otherwise: consecutive day since
 * lastPlayedDate → streak+1, any gap (or first-ever session) → streak
 * resets to 1. Awards a one-time XP bonus + toast the moment the streak
 * newly reaches a milestone value.
 */
export async function updateStreak(): Promise<void> {
  if (!profile) return;
  const today = todayLocalDateString();
  if (profile.lastPlayedDate === today) return; // already counted today

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

  profile.currentStreak = profile.lastPlayedDate === yesterdayStr ? profile.currentStreak + 1 : 1;
  profile.lastPlayedDate = today;
  profile.longestStreak = Math.max(profile.longestStreak, profile.currentStreak);
  await saveProfile();

  const bonusXp = STREAK_MILESTONE_XP[profile.currentStreak];
  if (bonusXp) {
    addXp(bonusXp);
    await saveProfile();
    toast(`<span class="toast-icon">🔥</span> +${bonusXp} XP <span style="color:var(--text-dim)">— ${profile.currentStreak} dages stime</span>`, 'achievement');
    Sound.achievement();
  }
}

/**
 * Called once per finished session (see finishGameSession / reaction.ts).
 * No-ops unless this session's game+score actually satisfies today's
 * challenge AND it hasn't already been claimed today — so replaying the
 * same game after completing it doesn't re-award the bonus.
 */
export async function checkDailyChallenge(gameId: string, score: number): Promise<void> {
  if (!profile) return;
  const today = todayLocalDateString();
  if (profile.dailyChallengeDate === today) return; // already claimed today
  const challenge = getTodayChallenge(today);
  if (!challenge || challenge.gameId !== gameId) return;
  if (!meetsChallengeTarget(challenge, score)) return;

  profile.dailyChallengeDate = today;
  addXp(challenge.xpReward);
  await saveProfile();
  toast(`<span class="toast-icon">🎯</span> +${challenge.xpReward} XP <span style="color:var(--text-dim)">— Dagens udfordring gennemført</span>`, 'achievement');
  Sound.achievement();
}

/** Entries are keyed per ISO week, so a new week naturally starts empty — that IS the weekly reset, no cron/migration needed. Pre-existing (pre-weekly-key) entries keep matching the wider 'alltime' prefix below, so historical scores aren't lost, they just don't count for the current week until replayed. */
export async function pushLeaderboardEntry(gameId: string, score: number): Promise<void> {
  if (!profile) return;
  const week = isoWeekKey(new Date());
  await storage.set(
    `lb:${gameId}:${week}:` + profile.id,
    { name: profile.name, score, id: profile.id, avatar: profile.equippedAvatar, title: profile.equippedTitle },
    true,
  );
}

function lbPrefix(gameId: string, week: string | null): string {
  return week ? `lb:${gameId}:${week}:` : `lb:${gameId}:`;
}

async function readLeaderboard(gameId: string, week: string | null): Promise<LeaderboardEntry[]> {
  const keys = await storage.list(lbPrefix(gameId, week), true);
  const entries: LeaderboardEntry[] = [];
  for (const k of keys) {
    const r = await storage.get<LeaderboardEntry>(k, true);
    if (r) entries.push(r);
  }
  const dir = directionForGame(gameId);
  // dedupe by id keeping the best score for that game's direction
  const byId: Record<string, LeaderboardEntry> = {};
  for (const e of entries) {
    const existing = byId[e.id];
    if (!existing || (dir === 'asc' ? e.score < existing.score : e.score > existing.score)) byId[e.id] = e;
  }
  const combined = Object.values(byId);
  combined.sort((a, b) => (dir === 'asc' ? a.score - b.score : b.score - a.score));
  return combined;
}

export async function getCombinedLeaderboard(gameId: string, scope: 'week' | 'alltime' = 'week'): Promise<LeaderboardEntry[]> {
  const combined = await readLeaderboard(gameId, scope === 'week' ? isoWeekKey(new Date()) : null);
  // Overlay each player's live avatar/title/name so an equip change shows up
  // immediately instead of waiting for that player's next score push.
  await Promise.all(
    combined.map(async (e) => {
      const meta = await storage.get<PlayerMeta>('playerMeta:' + e.id, true);
      if (meta) {
        e.name = meta.name;
        e.avatar = meta.avatar;
        e.title = meta.title;
      }
    }),
  );
  return combined;
}

/**
 * Lazily credits *this* signed-in player's own Hall of Fame #1 finishes —
 * call whenever the Hall of Fame view is opened (or any time it's convenient;
 * cheap no-op once caught up). Walks backward from last week checking each
 * implemented game's #1 finisher, capped at 8 weeks back so a long-unused
 * app doesn't do unbounded work (older gaps are a known, accepted limitation
 * — a win that's never credited because the player never came back stays
 * uncredited).
 *
 * This is deliberately self-scoped rather than one client finalizing
 * everyone's wins: the `kv` table's RLS only allows a row to be written by
 * its own owner (see supabase/schema.sql), and `hof:<id>` is keyed by
 * *winner* id, not writer id — so only the winner's own client is ever
 * allowed to write it. `profile.hofCheckedThroughWeek` (a private field)
 * is this player's own "already checked up to here" bookmark, standing in
 * for what would otherwise need a shared cross-user marker.
 */
export async function creditMyHallOfFameWins(): Promise<void> {
  if (!profile) return;
  const implementedGameIds = GAMES.filter((g) => g.implemented).map((g) => g.id);
  const now = Date.now();
  let latestChecked = profile.hofCheckedThroughWeek;
  let hof: HallOfFameEntry | null = null;

  for (let weeksAgo = 1; weeksAgo <= 8; weeksAgo++) {
    const week = isoWeekKey(new Date(now - weeksAgo * 7 * 24 * 3600 * 1000));
    if (profile.hofCheckedThroughWeek != null && week <= profile.hofCheckedThroughWeek) break;
    for (const gameId of implementedGameIds) {
      const board = await readLeaderboard(gameId, week);
      if (board.length > 0 && board[0].id === profile.id) {
        if (!hof) hof = (await storage.get<HallOfFameEntry>('hof:' + profile.id, true)) ?? { id: profile.id, wins: {}, totalWins: 0 };
        hof.wins[gameId] = (hof.wins[gameId] ?? 0) + 1;
        hof.totalWins++;
      }
    }
    if (latestChecked == null || week > latestChecked) latestChecked = week;
  }

  if (latestChecked !== profile.hofCheckedThroughWeek) {
    profile.hofCheckedThroughWeek = latestChecked;
    await saveProfile();
  }
  if (hof) {
    await storage.set('hof:' + profile.id, hof, true);
    toast(`<span class="toast-icon">🏆</span> Du er kommet i Hall of Fame for en #1-placering!`, 'achievement');
    Sound.achievement();
  }
}

export async function getPlayerMeta(id: string): Promise<PlayerMeta | null> {
  return storage.get<PlayerMeta>('playerMeta:' + id, true);
}

export async function getHallOfFame(): Promise<HallOfFameEntry[]> {
  const keys = await storage.list('hof:', true);
  const entries: HallOfFameEntry[] = [];
  for (const k of keys) {
    const r = await storage.get<HallOfFameEntry>(k, true);
    if (r) entries.push(r);
  }
  entries.sort((a, b) => b.totalWins - a.totalWins);
  return entries;
}

export async function awardXP(amount: number, reasonLabel?: string): Promise<void> {
  if (!profile) return;
  addXp(amount);
  await saveProfile();
  refreshHeader();
  if (reasonLabel) {
    toast(`<span class="xp-icon">✦</span> +${amount} XP <span style="color:var(--text-dim)">— ${reasonLabel}</span>`);
  }
}

export async function checkAchievements(extra: Partial<AchievementStats> = {}): Promise<void> {
  if (!profile) return;
  const implementedGameIds = GAMES.filter((g) => g.implemented).map((g) => g.id);
  const ranks: Record<string, number | null> = {};
  for (const gameId of implementedGameIds) {
    const board = await getCombinedLeaderboard(gameId);
    const idx = board.findIndex((e) => e.id === profile!.id);
    ranks[gameId] = idx >= 0 ? idx + 1 : null;
  }
  const gamesPlayed = Object.keys(profile.bestScores).length + (profile.bestReaction != null ? 1 : 0);
  const statObj: AchievementStats = {
    bestReaction: profile.bestReaction,
    bestAvg: profile.bestAvg,
    sessionsPlayed: profile.sessionsPlayed,
    rank: ranks.reaction ?? null,
    bestScores: profile.bestScores,
    ranks,
    gamesPlayed,
    longestStreak: profile.longestStreak,
    unlockedAvatarsCount: profile.unlockedAvatars.length,
    unlockedTitlesCount: profile.unlockedTitles.length,
    ...extra,
  };
  let changed = false;
  for (const a of ACHIEVEMENTS) {
    if (!profile.unlockedAchievements.includes(a.id) && a.check(statObj)) {
      profile.unlockedAchievements.push(a.id);
      changed = true;
      Sound.achievement();
      toast(
        `<span class="toast-icon">${a.icon}</span><div><b>${a.title}</b><br><span style="color:var(--text-dim);font-size:11.5px">${a.desc}</span></div>`,
        'achievement',
      );
    }
  }
  if (changed) await saveProfile();
}

export interface SessionResult {
  isNewBest: boolean;
  xpGain: number;
  rank: number | null;
}

/**
 * Shared "session just ended" bookkeeping for every game besides reaction
 * (which predates this and keeps its own bespoke fields/flow): updates the
 * personal best, saves, pushes the leaderboard entry, awards XP (complete +
 * personal-best + top-3 bonuses, same XP_RULES reaction uses), and checks
 * achievements. One place to keep this consistent across games.
 */
export async function finishGameSession(gameId: string, score: number, extraAchievementStats?: Partial<AchievementStats>): Promise<SessionResult> {
  if (!profile) return { isNewBest: false, xpGain: 0, rank: null };
  const dir = directionForGame(gameId);
  const prevBest = profile.bestScores[gameId];
  const isNewBest = prevBest === undefined || (dir === 'asc' ? score < prevBest : score > prevBest);
  if (isNewBest) profile.bestScores[gameId] = score;
  profile.sessionsPlayed++;
  await saveProfile();
  await pushLeaderboardEntry(gameId, profile.bestScores[gameId]);

  let xpGain = XP_RULES.complete;
  if (isNewBest) xpGain += XP_RULES.personalBest;
  const board = await getCombinedLeaderboard(gameId);
  const rankIdx = board.findIndex((e) => e.id === profile!.id);
  const rank = rankIdx >= 0 ? rankIdx + 1 : null;
  if (rank && rank <= 3) xpGain += XP_RULES.top3;

  addXp(xpGain);
  await saveProfile();
  await updateStreak();
  await checkDailyChallenge(gameId, score);
  refreshHeader();
  await checkAchievements(extraAchievementStats);

  return { isNewBest, xpGain, rank };
}
