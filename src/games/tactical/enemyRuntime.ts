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
}

let nextEnemyId = 1;

export function spawnEnemy(defId: EnemyId, pos: Vec2): EnemyInstance {
  const def = ENEMY_DEFS[defId];
  return {
    id: nextEnemyId++,
    defId,
    pos: { ...pos },
    hp: def.hp,
    maxHp: def.hp,
    telegraphRemaining: 0,
    telegraphTotal: 0,
    attackCooldownRemaining: 0.5 + Math.random() * 0.6,
    hitFlash: 0,
    facing: 0,
    isMelee: def.preferredRange === 0,
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

  if (e.telegraphRemaining > 0) {
    e.telegraphRemaining -= dt;
    if (e.telegraphRemaining <= 0) {
      e.attackCooldownRemaining = def.attackCooldown;
      if (e.isMelee) {
        if (dist <= def.attackRange + 20) result.meleeAttack = { from: e, damage: def.damage };
      } else {
        result.rangedAttack = { from: e, angleRad: e.facing, damage: def.damage };
      }
    }
    return result; // holding position while telegraphing
  }

  // Movement: melee rushers close distance; ranged types try to hold preferredRange.
  const dir = vNorm(toPlayer);
  let moveDir: Vec2 = { x: 0, y: 0 };
  if (e.isMelee) {
    moveDir = dir;
  } else {
    const rangeError = dist - def.preferredRange;
    if (Math.abs(rangeError) > 24) {
      moveDir = rangeError > 0 ? dir : { x: -dir.x, y: -dir.y };
    }
  }
  e.pos.x += moveDir.x * def.moveSpeed * dt;
  e.pos.y += moveDir.y * def.moveSpeed * dt;
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
      if (e.isMelee) result.meleeAttack = { from: e, damage: def.damage };
    }
  }

  return result;
}
