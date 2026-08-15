export interface Vec2 {
  x: number;
  y: number;
}

export function vAdd(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}
export function vSub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}
export function vScale(a: Vec2, s: number): Vec2 {
  return { x: a.x * s, y: a.y * s };
}
export function vLen(a: Vec2): number {
  return Math.hypot(a.x, a.y);
}
export function vDist(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
export function vNorm(a: Vec2): Vec2 {
  const len = vLen(a);
  return len < 1e-6 ? { x: 0, y: 0 } : { x: a.x / len, y: a.y / len };
}
export function vAngle(a: Vec2): number {
  return Math.atan2(a.y, a.x);
}

export type WeaponId = 'viper_ar' | 'spectre_smg' | 'breach_shotgun' | 'longshot_rifle' | 'sidekick_pistol';

export interface WeaponStats {
  id: WeaponId;
  name: string;
  fireRate: number; // shots per second
  damage: number;
  projectileSpeed: number;
  projectileCount: number;
  spreadDeg: number;
  critChance: number; // 0-1
  critMultiplier: number;
  range: number;
  penetration: number; // number of enemies a projectile can pass through
}

export type EnemyId = 'rifleman' | 'rusher' | 'shotgunner' | 'sniper' | 'elite_rifleman' | 'flanker';

export interface EnemyStats {
  id: EnemyId;
  name: string;
  hp: number;
  moveSpeed: number;
  damage: number;
  attackCooldown: number;
  attackRange: number;
  preferredRange: number; // distance the enemy tries to maintain (0 for melee rushers)
  xpReward: number;
  radius: number;
  color: string;
  isElite?: boolean;
  telegraphMs?: number; // warning time before ranged attacks fire
}

export type UpgradeTag = 'offense' | 'movement' | 'projectile' | 'survival';

export interface UpgradeDef {
  id: string;
  name: string;
  icon: string;
  rarity: 'common' | 'rare' | 'epic';
  tag: UpgradeTag;
  desc: string;
  maxStacks: number;
  apply: (build: BuildStats) => void;
}

/** The player's current run-build — every upgrade mutates this. Weapon stats are derived from base * these multipliers. */
export interface BuildStats {
  damageMult: number;
  fireRateMult: number;
  critChance: number;
  critMultiplier: number;
  projectileCountBonus: number;
  projectileSpeedMult: number;
  penetrationBonus: number;
  rangeMult: number;
  moveSpeedMult: number;
  maxHpBonus: number;
  healOnKillChance: number;
  damageReduction: number; // 0-1, flat % reduction
  ricochetChance: number;
  lifestealPct: number;
}

export function makeDefaultBuild(): BuildStats {
  return {
    damageMult: 1,
    fireRateMult: 1,
    critChance: 0.05,
    critMultiplier: 1.5,
    projectileCountBonus: 0,
    projectileSpeedMult: 1,
    penetrationBonus: 0,
    rangeMult: 1,
    moveSpeedMult: 1,
    maxHpBonus: 0,
    healOnKillChance: 0,
    damageReduction: 0,
    ricochetChance: 0,
    lifestealPct: 0,
  };
}
