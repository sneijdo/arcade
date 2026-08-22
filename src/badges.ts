import type { Badge } from './types';

/**
 * Auto-earned medals (see checkBadges() in state.ts) — never purchased, shown as a collection on
 * Profile. Every condition reuses stats already tracked elsewhere (achievements, streaks,
 * Hall of Fame) rather than introducing new tracking. The 3 legendary badges intentionally use
 * the same bar as legendary cosmetics (10 cumulative Hall of Fame #1-week wins) or something
 * rarer still — "global" can only ever be held by one player at a time.
 */
export const BADGES: Badge[] = [
  // Common
  { id: 'badge-first-win', name: 'First Win', desc: 'Indtag #1-pladsen på et leaderboard for første gang.', asset: '/cosmetics/badges/first-win.png', rarity: 'common', check: (s) => Object.values(s.ranks).some((r) => r === 1) },
  { id: 'badge-10-games', name: '10 Games', desc: 'Spil 10 runder i alt.', asset: '/cosmetics/badges/10-games.png', rarity: 'common', check: (s) => s.sessionsPlayed >= 10 },
  { id: 'badge-50-games', name: '50 Games', desc: 'Spil 50 runder i alt.', asset: '/cosmetics/badges/50-games.png', rarity: 'common', check: (s) => s.sessionsPlayed >= 50 },
  { id: 'badge-100-games', name: '100 Games', desc: 'Spil 100 runder i alt.', asset: '/cosmetics/badges/100-games.png', rarity: 'common', check: (s) => s.sessionsPlayed >= 100 },

  // Rare
  { id: 'badge-7-day-streak', name: '7 Day Streak', desc: 'Nå en 7-dages spillestime.', asset: '/cosmetics/badges/7-day-streak.png', rarity: 'rare', check: (s) => s.longestStreak >= 7 },
  { id: 'badge-speedrunner', name: 'Speedrunner', desc: '400+ meter i Dash.', asset: '/cosmetics/badges/speedrunner.png', rarity: 'rare', check: (s) => (s.bestScores.dash ?? 0) >= 400 },
  { id: 'badge-diamond', name: 'Diamond', desc: 'Nå level 10.', asset: '/cosmetics/badges/diamond.png', rarity: 'rare', check: (s) => s.level >= 10 },
  { id: 'badge-top-10', name: 'Top 10', desc: 'Placér dig i top 10 på et leaderboard.', asset: '/cosmetics/badges/top-10.png', rarity: 'rare', check: (s) => Object.values(s.ranks).some((r) => r != null && r <= 10) },
  { id: 'badge-unstoppable', name: 'Unstoppable', desc: 'Nå en 14-dages spillestime.', asset: '/cosmetics/badges/unstoppable.png', rarity: 'rare', check: (s) => s.longestStreak >= 14 },

  // Epic
  { id: 'badge-no-death', name: 'No Death', desc: 'Ryd alle 10 rum i Breach Protocol.', asset: '/cosmetics/badges/no-death.png', rarity: 'epic', check: (s) => (s.bestScores.tactical ?? 0) >= 10 },
  { id: 'badge-planker', name: 'Planker', desc: '25+ blokke i Stack Tower.', asset: '/cosmetics/badges/planker.png', rarity: 'epic', check: (s) => (s.bestScores.stack ?? 0) >= 25 },
  { id: 'badge-dragon', name: 'Dragon', desc: 'Besejr begge bosses i Breach Protocol.', asset: '/cosmetics/badges/dragon.png', rarity: 'epic', check: (s) => (s.tacticalBossesDefeated?.length ?? 0) >= 2 },
  { id: 'badge-elite', name: 'Elite', desc: 'Nedkæmp 25+ elite-fjender i Breach Protocol.', asset: '/cosmetics/badges/elite.png', rarity: 'epic', check: (s) => (s.tacticalEliteKills ?? 0) >= 25 },

  // Legendary
  { id: 'badge-legend', name: 'Legend', desc: 'Slut en uge som nr. 1 i 4+ forskellige spil.', asset: '/cosmetics/badges/legend.png', rarity: 'legendary', check: (s) => (s.legendaryWeeks ?? 0) >= 1 },
  { id: 'badge-global', name: 'Global', desc: 'Vær #1 i det samlede Hall of Fame, kun én spiller kan have denne ad gangen.', asset: '/cosmetics/badges/global.png', rarity: 'legendary', check: (s) => s.hofIsRankOne === true },
  { id: 'badge-void-walker', name: 'Void Walker', desc: 'Nå level 20.', asset: '/cosmetics/badges/void-walker.png', rarity: 'legendary', check: (s) => s.level >= 20 },
];
