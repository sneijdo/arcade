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
  /** Most recent ISO week (see isoWeekKey in state.ts) already checked for this player's own Hall of Fame #1 finishes — see creditMyHallOfFameWins(). null = never checked. Self-scoped (rather than a single global marker) because RLS only lets a player write their own `hof:<id>` row — see supabase/schema.sql. */
  hofCheckedThroughWeek: string | null;
  unlockedFrames: string[];
  /** null = no frame — see avatarFrameHtml() in state.ts. */
  equippedFrame: string | null;
  /** Badges are auto-earned (see checkBadges() in state.ts), never purchased — no "equipped" concept, just a collection shown on Profile. */
  unlockedBadges: string[];
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
  icon: string;
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
}

/** Public, shared mirror of a profile's display identity — written every saveProfile() so leaderboard/Hall of Fame rows can show a player's *current* avatar/title/frame/name instead of whatever was equipped the last time they posted a score. */
export interface PlayerMeta {
  name: string;
  avatar: string | null;
  title: string | null;
  frame: string | null;
}

/** Cross-week aggregate of #1 finishes, keyed by profile id. See creditMyHallOfFameWins() in state.ts. */
export interface HallOfFameEntry {
  id: string;
  wins: Record<string, number>;
  totalWins: number;
  /** Weeks this player finished #1 in 4+ different games at once — earns a legendary-cosmetics slot each time (see getMyLegendarySlots in state.ts). */
  legendaryWeeks: number;
}

export type Route = 'home' | 'games' | 'leaderboard' | 'profile' | 'shop' | 'guide' | `play-${string}`;
