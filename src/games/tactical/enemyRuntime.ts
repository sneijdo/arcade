import type { Vec2, EnemyId } from './types';
import { vSub, vNorm, vDist, vAngle } from './types';
import { ENEMY_DEFS } from './enemies';

export interface EnemyInstance {
  id: number;
  defId: EnemyId;
  pos: Vec2;
  hp: number;
  maxHp: number;
  /** >0 while winding up a telegraphed ranged attack — render a warning indicator. */
  telegraphRemaining: number;
  telegraphTotal: number;
  attackCooldownRemaining: number;
  hitFlash: number;
  facing: number;
  isMelee: boolean;
  /** True if this specific spawned instance rolled the elite modifier — makes ANY base type elite at runtime, not just defs with a static isElite flag. Scales hp/damage/moveSpeed and reuses the same harder-to-hit strafing behavior. */
  eliteMod: boolean;
  /** Endless-mode room scaling (see roomScaleMults in tactical.ts) — baked into hp at spawn time, kept here so updateEnemy can apply it to per-hit damage too. 1 for every room up through the story campaign. */
  dmgMult: number;
}

let nextEnemyId = 1;

const ELITE_HP_MULT = 1.75;
const ELITE_DAMAGE_MULT = 1.4;
const ELITE_MOVESPEED_MULT = 1.15;

export function spawnEnemy(defId: EnemyId, pos: Vec2, eliteChance = 0, hpMult = 1, dmgMult = 1): EnemyInstance {
  const def = ENEMY_DEFS[defId];
  const eliteMod = Math.random() < eliteChance;
  const hp = (eliteMod ? def.hp * ELITE_HP_MULT : def.hp) * hpMult;
  return {
    id: nextEnemyId++,
    defId,
    pos: { ...pos },
    hp,
    maxHp: hp,
    telegraphRemaining: 0,
    telegraphTotal: 0,
    attackCooldownRemaining: 0.5 + Math.random() * 0.6,
    hitFlash: 0,
    facing: 0,
    isMelee: def.preferredRange === 0,
    eliteMod,
    dmgMult,
  };
}

export interface RangedAttackEvent {
  from: EnemyInstance;
  angleRad: number;
  damage: number;
}
export interface MeleeAttackEvent {
  from: EnemyInstance;
  damage: number;
}

export interface EnemyUpdateResult {
  rangedAttack?: RangedAttackEvent;
  meleeAttack?: MeleeAttackEvent;
}

/**
 * Shared movement + attack state machine for every enemy type — the
 * per-type "personality" comes entirely from EnemyStats data
 * (preferredRange/attackRange/telegraphMs), not from separate classes,
 * so a new enemy is a data entry, not new code.
 */
export function updateEnemy(e: EnemyInstance, playerPos: Vec2, dt: number, arenaW: number, arenaH: number): EnemyUpdateResult {
  const def = ENEMY_DEFS[e.defId];
  const toPlayer = vSub(playerPos, e.pos);
  const dist = vDist(playerPos, e.pos);
  e.facing = vAngle(toPlayer);
  if (e.hitFlash > 0) e.hitFlash -= dt;

  const result: EnemyUpdateResult = {};
  const dmg = (e.eliteMod ? def.damage * ELITE_DAMAGE_MULT : def.damage) * e.dmgMult;
  const moveSpeed = e.eliteMod ? def.moveSpeed * ELITE_MOVESPEED_MULT : def.moveSpeed;

  if (e.telegraphRemaining > 0) {
    e.telegraphRemaining -= dt;
    if (e.telegraphRemaining <= 0) {
      e.attackCooldownRemaining = def.attackCooldown;
      if (e.isMelee) {
        if (dist <= def.attackRange + 20) result.meleeAttack = { from: e, damage: dmg };
      } else {
        result.rangedAttack = { from: e, angleRad: e.facing, damage: dmg };
      }
    }
    return result; // holding position while telegraphing
  }

  // Movement: melee closes distance, ranged types try to hold preferredRange —
  // with two per-archetype twists layered on top of that shared base:
  //   - flanker arcs in from the side instead of beelining, so it can hit a
  //     player who's turned to face a different threat.
  //   - any elite strafes side-to-side once roughly at its preferred range,
  //     so it's a harder target to land shots on rather than just more HP.
  const dir = vNorm(toPlayer);
  const perp: Vec2 = { x: -dir.y, y: dir.x };
  // Deterministic (not random-per-frame) so the strafe/arc direction doesn't jitter.
  const sideSign = e.id % 2 === 0 ? 1 : -1;
  let moveDir: Vec2 = { x: 0, y: 0 };
  if (e.defId === 'flanker') {
    const arcWeight = Math.min(1, Math.max(0, (dist - 70) / 220)); // fades out as it closes in for the hit
    moveDir = vNorm({ x: dir.x + perp.x * sideSign * arcWeight * 1.3, y: dir.y + perp.y * sideSign * arcWeight * 1.3 });
  } else if (e.isMelee) {
    moveDir = dir;
  } else {
    const rangeError = dist - def.preferredRange;
    if (Math.abs(rangeError) > 24) {
      moveDir = rangeError > 0 ? dir : { x: -dir.x, y: -dir.y };
    } else if (def.isElite || e.eliteMod) {
      moveDir = { x: perp.x * sideSign, y: perp.y * sideSign };
    }
  }
  e.pos.x += moveDir.x * moveSpeed * dt;
  e.pos.y += moveDir.y * moveSpeed * dt;
  e.pos.x = Math.max(def.radius, Math.min(arenaW - def.radius, e.pos.x));
  e.pos.y = Math.max(def.radius, Math.min(arenaH - def.radius, e.pos.y));

  if (e.attackCooldownRemaining > 0) {
    e.attackCooldownRemaining -= dt;
  } else if (dist <= def.attackRange) {
    e.telegraphRemaining = (def.telegraphMs ?? 0) / 1000;
    e.telegraphTotal = e.telegraphRemaining;
    if (e.telegraphRemaining <= 0) {
      // instant (untelegraphed melee) attacks resolve immediately
      e.attackCooldownRemaining = def.attackCooldown;
      if (e.isMelee) result.meleeAttack = { from: e, damage: dmg };
    }
  }

  return result;
}
