import type { Vec2 } from './vec';

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

interface XpPop {
  x: number;
  y: number;
  vy: number;
  life: number;
  maxLife: number;
  text: string;
}

interface WarningFlash {
  colorRgb: string; // "r,g,b" for template use in rgba()
  remaining: number;
  total: number;
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
  private xpPops: XpPop[] = [];
  private warningFlash: WarningFlash | null = null;
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

  /**
   * Extra starburst on top of a normal impactSpark for crit hits — call
   * BOTH impactSpark(pos, color) AND this when a hit is a crit, don't
   * replace the normal one. Bigger, brighter, faster particles in the
   * crit gold so a crit reads as clearly more impactful mid-combat.
   */
  critBurst(pos: Vec2): void {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.random() * 0.2;
      const speed = 160 + Math.random() * 160;
      this.spawnParticle({
        x: pos.x,
        y: pos.y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        life: 0.22 + Math.random() * 0.08,
        maxLife: 0.3,
        size: 3 + Math.random() * 2,
        color: '#ffcf4d',
        fade: true,
      });
    }
  }

  /**
   * Small floating "+N XP" pop, offset to the side of a kill so it doesn't
   * stack directly on top of the (larger, same-moment) death damage number.
   * Call once per kill, at the enemy's death position.
   */
  xpPop(pos: Vec2, amount: number): void {
    this.xpPops.push({
      x: pos.x + 16,
      y: pos.y - 4,
      vy: -34,
      life: 0.55,
      maxLife: 0.55,
      text: `+${Math.round(amount)} XP`,
    });
  }

  /**
   * Screen-level warning for an elite or boss appearing — a radial particle
   * burst at centerPos plus a brief edge vignette pulse (rendered in
   * render(), which needs arenaW/arenaH passed to draw the vignette; if
   * omitted the vignette silently skips, particles still play).
   */
  warningBanner(kind: 'elite' | 'boss', centerPos: Vec2): void {
    const colorRgb = kind === 'boss' ? '255,93,122' : '139,107,255';
    const particleColor = kind === 'boss' ? '#ff5d7a' : '#8b6bff';
    const count = kind === 'boss' ? 22 : 14;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const speed = 90 + Math.random() * 180;
      this.spawnParticle({
        x: centerPos.x,
        y: centerPos.y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        life: 0.4 + Math.random() * 0.3,
        maxLife: 0.7,
        size: 3 + Math.random() * 3,
        color: particleColor,
        fade: true,
      });
    }
    const total = kind === 'boss' ? 0.9 : 0.6;
    this.warningFlash = { colorRgb, remaining: total, total };
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
    for (let i = this.xpPops.length - 1; i >= 0; i--) {
      const x = this.xpPops[i];
      x.life -= dt;
      if (x.life <= 0) {
        this.xpPops.splice(i, 1);
        continue;
      }
      x.y += x.vy * dt;
    }
    if (this.warningFlash) {
      this.warningFlash.remaining -= dt;
      if (this.warningFlash.remaining <= 0) this.warningFlash = null;
    }
  }

  render(ctx: CanvasRenderingContext2D, arenaW?: number, arenaH?: number): void {
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
    for (const x of this.xpPops) {
      const alpha = Math.max(0, x.life / x.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#c9f73e';
      ctx.font = '600 11px "JetBrains Mono", monospace';
      ctx.fillText(x.text, x.x, x.y);
    }
    ctx.globalAlpha = 1;

    // Edge vignette pulse for elite/boss warnings — needs arena size, so it
    // no-ops if the caller doesn't pass arenaW/arenaH (particles still show).
    if (this.warningFlash && arenaW != null && arenaH != null) {
      const f = this.warningFlash;
      const t = f.remaining / f.total; // 1 -> 0
      const pulse = 0.5 + 0.5 * Math.sin(t * Math.PI * 6);
      const alpha = t * 0.35 * pulse;
      const cx = arenaW / 2;
      const cy = arenaH / 2;
      const outerR = Math.hypot(arenaW, arenaH) / 2;
      const grad = ctx.createRadialGradient(cx, cy, outerR * 0.55, cx, cy, outerR);
      grad.addColorStop(0, `rgba(${f.colorRgb},0)`);
      grad.addColorStop(1, `rgba(${f.colorRgb},${alpha})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, arenaW, arenaH);
    }
  }

  clear(): void {
    this.particles.length = 0;
    this.damageNumbers.length = 0;
    this.xpPops.length = 0;
    this.warningFlash = null;
    this.shakeMagnitude = 0;
  }
}
