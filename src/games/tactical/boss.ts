import type { Vec2, BossId } from './types';
import { vSub, vNorm, vAngle, vDist } from './types';
import { BALANCE } from './balance';

export interface BossInstance {
  bossId: BossId;
  pos: Vec2;
  hp: number;
  maxHp: number;
  radius: number;
  facing: number;
  hitFlash: number;
  /** Deliberately a plain string, not a fixed union — each boss owns its own phase names, dispatched on bossId, so adding a boss never means widening a shared enum. */
  phase: string;
  phaseTimer: number;
  // commander-only
  burstShotsRemaining: number;
  burstsSinceSlam: number;
  slamTarget: Vec2;
  // harbinger-only
  sweepShotsRemaining: number;
  sweepAngle: number;
  summonsSinceSweep: number;
  /** Endless-mode room scaling (see roomScaleMults in tactical.ts), baked into every damage
   * number this boss deals — hp scaling is baked directly into hp/maxHp at spawn instead. */
  dmgMult: number;
}

export const BOSS_NAMES: Record<BossId, string> = {
  commander: 'ARMORED COMMANDER',
  harbinger: 'SWARM HARBINGER',
};

const ALL_BOSS_IDS: BossId[] = ['commander', 'harbinger'];

export function pickBossId(): BossId {
  return ALL_BOSS_IDS[Math.floor(Math.random() * ALL_BOSS_IDS.length)];
}

export function spawnBoss(pos: Vec2, bossId: BossId, hpMult = 1, dmgMult = 1): BossInstance {
  const baseMaxHp = bossId === 'harbinger' ? BALANCE.harbinger.maxHp : BALANCE.boss.maxHp;
  const maxHp = baseMaxHp * hpMult;
  const radius = bossId === 'harbinger' ? BALANCE.harbinger.radius : BALANCE.boss.radius;
  return {
    bossId,
    pos: { ...pos },
    hp: maxHp,
    maxHp,
    radius,
    facing: 0,
    hitFlash: 0,
    phase: 'idle',
    phaseTimer: 1.2,
    burstShotsRemaining: 0,
    burstsSinceSlam: 0,
    slamTarget: { ...pos },
    sweepShotsRemaining: 0,
    sweepAngle: 0,
    summonsSinceSweep: 0,
    dmgMult,
  };
}

export interface BossUpdateResult {
  fireShot?: { angleRad: number; damage: number };
  slamNowResolving?: { center: Vec2; radius: number; damage: number };
  enteredBurstWindup?: boolean;
  /** Harbinger only — tactical.ts spawns `count` regular enemies of `defId` when this fires. */
  summonAdds?: { count: number; defId: 'suppressor' | 'rusher' };
  enteredSummonTelegraph?: boolean;
  enteredSweepWindup?: boolean;
}

/** Dispatches to the active boss's own state machine — see updateCommander/updateHarbinger below. Shared bookkeeping (facing, approach movement, hit-flash decay) happens once here so neither boss implementation has to repeat it. */
export function updateBoss(b: BossInstance, playerPos: Vec2, dt: number, arenaW: number, arenaH: number): BossUpdateResult {
  if (b.hitFlash > 0) b.hitFlash -= dt;
  const toPlayer = vSub(playerPos, b.pos);
  const dist = vDist(playerPos, b.pos);
  const engageDistance = b.bossId === 'harbinger' ? BALANCE.harbinger.engageDistance : BALANCE.boss.engageDistance;
  const moveSpeed = b.bossId === 'harbinger' ? BALANCE.harbinger.moveSpeed : BALANCE.boss.moveSpeed;
  const holdFacing = b.phase === 'slamTelegraph';
  if (!holdFacing) b.facing = vAngle(toPlayer);
  if (dist > engageDistance && b.phase === 'idle') {
    const dir = vNorm(toPlayer);
    b.pos.x += dir.x * moveSpeed * dt;
    b.pos.y += dir.y * moveSpeed * dt;
    b.pos.x = Math.max(b.radius, Math.min(arenaW - b.radius, b.pos.x));
    b.pos.y = Math.max(b.radius, Math.min(arenaH - b.radius, b.pos.y));
  }

  b.phaseTimer -= dt;
  return b.bossId === 'harbinger' ? updateHarbinger(b, playerPos) : updateCommander(b, playerPos);
}

