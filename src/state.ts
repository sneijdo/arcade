import { storage } from './storage';
import { ACHIEVEMENTS } from './achievements';
import { BADGES } from './badges';
import { GAMES } from './games/registry';
import { ScoreKinds } from './scoring';
import { XP_RULES, levelInfo } from './xp';
import { toast } from './toast';
import { pushActivity } from './activity';
import { Sound } from './sound';
import { refreshHeader } from './header';
import type { AchievementStats, HallOfFameEntry, LeaderboardEntry, PlayerMeta, Profile } from './types';
import { getTodayChallenge, meetsChallengeTarget } from './dailyChallenge';
import { findAvatar, findFrame, AVATARS, FRAMES, TITLES } from './shop';

export let profile: Profile | null = null;

const ESCAPE_MAP: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
/** Player names (guest or real) are never validated as strictly as the real signup username
 * (see validateUsername in auth.ts) and end up interpolated directly into innerHTML template
 * strings all over the app (profile, leaderboard, Hall of Fame) — escape at every one of those
 * render boundaries rather than trusting upstream validation to catch every path a name can
 * be set through. */
export function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (c) => ESCAPE_MAP[c]);
}

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

/** What to render in an avatar slot — resolves the equipped avatar id (see shop.ts) to its art if set, else the classic initials fallback. Works on any {name, avatar} shape so leaderboard entries (not just Profile) can use it too. Callers just interpolate the returned string as HTML, so swapping emoji text for an <img> here needed no call-site changes. */
export function avatarContent(name: string, avatarId?: string | null): string {
  const def = findAvatar(avatarId);
  return def ? `<img src="${def.asset}" alt="${def.name}" class="avatar-img" draggable="false">` : initials(name);
}

/**
 * Avatar + equipped frame, composited into a square wrapper sized to `sizePx`. Frames (116×116)
 * don't share avatars' aspect ratio (130×140) or shape (some square, some circular in the source
 * art), so the avatar is object-fit:cover'd to fill the square and the frame — which already
 * carries its own transparent cutout — sits on top at 100%. Used everywhere an avatar is shown
 * so equipped frames render consistently (header, profile, leaderboard, Hall of Fame).
 */
export function avatarFrameHtml(name: string, avatarId: string | null | undefined, frameId: string | null | undefined, sizePx: number): string {
  const frame = findFrame(frameId);
  const inner = avatarContent(name, avatarId);
  return `
    <div class="avatar-frame-wrap" style="width:${sizePx}px;height:${sizePx}px;font-size:${Math.round(sizePx * 0.4)}px">
      <div class="avatar-frame-inner">${inner}</div>
      ${frame ? `<img src="${frame.asset}" alt="${frame.name}" class="avatar-frame-overlay" draggable="false">` : ''}
    </div>
  `;
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
    if (!p.unlockedFrames) p.unlockedFrames = [];
    if (p.equippedFrame === undefined) p.equippedFrame = null;
    if (!p.unlockedBadges) p.unlockedBadges = [];
    if (p.duelWins == null) p.duelWins = 0;
    if (p.duelLosses == null) p.duelLosses = 0;
    if (p.duelDraws == null) p.duelDraws = 0;
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
  const meta: PlayerMeta = {
    name: profile.name,
    avatar: profile.equippedAvatar,
    title: profile.equippedTitle,
    frame: profile.equippedFrame,
    xp: profile.xp,
    bestReaction: profile.bestReaction,
    bestScores: profile.bestScores,
    sessionsPlayed: profile.sessionsPlayed,
    currentStreak: profile.currentStreak,
    longestStreak: profile.longestStreak,
    unlockedAchievements: profile.unlockedAchievements,
    unlockedBadges: profile.unlockedBadges,
    duelWins: profile.duelWins,
    duelLosses: profile.duelLosses,
    duelDraws: profile.duelDraws,
  };
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
    unlockedFrames: [],
    equippedFrame: null,
    unlockedBadges: [],
    duelWins: 0,
    duelLosses: 0,
    duelDraws: 0,
  };
  await saveProfile();
}

