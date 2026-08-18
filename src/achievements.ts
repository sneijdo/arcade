import type { Achievement } from './types';

export const ACHIEVEMENTS: Achievement[] = [
  // Reaction
  { id: 'lightning', icon: '⚡', title: 'LYNHURTIG', desc: 'Score under 150ms i Reaction.', check: (s) => s.bestReaction != null && s.bestReaction < 150 },
  { id: 'excellent5', icon: '🎯', title: 'SKARP', desc: 'Gennemsnit under 200ms i én runde Reaction.', check: (s) => s.bestAvg != null && s.bestAvg < 200 },
  { id: 'reaction_superhuman', icon: '🧬', title: 'OVERMENNESKELIG', desc: 'Score under 120ms i Reaction.', check: (s) => s.bestReaction != null && s.bestReaction < 120 },

  // Aim Trainer
  { id: 'aim_sharp', icon: '🔫', title: 'SKARPSKYTTE', desc: '20+ hits i Aim Trainer.', check: (s) => (s.bestScores.aim ?? 0) >= 20 },
  { id: 'aim_perfect', icon: '💥', title: 'PERFEKT SIGTE', desc: '28+ hits i Aim Trainer.', check: (s) => (s.bestScores.aim ?? 0) >= 28 },
  { id: 'aim_legend', icon: '🏹', title: 'SIGTELEGENDE', desc: '32+ hits i Aim Trainer.', check: (s) => (s.bestScores.aim ?? 0) >= 32 },

  // Memory
  { id: 'memory_focused', icon: '🧩', title: 'FOKUSERET', desc: 'Nå niveau 8 i Memory.', check: (s) => (s.bestScores.memory ?? 0) >= 8 },
  { id: 'memory_savant', icon: '🧠', title: 'HUKOMMELSESGENI', desc: 'Nå niveau 12 i Memory.', check: (s) => (s.bestScores.memory ?? 0) >= 12 },
  { id: 'memory_eidetic', icon: '📸', title: 'FOTOGRAFISK HUKOMMELSE', desc: 'Nå niveau 15 i Memory.', check: (s) => (s.bestScores.memory ?? 0) >= 15 },

  // Number Rush
  { id: 'numberrush_quick', icon: '🧮', title: 'HOVEDREGNER', desc: '20+ point i Number Rush.', check: (s) => (s.bestScores.numberrush ?? 0) >= 20 },
  { id: 'numberrush_genius', icon: '💡', title: 'REGNEGENI', desc: '30+ point i Number Rush.', check: (s) => (s.bestScores.numberrush ?? 0) >= 30 },
  { id: 'numberrush_calculator', icon: '🖩', title: 'MENNESKELIG LOMMEREGNER', desc: '35+ point i Number Rush.', check: (s) => (s.bestScores.numberrush ?? 0) >= 35 },

  // Snake
  { id: 'snake_grower', icon: '🐍', title: 'SLANGETÆMMER', desc: '10+ point i Snake.', check: (s) => (s.bestScores.snake ?? 0) >= 10 },
  { id: 'snake_legend', icon: '👑', title: 'SLANGEKONGE', desc: '20+ point i Snake.', check: (s) => (s.bestScores.snake ?? 0) >= 20 },
  { id: 'snake_ancient', icon: '🐲', title: 'URGAMMEL SLANGE', desc: '32+ point i Snake.', check: (s) => (s.bestScores.snake ?? 0) >= 32 },

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
  { id: 'color_flawless', icon: '🌈', title: 'FEJLFRI FARVESANS', desc: '98%+ nøjagtighed i Color Match.', check: (s) => (s.bestScores.color ?? 0) >= 98 },

  // Stack Tower
  { id: 'stack_builder', icon: '🧱', title: 'BYGMESTER', desc: '12+ blokke i Stack Tower.', check: (s) => (s.bestScores.stack ?? 0) >= 12 },
  { id: 'stack_architect', icon: '🏗️', title: 'ARKITEKT', desc: '25+ blokke i Stack Tower.', check: (s) => (s.bestScores.stack ?? 0) >= 25 },
  { id: 'stack_skyscraper', icon: '🌆', title: 'SKYSKRABER', desc: '40+ blokke i Stack Tower.', check: (s) => (s.bestScores.stack ?? 0) >= 40 },

  // Dash
  { id: 'dash_runner', icon: '💨', title: 'LØBER', desc: '100+ meter i Dash.', check: (s) => (s.bestScores.dash ?? 0) >= 100 },
  { id: 'dash_unstoppable', icon: '🌪️', title: 'USTOPPELIG', desc: '400+ meter i Dash.', check: (s) => (s.bestScores.dash ?? 0) >= 400 },
  { id: 'dash_marathon', icon: '🏁', title: 'MARATONLØBER', desc: '800+ meter i Dash.', check: (s) => (s.bestScores.dash ?? 0) >= 800 },

  // Merge
  { id: 'merge_512', icon: '🔢', title: 'TALKNUSER', desc: 'Nå 512 i Merge.', check: (s) => (s.mergeBestTile ?? 0) >= 512 },
  { id: 'merge_1024', icon: '🌟', title: 'TALGENI', desc: 'Nå 1024 i Merge.', check: (s) => (s.mergeBestTile ?? 0) >= 1024 },
  { id: 'merge_2048', icon: '💎', title: '2048', desc: 'Nå 2048 i Merge.', check: (s) => (s.mergeBestTile ?? 0) >= 2048 },

  // Overclock
  { id: 'overclock_charged', icon: '⚛️', title: 'OPLADT', desc: '1200+ point i Overclock.', check: (s) => (s.bestScores.overclock ?? 0) >= 1200 },
  { id: 'overclock_meltdown', icon: '🌋', title: 'GRÆNSESØGER', desc: '2500+ point i Overclock.', check: (s) => (s.bestScores.overclock ?? 0) >= 2500 },
  { id: 'overclock_reactor', icon: '☢️', title: 'REAKTORMESTER', desc: '3500+ point i Overclock.', check: (s) => (s.bestScores.overclock ?? 0) >= 3500 },

  // Glitch Grid
  { id: 'glitchgrid_hunter', icon: '🐛', title: 'FEJLJÆGER', desc: '35+ point i Glitch Grid.', check: (s) => (s.bestScores.glitchgrid ?? 0) >= 35 },
  { id: 'glitchgrid_debugger', icon: '🧬', title: 'DEBUGGER', desc: '90+ point i Glitch Grid.', check: (s) => (s.bestScores.glitchgrid ?? 0) >= 90 },
  { id: 'glitchgrid_architect', icon: '🕸️', title: 'SYSTEMARKITEKT', desc: '120+ point i Glitch Grid.', check: (s) => (s.bestScores.glitchgrid ?? 0) >= 120 },

  // Pulse
  { id: 'pulse_onbeat', icon: '🎧', title: 'I TAKT', desc: '5000+ point i Pulse.', check: (s) => (s.bestScores.pulse ?? 0) >= 5000 },
  { id: 'pulse_flawless', icon: '🎼', title: 'PLETFRI RYTME', desc: '15000+ point i Pulse.', check: (s) => (s.bestScores.pulse ?? 0) >= 15000 },
  { id: 'pulse_maestro', icon: '🎹', title: 'MAESTRO', desc: '25000+ point i Pulse.', check: (s) => (s.bestScores.pulse ?? 0) >= 25000 },

  // Drop Zone
  { id: 'dropzone_lucky', icon: '🎱', title: 'HELDIG HÅND', desc: '800+ point i Drop Zone.', check: (s) => (s.bestScores.dropzone ?? 0) >= 800 },
  { id: 'dropzone_jackpot', icon: '💰', title: 'JACKPOT', desc: '3000+ point i Drop Zone.', check: (s) => (s.bestScores.dropzone ?? 0) >= 3000 },
  { id: 'dropzone_perfectrun', icon: '👑', title: 'PERFEKT RUN', desc: '4000+ point i Drop Zone — alle otte kugler i topboksen.', check: (s) => (s.bestScores.dropzone ?? 0) >= 4000 },

  // Rule Breaker
  { id: 'ruleswitch_sharp', icon: '🔀', title: 'SKARP TÆNKER', desc: '12+ point i Rule Breaker.', check: (s) => (s.bestScores.ruleswitch ?? 0) >= 12 },
  { id: 'ruleswitch_unbreakable', icon: '🧠', title: 'UBRYDELIG', desc: '24+ point i Rule Breaker.', check: (s) => (s.bestScores.ruleswitch ?? 0) >= 24 },
  { id: 'ruleswitch_flawless', icon: '🧿', title: 'ALDRIG PÅ AUTOPILOT', desc: '28+ point i Rule Breaker.', check: (s) => (s.bestScores.ruleswitch ?? 0) >= 28 },

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
