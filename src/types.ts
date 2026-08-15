export interface Profile {
  id: string;
  name: string;
  xp: number;
  bestReaction: number | null;
  bestAvg: number | null;
  sessionsPlayed: number;
  history: ReactionSession[];
  unlockedAchievements: string[];
  muted: boolean;
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
  rank: number | null;
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
}

export type Route = 'home' | 'games' | 'leaderboard' | 'friends' | 'profile' | 'play-reaction';
