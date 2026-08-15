import type { Vec2 } from './types';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  fade: boolean;
}

interface DamageNumber {
  x: number;
  y: number;
  vy: number;
  life: number;
  maxLife: number;
  text: string;
  color: string;
  crit: boolean;
}

/**
 * Lightweight pooled particle/juice system — muzzle flash, impact sparks,
 * death bursts, damage numbers, and screen shake all live here so the
 * render loop stays a single readable pass instead of scattering effect
 * bookkeeping across every gameplay system.
 */
export class VfxSystem {
  private particles: Particle[] = [];
  private pool: Particle[] = [];
  private damageNumbers: DamageNumber[] = [];
  private shakeMagnitude = 0;
  private shakeDecay = 0;

  private spawnParticle(p: Particle): void {
    const free = this.pool.pop();
    const target = free ?? ({} as Particle);
    Object.assign(target, p);
    this.particles.push(target);
  }

  muzzleFlash(pos: Vec2, angleRad: number): void {
    for (let i = 0; i < 3; i++) {
      const spread = (Math.random() - 0.5) * 0.5;
      const a = angleRad + spread;
      this.spawnParticle({
        x: pos.x,
        y: pos.y,
        vx: Math.cos(a) * 260,
        vy: Math.sin(a) * 260,
        life: 0.06,
        maxLife: 0.06,
        size: 4 + Math.random() * 3,
        color: '#ffe9a8',
        fade: true,
      });
    }
  }

  impactSpark(pos: Vec2, color = '#ff5d7a'): void {
    for (let i = 0; i < 5; i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 140;
      this.spawnParticle({
        x: pos.x,
        y: pos.y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        life: 0.18 + Math.random() * 0.1,
        maxLife: 0.28,
        size: 2 + Math.random() * 2,
        color,
        fade: true,
      });
    }
  }

  deathBurst(pos: Vec2, color: string): void {
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 220;
      this.spawnParticle({
        x: pos.x,
        y: pos.y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        life: 0.3 + Math.random() * 0.3,
        maxLife: 0.6,
        size: 3 + Math.random() * 3,
        color,
        fade: true,
      });
    }
  }

  damageNumber(pos: Vec2, amount: number, crit: boolean): void {
    this.damageNumbers.push({
      x: pos.x + (Math.random() - 0.5) * 10,
      y: pos.y,
      vy: -55,
      life: 0.7,
      maxLife: 0.7,
      text: Math.round(amount).toString(),
      color: crit ? '#ffcf4d' : '#f3f2fa',
      crit,
    });
  }

  shake(magnitude: number): void {
    this.shakeMagnitude = Math.max(this.shakeMagnitude, magnitude);
    this.shakeDecay = magnitude / 0.25;
  }

  getShakeOffset(): Vec2 {
    if (this.shakeMagnitude <= 0) return { x: 0, y: 0 };
    const a = Math.random() * Math.PI * 2;
    return { x: Math.cos(a) * this.shakeMagnitude, y: Math.sin(a) * this.shakeMagnitude };
  }

  update(dt: number): void {
    if (this.shakeMagnitude > 0) {
      this.shakeMagnitude = Math.max(0, this.shakeMagnitude - this.shakeDecay * dt);
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        this.pool.push(p);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.9;
      p.vy *= 0.9;
    }
    for (let i = this.damageNumbers.length - 1; i >= 0; i--) {
      const d = this.damageNumbers[i];
      d.life -= dt;
      if (d.life <= 0) {
        this.damageNumbers.splice(i, 1);
        continue;
      }
      d.y += d.vy * dt;
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      const alpha = p.fade ? Math.max(0, p.life / p.maxLife) : 1;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    for (const d of this.damageNumbers) {
      const alpha = Math.max(0, d.life / d.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = d.color;
      ctx.font = d.crit ? 'bold 20px "JetBrains Mono", monospace' : '600 15px "JetBrains Mono", monospace';
      ctx.fillText(d.text, d.x, d.y);
    }
    ctx.globalAlpha = 1;
  }

  clear(): void {
    this.particles.length = 0;
    this.damageNumbers.length = 0;
    this.shakeMagnitude = 0;
  }
}
