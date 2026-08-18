/**
 * Ember Ward is closed-testing with a handful of named players before it goes live to everyone —
 * gates visibility (games grid, home, leaderboard tabs, direct URL navigation) AND turns off all
 * persistence for a play session (leaderboard entry, XP, activity feed, best-score, achievements —
 * see finishSession() in towerdefense.ts) so test runs don't pollute real stats. Flip
 * EMBER_WARD_BETA to false once the user says it's ready to open up — every gate below reads this
 * one flag, so nothing else needs to change.
 */
export const EMBER_WARD_BETA = true;

const TESTERS = ['Sbobolo', 'Linnet', 'Sneijdo'];

export function canAccessEmberWard(playerName: string | null | undefined): boolean {
  if (!EMBER_WARD_BETA) return true;
  if (!playerName) return false;
  return TESTERS.some((n) => n.toLowerCase() === playerName.toLowerCase());
}
