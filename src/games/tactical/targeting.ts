import type { Vec2 } from './types';
import { vDist } from './types';

export interface TargetCandidate {
  id: number;
  pos: Vec2;
  isElite?: boolean;
}

/**
 * Reusable target selection — the player controller (and, later, any
 * turret/companion) calls this rather than embedding its own priority
 * logic. Scoring order matches the spec: distance, then threat level;
 * line-of-sight is a hook for when Phase-2 adds cover geometry (always
 * true today since Phase-1 rooms have no blocking obstacles yet).
 */
export function selectTarget(originPos: Vec2, candidates: TargetCandidate[], range: number, hasLineOfSight: (c: TargetCandidate) => boolean = () => true): TargetCandidate | null {
  let best: TargetCandidate | null = null;
  let bestScore = -Infinity;
  for (const c of candidates) {
    const dist = vDist(originPos, c.pos);
    if (dist > range) continue;
    if (!hasLineOfSight(c)) continue;
    const threatWeight = c.isElite ? 1.5 : 1;
    const proximityScore = (1 - dist / range) * 100;
    const score = proximityScore * threatWeight;
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best;
}
