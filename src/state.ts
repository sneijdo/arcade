import { storage } from './storage';
import { ACHIEVEMENTS } from './achievements';
import { GAMES } from './games/registry';
import { ScoreKinds } from './scoring';
import { XP_RULES } from './xp';
import { toast } from './toast';
import { Sound } from './sound';
import { refreshHeader } from './header';
import type { AchievementStats, LeaderboardEntry, Profile } from './types';
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
    profile = p;
  }
  return profile;
}

export async function saveProfile(): Promise<void> {
  if (!profile) return;
  await storage.set('profile', profile, false);
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
  };
  await saveProfile();
}

const STREAK_MILESTONE_XP: Record<number, number> = { 3: 30, 7: 75, 14: 150, 30: 400 };

export function todayLocalDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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

export async function pushLeaderboardEntry(gameId: string, score: number): Promise<void> {
  if (!profile) return;
  await storage.set(
    `lb:${gameId}:` + profile.id,
    { name: profile.name, score, id: profile.id, avatar: profile.equippedAvatar, title: profile.equippedTitle },
    true,
  );
}

export async function getCombinedLeaderboard(gameId: string): Promise<LeaderboardEntry[]> {
  const keys = await storage.list(`lb:${gameId}:`, true);
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
