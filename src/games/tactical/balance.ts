/**
 * Single tunable source of truth for numbers that were previously scattered
 * across player.ts/boss.ts/tactical.ts. Per-weapon/per-enemy/per-upgrade
 * data stays in their own tables (weapons.ts/enemies.ts/upgrades.ts) since
 * those are already the "content" data-driven layer — this file is for
 * cross-cutting run/combat constants that don't belong to any one entity.
 */
export const BALANCE = {
  player: {
    baseMoveSpeed: 210,
    baseMaxHp: 100,
    radius: 15,
    /** Ramp-up smoothing when starting to move (per second, higher = snappier). Deceleration is instant, not lerped — see player.ts. */
    accelRate: 26,
    hitInvulnSeconds: 0.15,
  },
  boss: {
    maxHp: 620,
    radius: 28,
    moveSpeed: 60,
    engageDistance: 260,
    burstShots: 4,
    burstShotIntervalS: 0.16,
    burstDamage: 13,
    burstsBeforeSlam: 2,
    slamRadius: 130,
    slamTelegraphS: 1.1,
    slamDamage: 38,
    idleGapS: 1.0,
    postSlamGapS: 1.3,
  },
  /** Second boss ("Swarm Harbinger") — mechanics-different from the commander: pressure via summoned adds instead of burst fire, and a rotating projectile sweep instead of a single ground slam. */
  harbinger: {
    maxHp: 560,
    radius: 26,
    moveSpeed: 65,
    engageDistance: 300,
    summonTelegraphS: 0.8,
    summonCount: 2,
    summonGapS: 1.4,
    summonsBeforeSweep: 2,
    sweepWindupS: 0.5,
    sweepShots: 10,
    sweepShotIntervalS: 0.09,
    sweepArcRad: Math.PI * 1.6,
    sweepDamage: 12,
    idleGapS: 0.9,
    postSweepGapS: 1.2,
  },
  enemyProjectile: {
    speed: 380,
    bossSpeed: 420,
    maxRange: 700,
    bossMaxRange: 800,
  },
  xp: {
    baseForLevel: 18,
    perLevelGrowth: 13,
  },
  juice: {
    /** Brief freeze-frame on meaningful impacts (crits, kills, boss hits) — not every regular hit, or it starts feeling sluggish. */
    hitStopCritS: 0.05,
    hitStopKillS: 0.035,
    hitStopBossHitS: 0.03,
    /** Once a target is selected it's kept for this long (or until dead/out of range) instead of re-evaluating every shot — stops flicker between equidistant enemies. */
    targetLockSeconds: 0.6,
  },
} as const;