/** Original boss: telegraphed burst-fire volleys, escalating to a telegraphed ground slam every couple of bursts. "Mechanics > HP inflation" per spec. */
function updateCommander(b: BossInstance, playerPos: Vec2): BossUpdateResult {
  const result: BossUpdateResult = {};
  const BURST_WINDUP_S = 0.35;

  if (b.phase === 'idle') {
    if (b.phaseTimer <= 0) {
      if (b.burstsSinceSlam >= BALANCE.boss.burstsBeforeSlam) {
        b.phase = 'slamTelegraph';
        b.phaseTimer = BALANCE.boss.slamTelegraphS;
        b.slamTarget = { ...playerPos };
        b.burstsSinceSlam = 0;
      } else {
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
      result.fireShot = { angleRad: b.facing, damage: BALANCE.boss.burstDamage * b.dmgMult };
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
      result.slamNowResolving = { center: b.slamTarget, radius: BALANCE.boss.slamRadius, damage: BALANCE.boss.slamDamage * b.dmgMult };
    }
  } else if (b.phase === 'slamResolve') {
    if (b.phaseTimer <= 0) {
      b.phase = 'idle';
      b.phaseTimer = BALANCE.boss.postSlamGapS;
    }
  }

  return result;
}

/** Second boss: pressures with summoned adds instead of direct burst damage, then punctuates with a wide rotating projectile sweep instead of one ground slam — same "telegraphed, learnable" spirit, different verb (crowd control vs. a single big hit). */
function updateHarbinger(b: BossInstance, playerPos: Vec2): BossUpdateResult {
  const result: BossUpdateResult = {};
  const B = BALANCE.harbinger;

  if (b.phase === 'idle') {
    if (b.phaseTimer <= 0) {
      if (b.summonsSinceSweep >= B.summonsBeforeSweep) {
        b.phase = 'sweepWindup';
        b.phaseTimer = B.sweepWindupS;
        b.sweepAngle = vAngle(vSub(playerPos, b.pos)) - B.sweepArcRad / 2;
        result.enteredSweepWindup = true;
      } else {
        b.phase = 'summonTelegraph';
        b.phaseTimer = B.summonTelegraphS;
        result.enteredSummonTelegraph = true;
      }
    }
  } else if (b.phase === 'summonTelegraph') {
    if (b.phaseTimer <= 0) {
      result.summonAdds = { count: B.summonCount, defId: Math.random() < 0.5 ? 'suppressor' : 'rusher' };
      b.summonsSinceSweep++;
      b.phase = 'idle';
      b.phaseTimer = B.summonGapS;
    }
  } else if (b.phase === 'sweepWindup') {
    if (b.phaseTimer <= 0) {
      b.phase = 'sweeping';
      b.sweepShotsRemaining = B.sweepShots;
      b.phaseTimer = B.sweepShotIntervalS;
    }
  } else if (b.phase === 'sweeping') {
    if (b.phaseTimer <= 0 && b.sweepShotsRemaining > 0) {
      const progress = 1 - (b.sweepShotsRemaining - 1) / Math.max(1, B.sweepShots - 1);
      const angle = b.sweepAngle + B.sweepArcRad * progress;
      result.fireShot = { angleRad: angle, damage: B.sweepDamage * b.dmgMult };
      b.sweepShotsRemaining--;
      b.phaseTimer = B.sweepShotIntervalS;
      if (b.sweepShotsRemaining <= 0) {
        b.phase = 'idle';
        b.phaseTimer = B.postSweepGapS;
        b.summonsSinceSweep = 0;
      }
    }
  }

  return result;
}
