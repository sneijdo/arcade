import type { Achievement } from './types';

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'lightning', icon: '⚡', title: 'LYNHURTIG', desc: 'Score under 150ms.', check: (s) => s.bestReaction != null && s.bestReaction < 150 },
  { id: 'excellent5', icon: '🎯', title: 'SKARP', desc: 'Gennemsnit under 200ms i én runde.', check: (s) => s.bestAvg != null && s.bestAvg < 200 },
  { id: 'firstplace', icon: '🏆', title: 'MESTER', desc: 'Indtag #1-pladsen på leaderboardet.', check: (s) => s.rank === 1 },
  { id: 'grinder', icon: '🔥', title: 'I GANG', desc: 'Spil 5 runder i alt.', check: (s) => s.sessionsPlayed >= 5 },
  { id: 'dedicated', icon: '💀', title: 'ÉN MERE', desc: 'Spil 10 runder i alt.', check: (s) => s.sessionsPlayed >= 10 },
];
