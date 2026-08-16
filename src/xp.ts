/** Halved across the board (was complete:10, personalBest:25, top3:15, achievement:25, badge:20) — everything now takes roughly twice as long to earn, on top of the earlier shop cost increases, so progression stays meaningful as more cosmetics/legendary content keeps getting added. Relative proportions (top3/personalBest still worth more than a plain completion) are preserved. */
export const XP_RULES = { complete: 5, personalBest: 13, top3: 8, achievement: 13, badge: 10 };

export interface LevelInfo {
  level: number;
  into: number;
  need: number;
  pct: number;
}

export function levelInfo(xp: number): LevelInfo {
  let level = 1;
  let req = 100;
  let remaining = xp;
  while (remaining >= req) {
    remaining -= req;
    level++;
    req = Math.round(req * 1.22);
  }
  return { level, into: remaining, need: req, pct: Math.min(100, Math.round((remaining / req) * 100)) };
}
