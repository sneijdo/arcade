import type { Vec2 } from '../shared/vec';
import type { EnemyInstance } from './types';

export type ProjectileKind = 'fire' | 'frost' | 'catapult';

export interface TdProjectile {
  id: number;
  x: number;
  y: number;
  speed: number;
  damage: number;
  kind: ProjectileKind;
  splashRadius: number;
  slowPct: number;
  slowDurationS: number;
  targetEnemyId: number;
  ownerTowerId: number;
  color: string;
  radius: number;
  active: boolean;
}

let nextProjId = 1;

/** True homing (velocity recomputed toward the live target position every frame) rather than
 * ballistic lead — at Ember Ward's projectile speeds/enemy speeds this reads the same to the eye
 * but avoids whiffed shots against slowed/redirected targets, which would feel unfair in a genre
 * where the player can't dodge on the enemy's behalf. */
export function spawnProjectile(origin: Vec2, target: EnemyInstance, speed: number, damage: number, kind: ProjectileKind, color: string, radius: number, ownerTowerId: number, splashRadius = 0, slowPct = 0, slowDurationS = 0): TdProjectile {
  return {
    id: nextProjId++,
    x: origin.x,
    y: origin.y,
    speed,
    damage,
    kind,
    splashRadius,
    slowPct,
    slowDurationS,
    targetEnemyId: target.id,
    ownerTowerId,
    color,
    radius,
    active: true,
  };
}

const HIT_RADIUS = 12;

export function updateProjectiles(projectiles: TdProjectile[], enemies: EnemyInstance[], dt: number, onHit: (p: TdProjectile, target: EnemyInstance) => void): void {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    const target = enemies.find((e) => e.id === p.targetEnemyId);
    if (!target) {
      projectiles.splice(i, 1);
      continue;
    }
    const dx = target.pos.x - p.x;
    const dy = target.pos.y - p.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= HIT_RADIUS) {
      onHit(p, target);
      projectiles.splice(i, 1);
      continue;
    }
    const nx = dx / dist;
    const ny = dy / dist;
    p.x += nx * p.speed * dt;
    p.y += ny * p.speed * dt;
  }
}

export interface ZapEffect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  life: number;
  maxLife: number;
}

/** Finds the primary target plus up to (chainCount - 1) additional nearby, not-yet-hit enemies for
 * lightning's instant chain — each subsequent link picks the nearest remaining candidate to the
 * *previous* link (a readable "arcs outward" path rather than jumping randomly). */
export function resolveChainTargets(primary: EnemyInstance, enemies: EnemyInstance[], chainCount: number, chainRangePx: number): EnemyInstance[] {
  const chain: EnemyInstance[] = [primary];
  const hitIds = new Set<number>([primary.id]);
  let from = primary;
  while (chain.length < chainCount) {
    let best: EnemyInstance | null = null;
    let bestDist = Infinity;
    for (const e of enemies) {
      if (hitIds.has(e.id)) continue;
      const d = Math.hypot(e.pos.x - from.pos.x, e.pos.y - from.pos.y);
      if (d <= chainRangePx && d < bestDist) {
        bestDist = d;
        best = e;
      }
    }
    if (!best) break;
    chain.push(best);
    hitIds.add(best.id);
    from = best;
  }
  return chain;
}