/** Halved along with XP_RULES (was 3:15, 7:35, 14:75, 30:200). */
const STREAK_MILESTONE_XP: Record<number, number> = { 3: 8, 7: 18, 14: 38, 30: 100 };

export function todayLocalDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Sunday-start week key (e.g. "2026-08-16", the date of that week's Sunday) — the leaderboard's
 * weekly reset boundary. A new week starts every Sunday, which is also when a fresh shot at a
 * legendary slot opens up. Plain calendar-date strings sort lexicographically in chronological
 * order, same as the ISO-week strings this replaced, so every caller that compares week keys as
 * strings keeps working unchanged. */
export function weekKey(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() - date.getUTCDay()); // back up to that week's Sunday (UTC day 0)
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
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

/** Entries are keyed per week (Sunday-start, see weekKey()), so a new week naturally starts empty — that IS the weekly reset, no cron/migration needed. Pre-existing (pre-weekly-key) entries keep matching the wider 'alltime' prefix below, so historical scores aren't lost, they just don't count for the current week until replayed. */
export async function pushLeaderboardEntry(gameId: string, score: number): Promise<void> {
  if (!profile) return;
  const week = weekKey(new Date());
  await storage.set(
    `lb:${gameId}:${week}:` + profile.id,
    { name: profile.name, score, id: profile.id, avatar: profile.equippedAvatar, title: profile.equippedTitle, frame: profile.equippedFrame },
    true,
  );
}

function lbPrefix(gameId: string, week: string | null): string {
  return week ? `lb:${gameId}:${week}:` : `lb:${gameId}:`;
}

async function readLeaderboard(gameId: string, week: string | null): Promise<LeaderboardEntry[]> {
  const keys = await storage.list(lbPrefix(gameId, week), true);
  // Fetched in parallel rather than one round-trip per key — with many
  // players on a leaderboard, sequential fetches here were the single
  // biggest contributor to the post-game wait (see finishGameSession).
  const rows = await Promise.all(keys.map((k) => storage.get<LeaderboardEntry>(k, true)));
  const entries: LeaderboardEntry[] = rows.filter((r): r is LeaderboardEntry => r != null);
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
  const combined = await readLeaderboard(gameId, scope === 'week' ? weekKey(new Date()) : null);
  // Overlay each player's live avatar/title/name so an equip change shows up
  // immediately instead of waiting for that player's next score push.
  await Promise.all(
    combined.map(async (e) => {
      const meta = await storage.get<PlayerMeta>('playerMeta:' + e.id, true);
      if (meta) {
        e.name = meta.name;
        e.avatar = meta.avatar;
        e.title = meta.title;
        e.frame = meta.frame;
      }
    }),
  );
  return combined;
}

export interface WeeklyLeadStanding {
  id: string;
  name: string;
  avatar: string | null;
  frame: string | null;
  title: string | null;
  gameIds: string[];
}

/** Live "who's currently #1 in how many games this week" standings — unlike getHallOfFame()
 * (which only reflects weeks already credited/finalized), this reads the in-progress current
 * week directly so players can track real-time progress toward the 4-game legendary threshold
 * (see LEGENDARY_WEEK_THRESHOLD below) before the week ends. Nothing is written here. */
export async function getWeeklyLeadStandings(week: string = weekKey(new Date())): Promise<WeeklyLeadStanding[]> {
  const implementedGameIds = GAMES.filter((g) => g.implemented).map((g) => g.id);
  const byId: Record<string, string[]> = {};
  await Promise.all(
    implementedGameIds.map(async (gameId) => {
      const board = await readLeaderboard(gameId, week);
      if (board.length > 0) (byId[board[0].id] ??= []).push(gameId);
    }),
  );
  const standings = await Promise.all(
    Object.entries(byId).map(async ([id, gameIds]) => {
      const meta = await storage.get<PlayerMeta>('playerMeta:' + id, true);
      return { id, name: meta?.name ?? 'Ukendt spiller', avatar: meta?.avatar ?? null, frame: meta?.frame ?? null, title: meta?.title ?? null, gameIds };
    }),
  );
  standings.sort((a, b) => b.gameIds.length - a.gameIds.length);
  return standings;
}

/** How many different games you need to finish #1 in during the SAME week to earn a legendary slot (see shop.ts) — a real weekly dominance flex, not a slow cumulative grind. */
export const LEGENDARY_WEEK_THRESHOLD = 4;

/** Last (fully completed) week's legendary winner(s) — anyone who finished #1 in
 * LEGENDARY_WEEK_THRESHOLD+ games. Unlike creditMyHallOfFameWins() (self-scoped by RLS
 * to only ever write the signed-in player's own hof:<id> row), this only *reads*
 * already-public leaderboard entries, so every client computes the same answer for
 * anyone — used purely for the "who won legendary" reveal (see legendary.ts), not for
 * actually crediting Hall of Fame/legendary slots (that still only happens lazily, per
 * player, via creditMyHallOfFameWins). */
export async function getLastWeekLegendaryWinners(): Promise<WeeklyLeadStanding[]> {
  const lastWeek = weekKey(new Date(Date.now() - 7 * 24 * 3600 * 1000));
  const standings = await getWeeklyLeadStandings(lastWeek);
  return standings.filter((s) => s.gameIds.length >= LEGENDARY_WEEK_THRESHOLD);
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
  let newLegendaryWeeks = 0;

  for (let weeksAgo = 1; weeksAgo <= 8; weeksAgo++) {
    const week = weekKey(new Date(now - weeksAgo * 7 * 24 * 3600 * 1000));
    if (profile.hofCheckedThroughWeek != null && week <= profile.hofCheckedThroughWeek) break;
    let winsThisWeek = 0;
    for (const gameId of implementedGameIds) {
      const board = await readLeaderboard(gameId, week);
      if (board.length > 0 && board[0].id === profile.id) {
        if (!hof) hof = (await storage.get<HallOfFameEntry>('hof:' + profile.id, true)) ?? { id: profile.id, wins: {}, totalWins: 0, legendaryWeeks: 0 };
        hof.wins[gameId] = (hof.wins[gameId] ?? 0) + 1;
        hof.totalWins++;
        winsThisWeek++;
      }
    }
    // A single dominant week (#1 in several games at once), not a slow accumulation across
    // many weeks — this is what actually earns a legendary slot, tracked separately from the
    // plain per-win totalWins tally above.
    if (winsThisWeek >= LEGENDARY_WEEK_THRESHOLD) {
      if (!hof) hof = (await storage.get<HallOfFameEntry>('hof:' + profile.id, true)) ?? { id: profile.id, wins: {}, totalWins: 0, legendaryWeeks: 0 };
      hof.legendaryWeeks = (hof.legendaryWeeks ?? 0) + 1;
      newLegendaryWeeks++;
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
    if (newLegendaryWeeks > 0) {
      toast(
        `<span class="toast-icon">⭐</span> Du har optjent et legendary-slot — vælg selv hvilken avatar, ramme eller titel i butikken!`,
        'achievement',
      );
      Sound.pb();
    }
  }

  // Legendary cosmetics/badges gate off "how many dominant weeks" and "am I #1 overall" —
  // checked every call (not just when something new was just credited above), so a player who
  // crossed a threshold in an earlier session still gets credited the next time this runs.
  const currentHof = hof ?? (await storage.get<HallOfFameEntry>('hof:' + profile.id, true));
  const hofList = await getHallOfFame();
  const hofIsRankOne = hofList.length > 0 && hofList[0].id === profile.id && hofList[0].totalWins > 0;
  await checkAchievements({ legendaryWeeks: currentHof?.legendaryWeeks ?? 0, hofIsRankOne });
}

export async function getPlayerMeta(id: string): Promise<PlayerMeta | null> {
  return storage.get<PlayerMeta>('playerMeta:' + id, true);
}

/** How many legendary "slots" this player has earned — one per week they finished #1 in 4+ different games (see LEGENDARY_WEEK_THRESHOLD above). Each slot lets them unlock one legendary avatar/frame/title of their choice (see pages/shop.ts) — spending is derived from how many legendary items they already own, not tracked separately here. */
export async function getMyLegendarySlots(): Promise<number> {
  if (!profile) return 0;
  const entry = await storage.get<HallOfFameEntry>('hof:' + profile.id, true);
  return entry?.legendaryWeeks ?? 0;
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

export interface DuelLeaderboardEntry {
  id: string;
  name: string;
  avatar: string | null;
  frame: string | null;
  title: string | null;
  wins: number;
  losses: number;
  draws: number;
}

/** Same "list keys, fetch each, sort" shape as getHallOfFame() above, reading the same
 * playerMeta:<id> rows getPlayerMeta() reads one at a time — only players with at least
 * one recorded duel show up, so a fresh account with 0-0-0 doesn't pad out the list. */
export async function getDuelLeaderboard(): Promise<DuelLeaderboardEntry[]> {
  const keys = await storage.list('playerMeta:', true);
  const entries: DuelLeaderboardEntry[] = [];
  for (const k of keys) {
    const meta = await storage.get<PlayerMeta>(k, true);
    if (!meta) continue;
    const wins = meta.duelWins ?? 0;
    const losses = meta.duelLosses ?? 0;
    const draws = meta.duelDraws ?? 0;
    if (wins + losses + draws === 0) continue;
    entries.push({ id: k.slice('playerMeta:'.length), name: meta.name, avatar: meta.avatar, frame: meta.frame, title: meta.title, wins, losses, draws });
  }
  entries.sort((a, b) => b.wins - a.wins || a.losses - b.losses);
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
  // Fetched in parallel across games rather than one game's leaderboard at a
  // time — this loop used to be the dominant cost of ending a session (up to
  // 15 sequential full-leaderboard reads).
  const boards = await Promise.all(implementedGameIds.map((gameId) => getCombinedLeaderboard(gameId)));
  const ranks: Record<string, number | null> = {};
  implementedGameIds.forEach((gameId, i) => {
    const idx = boards[i].findIndex((e) => e.id === profile!.id);
    ranks[gameId] = idx >= 0 ? idx + 1 : null;
  });
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
    level: levelInfo(profile.xp).level,
    ...extra,
  };
  let changed = false;
  for (const a of ACHIEVEMENTS) {
    if (!profile.unlockedAchievements.includes(a.id) && a.check(statObj)) {
      profile.unlockedAchievements.push(a.id);
      changed = true;
      addXp(XP_RULES.achievement);
      Sound.achievement();
      toast(
        `<span class="toast-icon">${a.icon}</span><div><b>${a.title}</b> <span style="color:var(--lime)">+${XP_RULES.achievement} XP</span><br><span style="color:var(--text-dim);font-size:11.5px">${a.desc}</span></div>`,
        'achievement',
      );
    }
  }

  // Badges — auto-earned medals (see badges.ts), same check(stats) pattern and statObj as
  // achievements above, just a separate collection (never purchased, no "equipped" concept).
  for (const b of BADGES) {
    if (!profile.unlockedBadges.includes(b.id) && b.check(statObj)) {
      profile.unlockedBadges.push(b.id);
      changed = true;
      addXp(XP_RULES.badge);
      Sound.achievement();
      toast(
        `<span class="toast-icon">🎖️</span><div><b>${b.name}</b> <span style="color:var(--lime)">+${XP_RULES.badge} XP</span><br><span style="color:var(--text-dim);font-size:11.5px">${b.desc}</span></div>`,
        'achievement',
      );
    }
  }

  // Secret titles — same auto-grant pattern, but the two conditions need direct profile access
  // (collection-completeness checks) rather than anything in the shared AchievementStats shape.
  // Derived from the live implemented-game count (not a hardcoded number) so this stays "every
  // game" instead of silently going stale — and prematurely awardable — every time a game is added.
  if (!profile.unlockedTitles.includes('title-secret-01') && statObj.gamesPlayed >= implementedGameIds.length) {
    profile.unlockedTitles.push('title-secret-01');
    changed = true;
    toast(`<span class="toast-icon">🔮</span><div><b>Hemmelig titel fundet!</b><br><span style="color:var(--text-dim);font-size:11.5px">Du har spillet alle spil — tjek butikken.</span></div>`, 'achievement');
    Sound.achievement();
  }
  const allLegendaryOwned =
    AVATARS.filter((a) => a.rarity === 'legendary').every((a) => profile!.unlockedAvatars.includes(a.id)) &&
    FRAMES.filter((f) => f.rarity === 'legendary').every((f) => profile!.unlockedFrames.includes(f.id)) &&
    TITLES.filter((t) => t.rarity === 'legendary').every((t) => profile!.unlockedTitles.includes(t.id));
  if (!profile.unlockedTitles.includes('title-secret-02') && allLegendaryOwned) {
    profile.unlockedTitles.push('title-secret-02');
    changed = true;
    toast(`<span class="toast-icon">🔮</span><div><b>Hemmelig titel fundet!</b><br><span style="color:var(--text-dim);font-size:11.5px">Du ejer nu alt legendarisk — tjek butikken.</span></div>`, 'achievement');
    Sound.achievement();
  }

  if (changed) {
    await saveProfile();
    refreshHeader(); // achievements/badges can award XP now — the header's XP/level may already be stale by the time we get here
  }
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
  refreshHeader();
  void pushActivity(gameId, score, isNewBest ? 'personal_best' : 'session', profile.name, profile.equippedAvatar, profile.equippedFrame);

  // Streak milestones, the daily challenge, and achievements are all
  // pure toast-driven bonuses layered on top of this result — none of them
  // are needed to paint score/XP/rank above. checkAchievements alone
  // re-scans every implemented game's leaderboard, by far the slowest part
  // of ending a session, so let this settle in the background instead of
  // making the player stare at a frozen result screen for it.
  void settleSessionExtras(gameId, score, extraAchievementStats);

  return { isNewBest, xpGain, rank };
}

async function settleSessionExtras(gameId: string, score: number, extraAchievementStats?: Partial<AchievementStats>): Promise<void> {
  try {
    await updateStreak();
    await checkDailyChallenge(gameId, score);
    refreshHeader();
    await checkAchievements(extraAchievementStats);
  } catch (e) {
    console.error('post-session bookkeeping failed', e);
  }
}

/**
 * "Duel just ended" bookkeeping — deliberately separate from finishGameSession
 * above: a duel has no personal-best/leaderboard/streak/daily-challenge concept,
 * just a win/loss/draw counter and a flat XP award (see XP_RULES.duelWin/Draw/Loss
 * in xp.ts). Pushes a 'duel_result' row to the shared activity feed (see
 * pushActivity in activity.ts) so the outcome shows up live for other players.
 */
export async function finishDuelSession(outcome: 'win' | 'loss' | 'draw', opponentName: string): Promise<{ xpGain: number }> {
  if (!profile) return { xpGain: 0 };
  if (outcome === 'win') profile.duelWins++;
  else if (outcome === 'loss') profile.duelLosses++;
  else profile.duelDraws++;
  const xpGain = outcome === 'win' ? XP_RULES.duelWin : outcome === 'draw' ? XP_RULES.duelDraw : XP_RULES.duelLoss;
  addXp(xpGain);
  await saveProfile();
  refreshHeader();
  const score = outcome === 'win' ? 1 : outcome === 'draw' ? 0.5 : 0;
  void pushActivity('duel', score, 'duel_result', profile.name, profile.equippedAvatar, profile.equippedFrame, opponentName);
  return { xpGain };
}
