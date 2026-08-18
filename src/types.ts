export interface Profile {
  id: string;
  name: string;
  xp: number;
  bestReaction: number | null;
  bestAvg: number | null;
  sessionsPlayed: number;
  history: ReactionSession[];
  /** Personal-best score per game id, for every game besides reaction (which keeps its own dedicated fields above for backward compatibility with already-live data). */
  bestScores: Record<string, number>;
  unlockedAchievements: string[];
  muted: boolean;
  /** Consecutive calendar days (local time) with at least one finished game session. See updateStreak() in state.ts. */
  currentStreak: number;
  longestStreak: number;
  /** YYYY-MM-DD (local), the last date a session was finished — the anchor updateStreak() compares "today" against. */
  lastPlayedDate: string | null;
  /** YYYY-MM-DD (local) of the last date the daily challenge was completed — see checkDailyChallenge() in state.ts. */
  dailyChallengeDate: string | null;
  /** Spendable shop currency — earns in lockstep with `xp` (see addXp() in state.ts) but decreases on purchase, unlike `xp` itself which stays lifetime/monotonic for leveling. */
  xpBalance: number;
  unlockedAvatars: string[];
  unlockedTitles: string[];
  /** null = fall back to initials(name) — see avatarContent() in state.ts. */
  equippedAvatar: string | null;
  /** null = no title shown. */
  equippedTitle: string | null;
  /** Most recent week key (Sunday-start, see weekKey() in state.ts) already checked for this player's own Hall of Fame #1 finishes — see creditMyHallOfFameWins(). null = never checked. Self-scoped (rather than a single global marker) because RLS only lets a player write their own `hof:<id>` row — see supabase/schema.sql. */
  hofCheckedThroughWeek: string | null;
  unlockedFrames: string[];
  /** null = no frame — see avatarFrameHtml() in state.ts. */
  equippedFrame: string | null;
  /** Badges are auto-earned (see checkBadges() in state.ts), never purchased — no "equipped" concept, just a collection shown on Profile. */
  unlockedBadges: string[];
  /** Quiz Duel record — see finishDuelSession() in state.ts. */
  duelWins: number;
  duelLosses: number;
  duelDraws: number;
  /** Elo-style rating driving the Duel rank tier (see duelTierForRating() in state.ts) — starts at DUEL_RATING_DEFAULT (1000), updated in finishDuelSession(). */
  duelRating: number;
}

export interface ReactionSession {
  date: number;
  results: number[];
  avg: number;
  best: number;
}

export interface ScoreRating {
  label: string;
  color: string;
}

export interface ScoreKind {
  direction: 'asc' | 'desc';
  unit: string;
  format: (v: number) => string;
  rating: (v: number) => ScoreRating;
}

export interface GameDef {
  id: string;
  title: string;
  category: string;
  /** Emoji fallback — still used in a couple of small inline spots (Hall of Fame per-game badges) where the full icon art is too small to read. See iconAsset for the real game-card icon. */
  icon: string;
  /** Game-card icon artwork (see /art/gameicons) — used in the games grid and the daily-challenge card. */
  iconAsset: string;
  description: string;
  scoreKind: string | null;
  implemented: boolean;
}

export interface Achievement {
  id: string;
  icon: string;
  title: string;
  desc: string;
  check: (stats: AchievementStats) => boolean;
}

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary' | 'secret';

export interface Badge {
  id: string;
  name: string;
  desc: string;
  asset: string;
  rarity: Rarity;
  check: (stats: AchievementStats) => boolean;
}

export interface AchievementStats {
  bestReaction: number | null;
  bestAvg: number | null;
  sessionsPlayed: number;
  /** Reaction leaderboard rank — kept separate for backward compatibility with the original achievements. */
  rank: number | null;
  /** Personal-best score per game id (mirrors Profile.bestScores). */
  bestScores: Record<string, number>;
  /** Global leaderboard rank per game id, including 'reaction'. */
  ranks: Record<string, number | null>;
  /** How many distinct implemented games this player has a recorded score in. */
  gamesPlayed: number;
  /** Longest daily play streak ever reached (mirrors Profile.longestStreak). */
  longestStreak: number;
  unlockedAvatarsCount: number;
  unlockedTitlesCount: number;
  /** Current level, derived from lifetime XP (levelInfo(profile.xp).level) — several badges/legendary cosmetics key off this. */
  level: number;
  /** Breach Protocol cross-run counters — passed in as extra stats from finishGameSession's optional param, not derived from Profile like the fields above. Optional since only tactical.ts ever supplies them. */
  tacticalEliteKills?: number;
  tacticalVaultsUsed?: number;
  tacticalBossesDefeated?: string[];
  /** Hall of Fame stats — only supplied when checkBadges() is called from creditMyHallOfFameWins(), since they're not part of the normal per-session stat set. */
  hofIsRankOne?: boolean;
  /** Weeks this player finished #1 in 4+ different games at once — the legendary-cosmetics gate, see LEGENDARY_WEEK_THRESHOLD in state.ts. */
  legendaryWeeks?: number;
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  /** Snapshot of the equipped avatar/title/frame at the moment this entry was last pushed (see pushLeaderboardEntry in state.ts) — overlaid with the player's live PlayerMeta at read time (see getCombinedLeaderboard), so this only matters as a fallback for a player with no meta record yet. */
  avatar?: string | null;
  title?: string | null;
  frame?: string | null;
  /** Date.now() the moment this score first became this player's best for this game (see pushLeaderboardEntry) — only bumped on a genuine improvement, never on a repeat push of the same score, so it can break score ties in favor of whoever set the record first. Absent on entries pushed before this field existed. */
  ts?: number;
}

/** Public, shared mirror of a profile's display identity — written every saveProfile() so leaderboard/Hall of Fame rows can show a player's *current* avatar/title/frame/name instead of whatever was equipped the last time they posted a score.
 *
 * The progress fields below ride along for the read-only player-profile page (see
 * renderPlayerProfile in pages/playerProfile.ts) — optional because rows written
 * before that page existed won't have them until that player's next saveProfile(). */
export interface PlayerMeta {
  name: string;
  avatar: string | null;
  title: string | null;
  frame: string | null;
  xp?: number;
  bestReaction?: number | null;
  bestScores?: Record<string, number>;
  sessionsPlayed?: number;
  currentStreak?: number;
  longestStreak?: number;
  unlockedAchievements?: string[];
  unlockedBadges?: string[];
  duelWins?: number;
  duelLosses?: number;
  duelDraws?: number;
  duelRating?: number;
}

/** Cross-week aggregate of #1 finishes, keyed by profile id. See creditMyHallOfFameWins() in state.ts. */
export interface HallOfFameEntry {
  id: string;
  wins: Record<string, number>;
  totalWins: number;
  /** Weeks this player finished #1 in 4+ different games at once — earns a legendary-cosmetics slot each time (see getMyLegendarySlots in state.ts). */
  legendaryWeeks: number;
}

export type Route = 'home' | 'games' | 'leaderboard' | 'activity' | 'profile' | 'shop' | 'guide' | 'kasino' | `play-${string}` | `player-${string}` | `duel-${string}`;
