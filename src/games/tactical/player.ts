import type { Vec2, WeaponStats, BuildStats } from './types';

const BASE_MOVE_SPEED = 210;
const BASE_MAX_HP = 100;
const PLAYER_RADIUS = 15;
/** How quickly velocity snaps toward the input direction — high value = crisp, non-floaty stop (spec: "avoid floaty movement"). */
const ACCEL = 22;

export class Player {
  pos: Vec2 = { x: 0, y: 0 };
  vel: Vec2 = { x: 0, y: 0 };
  facing = 0; // radians
  hp = BASE_MAX_HP;
  maxHp = BASE_MAX_HP;
  radius = PLAYER_RADIUS;
  fireCooldownRemaining = 0;
  invulnRemaining = 0;

  reset(spawnPos: Vec2, build: BuildStats): void {
    this.pos = { ...spawnPos };
    this.vel = { x: 0, y: 0 };
    this.maxHp = BASE_MAX_HP + build.maxHpBonus;
    this.hp = this.maxHp;
    this.fireCooldownRemaining = 0;
    this.invulnRemaining = 0;
  }

  applyBuildHpChange(build: BuildStats): void {
    const newMax = BASE_MAX_HP + build.maxHpBonus;
    const delta = newMax - this.maxHp;
    this.maxHp = newMax;
    if (delta > 0) this.hp = Math.min(this.maxHp, this.hp + delta);
  }

  effectiveMoveSpeed(build: BuildStats): number {
    return BASE_MOVE_SPEED * build.moveSpeedMult;
  }

  /** Movement has priority over firing — moving heavily restricts/pauses shooting, per spec. */
  update(dt: number, moveVec: Vec2, build: BuildStats): boolean {
    const speed = this.effectiveMoveSpeed(build);
    const target = { x: moveVec.x * speed, y: moveVec.y * speed };
    const isMoving = Math.hypot(moveVec.x, moveVec.y) > 0.05;
    const lerpFactor = Math.min(1, ACCEL * dt);
    this.vel.x += (target.x - this.vel.x) * lerpFactor;
    this.vel.y += (target.y - this.vel.y) * lerpFactor;
    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;
    if (this.fireCooldownRemaining > 0) this.fireCooldownRemaining -= dt;
    if (this.invulnRemaining > 0) this.invulnRemaining -= dt;
    return isMoving;
  }

  canFire(): boolean {
    return this.fireCooldownRemaining <= 0;
  }

  fireCooldownFor(weapon: WeaponStats, build: BuildStats): number {
    const fireRate = weapon.fireRate * build.fireRateMult;
    return 1 / Math.max(0.1, fireRate);
  }

  takeDamage(amount: number, build: BuildStats): number {
    if (this.invulnRemaining > 0) return 0;
    const reduced = amount * (1 - build.damageReduction);
    this.hp = Math.max(0, this.hp - reduced);
    this.invulnRemaining = 0.15; // brief i-frame so one telegraph doesn't multi-tick damage
    return reduced;
  }

  heal(amount: number): void {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  isDead(): boolean {
    return this.hp <= 0;
  }

  clampToArena(width: number, height: number): void {
    this.pos.x = Math.max(this.radius, Math.min(width - this.radius, this.pos.x));
    this.pos.y = Math.max(this.radius, Math.min(height - this.radius, this.pos.y));
  }
}
