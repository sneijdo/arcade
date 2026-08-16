export const XP_RULES = { complete: 10, personalBest: 25, top3: 15, achievement: 25, badge: 20 };

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
