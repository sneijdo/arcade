import type { EnemyInstance, EnemyId } from './types';
import { ENEMY_DEFS } from './enemies';
import { pointAtPathDistance } from './path';

let nextEnemyId = 1;

export function spawnEnemy(defId: EnemyId, hpMult: number, speedMult: number, goldMult: number): EnemyInstance {
  const def = ENEMY_DEFS[defId];
  const hp = def.hp * hpMult;
  return {
    id: nextEnemyId++,
    defId,
    pathDist: 0,
    pos: { x: 0, y: 0 },
    facing: 0,
    hp,
    maxHp: hp,
    shieldHp: def.shieldHp ?? 0,
    shieldRegenCooldown: 0,
    hitFlash: 0,
    slowRemaining: 0,
    slowFactor: 1,
    hpMult,
    speedMult,
    goldMult,
  };
}

export interface EnemyMoveResult {
  reachedGate: boolean;
}

const SHIELD_REGEN_DELAY_S = 3;
const SHIELD_REGEN_PER_S = 12;

/**
 * Shared movement + status-effect update for every enemy type — like tactical/enemyRuntime.ts,
 * per-type "personality" comes from EnemyStats data (speed/shieldHp/berserkThresholdPct) plus one
 * external input (auraSpeedMult, resolved by the caller since it depends on OTHER enemies — see
 * applyShamanAuras in towerdefense.ts), not from separate per-enemy classes.
 */
export function updateEnemyMovement(e: EnemyInstance, dt: number, arenaW: number, arenaH: number, pathLenPx: number, auraSpeedMult: number): EnemyMoveResult {
  const def = ENEMY_DEFS[e.defId];
  if (e.hitFlash > 0) e.hitFlash -= dt;

  if (e.slowRemaining > 0) {
    e.slowRemaining -= dt;
    if (e.slowRemaining <= 0) e.slowFactor = 1;
  }

  // Shield regen: only once a few seconds have passed since last taking a hit — see applyDamage.
  if (e.shieldRegenCooldown > 0) {
    e.shieldRegenCooldown -= dt;
  } else if (def.shieldHp && e.shieldHp < def.shieldHp) {
    e.shieldHp = Math.min(def.shieldHp, e.shieldHp + SHIELD_REGEN_PER_S * dt);
  }

  let speed = def.speed * e.speedMult * e.slowFactor * auraSpeedMult;
  if (def.berserkThresholdPct != null && e.hp / e.maxHp <= def.berserkThresholdPct) {
    speed *= def.berserkSpeedMult ?? 1;
  }

  e.pathDist += speed * dt;
  const resolved = pointAtPathDistance(e.pathDist, arenaW, arenaH);
  e.pos = resolved.pos;
  e.facing = resolved.angle;

  return { reachedGate: e.pathDist >= pathLenPx };
}

export interface DamageResult {
  died: boolean;
  /** Damage that actually landed on real HP after any shield absorption — used for damage numbers. */
  hpDamageDealt: number;
}

/** Shield (if any) absorbs damage first — a hit that doesn't fully break the shield deals zero HP
 * damage but still resets the regen timer, so sustained fire keeps the shield from ever recovering
 * even before it's fully broken. */
export function applyEnemyDamage(e: EnemyInstance, amount: number): DamageResult {
  const def = ENEMY_DEFS[e.defId];
  e.hitFlash = 0.12;
  if (def.shieldHp && e.shieldHp > 0) {
    e.shieldRegenCooldown = SHIELD_REGEN_DELAY_S;
    const absorbed = Math.min(e.shieldHp, amount);
    e.shieldHp -= absorbed;
    const overflow = amount - absorbed;
    if (overflow <= 0) return { died: false, hpDamageDealt: 0 };
    e.hp -= overflow;
    return { died: e.hp <= 0, hpDamageDealt: overflow };
  }
  e.hp -= amount;
  return { died: e.hp <= 0, hpDamageDealt: amount };
}

export function applySlow(e: EnemyInstance, slowPct: number, durationS: number): void {
  // Strongest active slow wins outright (no stacking multipliers) — several frost towers hitting
  // the same target should read as "still slowed," not compound into a near-stop.
  const newFactor = 1 - slowPct;
  if (newFactor < e.slowFactor || e.slowRemaining <= 0) e.slowFactor = newFactor;
  e.slowRemaining = Math.max(e.slowRemaining, durationS);
}
