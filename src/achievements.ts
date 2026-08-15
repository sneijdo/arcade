import type { Achievement } from './types';

export const ACHIEVEMENTS: Achievement[] = [
  // Reaction
  { id: 'lightning', icon: '⚡', title: 'LYNHURTIG', desc: 'Score under 150ms i Reaction.', check: (s) => s.bestReaction != null && s.bestReaction < 150 },
  { id: 'excellent5', icon: '🎯', title: 'SKARP', desc: 'Gennemsnit under 200ms i én runde Reaction.', check: (s) => s.bestAvg != null && s.bestAvg < 200 },

  // Aim Trainer
  { id: 'aim_sharp', icon: '🔫', title: 'SKARPSKYTTE', desc: '20+ hits i Aim Trainer.', check: (s) => (s.bestScores.aim ?? 0) >= 20 },
  { id: 'aim_perfect', icon: '💥', title: 'PERFEKT SIGTE', desc: '28+ hits i Aim Trainer.', check: (s) => (s.bestScores.aim ?? 0) >= 28 },

  // Memory
  { id: 'memory_focused', icon: '🧩', title: 'FOKUSERET', desc: 'Nå niveau 8 i Memory.', check: (s) => (s.bestScores.memory ?? 0) >= 8 },
  { id: 'memory_savant', icon: '🧠', title: 'HUKOMMELSESGENI', desc: 'Nå niveau 12 i Memory.', check: (s) => (s.bestScores.memory ?? 0) >= 12 },

  // Number Rush
  { id: 'numberrush_quick', icon: '🧮', title: 'HOVEDREGNER', desc: '20+ point i Number Rush.', check: (s) => (s.bestScores.numberrush ?? 0) >= 20 },
  { id: 'numberrush_genius', icon: '💡', title: 'REGNEGENI', desc: '30+ point i Number Rush.', check: (s) => (s.bestScores.numberrush ?? 0) >= 30 },

  // Snake
  { id: 'snake_grower', icon: '🐍', title: 'SLANGETÆMMER', desc: '10+ point i Snake.', check: (s) => (s.bestScores.snake ?? 0) >= 10 },
  { id: 'snake_legend', icon: '👑', title: 'SLANGEKONGE', desc: '20+ point i Snake.', check: (s) => (s.bestScores.snake ?? 0) >= 20 },

  // Cross-game
  { id: 'firstplace', icon: '🏆', title: 'MESTER', desc: 'Indtag #1-pladsen på et leaderboard.', check: (s) => Object.values(s.ranks).some((r) => r === 1) },
  { id: 'allrounder', icon: '🎮', title: 'ALLROUNDER', desc: 'Sæt en rekord i alle spil.', check: (s) => s.gamesPlayed >= 5 },
  { id: 'grinder', icon: '🔥', title: 'I GANG', desc: 'Spil 5 runder i alt.', check: (s) => s.sessionsPlayed >= 5 },
  { id: 'dedicated', icon: '💀', title: 'ÉN MERE', desc: 'Spil 10 runder i alt.', check: (s) => s.sessionsPlayed >= 10 },
];
