import type { Achievement } from './types';

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'lightning', icon: '⚡', title: 'LIGHTNING', desc: 'Score under 150ms.', check: (s) => s.bestReaction != null && s.bestReaction < 150 },
  { id: 'excellent5', icon: '🎯', title: 'DIALED IN', desc: 'Average under 200ms in one run.', check: (s) => s.bestAvg != null && s.bestAvg < 200 },
  { id: 'firstplace', icon: '🏆', title: 'CHAMPION', desc: 'Hold #1 on the leaderboard.', check: (s) => s.rank === 1 },
  { id: 'grinder', icon: '🔥', title: 'ON A ROLL', desc: 'Play 5 rounds sets total.', check: (s) => s.sessionsPlayed >= 5 },
  { id: 'dedicated', icon: '💀', title: 'ONE MORE', desc: 'Play 10 sessions total.', check: (s) => s.sessionsPlayed >= 10 },
];
