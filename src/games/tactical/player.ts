import type { Vec2, WeaponStats, BuildStats } from './types';
import { BALANCE } from './balance';

export class Player {
  pos: Vec2 = { x: 0, y: 0 };
  vel: Vec2 = { x: 0, y: 0 };
  facing = 0; // radians
  hp: number = BALANCE.player.baseMaxHp;
  maxHp: number = BALANCE.player.baseMaxHp;
  radius: number = BALANCE.player.radius;
  fireCooldownRemaining = 0;
  invulnRemaining = 0;

  reset(spawnPos: Vec2, build: BuildStats): void {
    this.pos = { ...spawnPos };
    this.vel = { x: 0, y: 0 };
    this.maxHp = BALANCE.player.baseMaxHp + build.maxHpBonus;
    this.hp = this.maxHp;
    this.fireCooldownRemaining = 0;
    this.invulnRemaining = 0;
  }

  applyBuildHpChange(build: BuildStats): void {
    const newMax = BALANCE.player.baseMaxHp + build.maxHpBonus;
    const delta = newMax - this.maxHp;
    this.maxHp = newMax;
    if (delta > 0) this.hp = Math.min(this.maxHp, this.hp + delta);
  }

  effectiveMoveSpeed(build: BuildStats): number {
    return BALANCE.player.baseMoveSpeed * build.moveSpeedMult;
  }

  /**
   * Movement has priority over firing (spec). Deceleration is instant — the
   * moment input drops, velocity snaps to zero — because a coasting stop
   * makes both movement AND the stop-to-fire transition feel mushy and
   * unpredictable. Acceleration keeps a light ramp so starting to move
   * doesn't feel like teleporting.
   */
  update(dt: number, moveVec: Vec2, build: BuildStats): boolean {
    const speed = this.effectiveMoveSpeed(build);
    const isMoving = Math.hypot(moveVec.x, moveVec.y) > 0.05;
    if (isMoving) {
      const target = { x: moveVec.x * speed, y: moveVec.y * speed };
      const lerpFactor = Math.min(1, BALANCE.player.accelRate * dt);
      this.vel.x += (target.x - this.vel.x) * lerpFactor;
      this.vel.y += (target.y - this.vel.y) * lerpFactor;
    } else {
      this.vel.x = 0;
      this.vel.y = 0;
    }
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
    this.invulnRemaining = BALANCE.player.hitInvulnSeconds;
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
