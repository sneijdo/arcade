import type { Vec2 } from './types';
import { vSub, vNorm, vAngle, vDist } from './types';

export interface BossInstance {
  pos: Vec2;
  hp: number;
  maxHp: number;
  radius: number;
  facing: number;
  hitFlash: number;
  phase: 'idle' | 'burst' | 'slamTelegraph' | 'slamResolve';
  phaseTimer: number;
  burstShotsRemaining: number;
  burstsSinceSlam: number;
  slamTarget: Vec2;
}

export const BOSS_MAX_HP = 620;
export const BOSS_RADIUS = 28;
const SLAM_RADIUS = 130;
const SLAM_TELEGRAPH_S = 1.1;
const BURST_SHOT_INTERVAL_S = 0.16;
const BURST_SHOTS = 4;
const MOVE_SPEED = 60;

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
}

/** Two telegraphed mechanics (burst-fire, ground slam) — "mechanics > HP inflation" per spec, kept simple for the vertical slice. */
export function updateBoss(b: BossInstance, playerPos: Vec2, dt: number, arenaW: number, arenaH: number): BossUpdateResult {
  if (b.hitFlash > 0) b.hitFlash -= dt;
  const toPlayer = vSub(playerPos, b.pos);
  b.facing = vAngle(toPlayer);
  const result: BossUpdateResult = {};

  const dist = vDist(playerPos, b.pos);
  if (dist > 260) {
    const dir = vNorm(toPlayer);
    b.pos.x += dir.x * MOVE_SPEED * dt;
    b.pos.y += dir.y * MOVE_SPEED * dt;
    b.pos.x = Math.max(b.radius, Math.min(arenaW - b.radius, b.pos.x));
    b.pos.y = Math.max(b.radius, Math.min(arenaH - b.radius, b.pos.y));
  }

  b.phaseTimer -= dt;
  if (b.phase === 'idle') {
    if (b.phaseTimer <= 0) {
      if (b.burstsSinceSlam >= 2) {
        b.phase = 'slamTelegraph';
        b.phaseTimer = SLAM_TELEGRAPH_S;
        b.slamTarget = { ...playerPos };
        b.burstsSinceSlam = 0;
      } else {
        b.phase = 'burst';
        b.burstShotsRemaining = BURST_SHOTS;
        b.phaseTimer = BURST_SHOT_INTERVAL_S;
      }
    }
  } else if (b.phase === 'burst') {
    if (b.phaseTimer <= 0 && b.burstShotsRemaining > 0) {
      result.fireShot = { angleRad: b.facing, damage: 9 };
      b.burstShotsRemaining--;
      b.phaseTimer = BURST_SHOT_INTERVAL_S;
      if (b.burstShotsRemaining <= 0) {
        b.phase = 'idle';
        b.phaseTimer = 1.0;
        b.burstsSinceSlam++;
      }
    }
  } else if (b.phase === 'slamTelegraph') {
    if (b.phaseTimer <= 0) {
      b.phase = 'slamResolve';
      b.phaseTimer = 0.1;
      result.slamNowResolving = { center: b.slamTarget, radius: SLAM_RADIUS, damage: 26 };
    }
  } else if (b.phase === 'slamResolve') {
    if (b.phaseTimer <= 0) {
      b.phase = 'idle';
      b.phaseTimer = 1.3;
    }
  }

  return result;
}
