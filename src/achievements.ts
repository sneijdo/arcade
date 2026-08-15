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

  // Breach Protocol
  { id: 'tactical_operator', icon: '🪖', title: 'OPERATØR', desc: 'Ryd 3+ rum i Breach Protocol.', check: (s) => (s.bestScores.tactical ?? 0) >= 3 },
  { id: 'tactical_commander', icon: '🎖️', title: 'BEFALINGSMAND', desc: 'Fuldfør hele missionen i Breach Protocol.', check: (s) => (s.bestScores.tactical ?? 0) >= 10 },
  { id: 'tactical_boss_slayer', icon: '💀', title: 'BOSS-DRÆBER', desc: 'Besejr en boss i Breach Protocol.', check: (s) => (s.tacticalBossesDefeated?.length ?? 0) >= 1 },
  { id: 'tactical_boss_master', icon: '👹', title: 'BOSS-MESTER', desc: 'Besejr begge bosses i Breach Protocol.', check: (s) => (s.tacticalBossesDefeated?.length ?? 0) >= 2 },
  { id: 'tactical_elite_hunter', icon: '🟣', title: 'ELITEJÆGER', desc: 'Nedkæmp 5+ elite-fjender i Breach Protocol.', check: (s) => (s.tacticalEliteKills ?? 0) >= 5 },
  { id: 'tactical_elite_exterminator', icon: '☠️', title: 'ELITEUDRYDDER', desc: 'Nedkæmp 25+ elite-fjender i Breach Protocol.', check: (s) => (s.tacticalEliteKills ?? 0) >= 25 },
  { id: 'tactical_vault_finder', icon: '🔷', title: 'HVÆLVFINDER', desc: 'Brug et hvælv i Breach Protocol.', check: (s) => (s.tacticalVaultsUsed ?? 0) >= 1 },
  { id: 'tactical_vault_master', icon: '💎', title: 'HVÆLVMESTER', desc: 'Brug 10+ hvælve i Breach Protocol.', check: (s) => (s.tacticalVaultsUsed ?? 0) >= 10 },

  // Color Match
  { id: 'color_eye', icon: '🎨', title: 'SKARPT ØJE', desc: '85%+ nøjagtighed i Color Match.', check: (s) => (s.bestScores.color ?? 0) >= 85 },
  { id: 'color_perfect', icon: '🖌️', title: 'FARVEGENI', desc: '95%+ nøjagtighed i Color Match.', check: (s) => (s.bestScores.color ?? 0) >= 95 },

  // Stack Tower
  { id: 'stack_builder', icon: '🧱', title: 'BYGMESTER', desc: '12+ blokke i Stack Tower.', check: (s) => (s.bestScores.stack ?? 0) >= 12 },
  { id: 'stack_architect', icon: '🏗️', title: 'ARKITEKT', desc: '25+ blokke i Stack Tower.', check: (s) => (s.bestScores.stack ?? 0) >= 25 },

  // Dash
  { id: 'dash_runner', icon: '💨', title: 'LØBER', desc: '100+ meter i Dash.', check: (s) => (s.bestScores.dash ?? 0) >= 100 },
  { id: 'dash_unstoppable', icon: '🌪️', title: 'USTOPPELIG', desc: '400+ meter i Dash.', check: (s) => (s.bestScores.dash ?? 0) >= 400 },

  // Merge
  { id: 'merge_512', icon: '🔢', title: 'TALKNUSER', desc: 'Nå 512 i Merge.', check: (s) => (s.bestScores.merge ?? 0) >= 512 },
  { id: 'merge_1024', icon: '🌟', title: 'TALGENI', desc: 'Nå 1024 i Merge.', check: (s) => (s.bestScores.merge ?? 0) >= 1024 },

  // Daily streak
  { id: 'streak_starter', icon: '🔥', title: 'I ILD', desc: 'Nå en 3-dages spillestime.', check: (s) => s.longestStreak >= 3 },
  { id: 'streak_legend', icon: '🌋', title: 'UUDSLUKKELIG', desc: 'Nå en 30-dages spillestime.', check: (s) => s.longestStreak >= 30 },

  // Shop
  { id: 'shop_stylish', icon: '🎭', title: 'STILFULD', desc: 'Eje 3+ avatarer fra butikken.', check: (s) => s.unlockedAvatarsCount >= 3 },
  { id: 'shop_renowned', icon: '📛', title: 'KENDT', desc: 'Eje 3+ titler fra butikken.', check: (s) => s.unlockedTitlesCount >= 3 },

  // Cross-game
  { id: 'firstplace', icon: '🏆', title: 'MESTER', desc: 'Indtag #1-pladsen på et leaderboard.', check: (s) => Object.values(s.ranks).some((r) => r === 1) },
  { id: 'allrounder', icon: '🎮', title: 'ALLROUNDER', desc: 'Sæt en rekord i alle spil.', check: (s) => s.gamesPlayed >= 10 },
  { id: 'grinder', icon: '🔥', title: 'I GANG', desc: 'Spil 5 runder i alt.', check: (s) => s.sessionsPlayed >= 5 },
  { id: 'dedicated', icon: '💀', title: 'ÉN MERE', desc: 'Spil 10 runder i alt.', check: (s) => s.sessionsPlayed >= 10 },
];
