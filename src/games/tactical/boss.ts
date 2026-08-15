import type { Vec2 } from './types';
import { vSub, vNorm, vAngle, vDist } from './types';
import { BALANCE } from './balance';

export interface BossInstance {
  pos: Vec2;
  hp: number;
  maxHp: number;
  radius: number;
  facing: number;
  hitFlash: number;
  phase: 'idle' | 'burstWindup' | 'burst' | 'slamTelegraph' | 'slamResolve';
  phaseTimer: number;
  burstShotsRemaining: number;
  burstsSinceSlam: number;
  slamTarget: Vec2;
}

export const BOSS_MAX_HP = BALANCE.boss.maxHp;
export const BOSS_RADIUS = BALANCE.boss.radius;
const BURST_WINDUP_S = 0.35;

export function spawnBoss(pos: Vec2): BossInstance {
  return {
    pos: { ...pos },
    hp: BOSS_MAX_HP,
    maxHp: BOSS_MAX_HP,
    radius: BOSS_RADIUS,
    facing: 0,
    hitFlash: 0,
    phase: 'idle',
    phaseTimer: 1.2,
    burstShotsRemaining: 0,
    burstsSinceSlam: 0,
    slamTarget: { ...pos },
  };
}

export interface BossUpdateResult {
  fireShot?: { angleRad: number; damage: number };
  slamNowResolving?: { center: Vec2; radius: number; damage: number };
  enteredBurstWindup?: boolean;
}

/** Three telegraphed states (wind-up, burst-fire, ground slam) — "mechanics > HP inflation" per spec. */
export function updateBoss(b: BossInstance, playerPos: Vec2, dt: number, arenaW: number, arenaH: number): BossUpdateResult {
  if (b.hitFlash > 0) b.hitFlash -= dt;
  const toPlayer = vSub(playerPos, b.pos);
  const result: BossUpdateResult = {};

  const dist = vDist(playerPos, b.pos);
  if (b.phase !== 'slamTelegraph') b.facing = vAngle(toPlayer);
  if (dist > BALANCE.boss.engageDistance && b.phase === 'idle') {
    const dir = vNorm(toPlayer);
    b.pos.x += dir.x * BALANCE.boss.moveSpeed * dt;
    b.pos.y += dir.y * BALANCE.boss.moveSpeed * dt;
    b.pos.x = Math.max(b.radius, Math.min(arenaW - b.radius, b.pos.x));
    b.pos.y = Math.max(b.radius, Math.min(arenaH - b.radius, b.pos.y));
  }

  b.phaseTimer -= dt;
  if (b.phase === 'idle') {
    if (b.phaseTimer <= 0) {
      if (b.burstsSinceSlam >= BALANCE.boss.burstsBeforeSlam) {
        b.phase = 'slamTelegraph';
        b.phaseTimer = BALANCE.boss.slamTelegraphS;
        b.slamTarget = { ...playerPos };
        b.burstsSinceSlam = 0;
      } else {
        // brief visible wind-up before the burst starts, so the first shot isn't a total surprise
        b.phase = 'burstWindup';
        b.phaseTimer = BURST_WINDUP_S;
        result.enteredBurstWindup = true;
      }
    }
  } else if (b.phase === 'burstWindup') {
    if (b.phaseTimer <= 0) {
      b.phase = 'burst';
      b.burstShotsRemaining = BALANCE.boss.burstShots;
      b.phaseTimer = BALANCE.boss.burstShotIntervalS;
    }
  } else if (b.phase === 'burst') {
    if (b.phaseTimer <= 0 && b.burstShotsRemaining > 0) {
      result.fireShot = { angleRad: b.facing, damage: BALANCE.boss.burstDamage };
      b.burstShotsRemaining--;
      b.phaseTimer = BALANCE.boss.burstShotIntervalS;
      if (b.burstShotsRemaining <= 0) {
        b.phase = 'idle';
        b.phaseTimer = BALANCE.boss.idleGapS;
        b.burstsSinceSlam++;
      }
    }
  } else if (b.phase === 'slamTelegraph') {
    if (b.phaseTimer <= 0) {
      b.phase = 'slamResolve';
      b.phaseTimer = 0.1;
      result.slamNowResolving = { center: b.slamTarget, radius: BALANCE.boss.slamRadius, damage: BALANCE.boss.slamDamage };
    }
  } else if (b.phase === 'slamResolve') {
    if (b.phaseTimer <= 0) {
      b.phase = 'idle';
      b.phaseTimer = BALANCE.boss.postSlamGapS;
    }
  }

  return result;
}
