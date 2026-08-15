export interface Projectile {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  crit: boolean;
  penetration: number;
  ricochetChance: number;
  maxRange: number;
  traveled: number;
  fromPlayer: boolean;
  radius: number;
  color: string;
  hitIds: Set<number>;
  /** Pixels the target is shoved away from the impact — 0 for most weapons. */
  knockback: number;
  /** On impact, also damages other enemies within this radius — 0 for most weapons. */
  splashRadius: number;
}

/** Fixed-size pool — combat never Instantiates/Destroys projectiles, just flips `active`. */
export class ProjectilePool {
  private pool: Projectile[];

  constructor(size = 400) {
    this.pool = Array.from({ length: size }, () => ({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      damage: 0,
      crit: false,
      penetration: 0,
      ricochetChance: 0,
      maxRange: 0,
      traveled: 0,
      fromPlayer: true,
      radius: 4,
      color: '#c9f73e',
      hitIds: new Set<number>(),
      knockback: 0,
      splashRadius: 0,
    }));
  }

  spawn(init: Omit<Projectile, 'active' | 'traveled' | 'hitIds' | 'knockback' | 'splashRadius'> & { knockback?: number; splashRadius?: number }): Projectile | null {
    const p = this.pool.find((p) => !p.active);
    if (!p) return null;
    p.active = true;
    p.x = init.x;
    p.y = init.y;
    p.vx = init.vx;
    p.vy = init.vy;
    p.damage = init.damage;
    p.crit = init.crit;
    p.penetration = init.penetration;
    p.ricochetChance = init.ricochetChance;
    p.maxRange = init.maxRange;
    p.traveled = 0;
    p.fromPlayer = init.fromPlayer;
    p.radius = init.radius;
    p.color = init.color;
    p.hitIds.clear();
    p.knockback = init.knockback ?? 0;
    p.splashRadius = init.splashRadius ?? 0;
    return p;
  }

  active(): Projectile[] {
    return this.pool.filter((p) => p.active);
  }

  update(dt: number): void {
    for (const p of this.pool) {
      if (!p.active) continue;
      const dx = p.vx * dt;
      const dy = p.vy * dt;
      p.x += dx;
      p.y += dy;
      p.traveled += Math.hypot(dx, dy);
      if (p.traveled >= p.maxRange) p.active = false;
    }
  }

  deactivate(p: Projectile): void {
    p.active = false;
  }

  clear(): void {
    for (const p of this.pool) p.active = false;
  }
}
