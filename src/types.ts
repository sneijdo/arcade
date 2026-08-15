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
  /** Breach Protocol cross-run counters — passed in as extra stats from finishGameSession's optional param, not derived from Profile like the fields above. Optional since only tactical.ts ever supplies them. */
  tacticalEliteKills?: number;
  tacticalVaultsUsed?: number;
  tacticalBossesDefeated?: string[];
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  /** Snapshot of the equipped avatar/title at the moment this entry was last pushed (see pushLeaderboardEntry in state.ts) — updates whenever the player next sets a score, not live. */
  avatar?: string | null;
  title?: string | null;
}

export type Route = 'home' | 'games' | 'leaderboard' | 'profile' | 'shop' | `play-${string}`;
