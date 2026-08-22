import { finishGameSession } from '../../state';
import { gameUtilBarHtml, wireGameChrome } from '../../gameChrome';
import { ScoreKinds } from '../../scoring';
import { Haptics } from '../../haptics';
import { Sound } from '../../sound';
import { VfxSystem } from '../shared/vfx';
import { ProjectilePool } from '../shared/projectiles';
import { vDist, type Vec2 } from '../shared/vec';

/**
 * Colossus — a single boss-rush encounter. No aiming, no loadout: the player's only job is
 * positioning. Standing within melee range of the boss deals steady passive damage; every attack
 * pattern telegraphs before it hurts, so losing HP always means "I read that wrong or was greedy
 * for damage," never "I couldn't have known." Score is total damage dealt (capped at the boss's
 * max HP by a full kill) — desc, like every other ranked game here — so both survival time and
 * how aggressively the player leans into the melee-range risk/reward feed the same number.
 */

const BALANCE = {
  player: { radius: 12, moveSpeed: 260, maxHp: 100, meleeRange: 150, dps: 9, iframesS: 0.5 },
  boss: { radius: 72, maxHp: 320 },
  cooldownByPhase: [1.6, 1.2, 0.9] as const,
  slam: { telegraphS: 0.7, activeS: 0.25, radius: 90, damage: 26 },
  ring: { telegraphS: 0.4, speed: 230, band: 16, damage: 22 },
  barrage: { telegraphS: 0.55, orbCount: 5, orbSpeed: 210, orbRadius: 11, damage: 14, spreadDeg: 26 },
};

type AttackKind = 'slam' | 'ring' | 'barrage';
interface AttackSlam {
  kind: 'slam';
  phase: 'telegraph' | 'active' | 'done';
  timer: number;
  targetPos: Vec2;
  hasHit: boolean;
}
interface AttackRing {
  kind: 'ring';
  phase: 'telegraph' | 'growing' | 'done';
  timer: number;
  radius: number;
  hasHitPlayer: boolean;
}
interface AttackBarrage {
  kind: 'barrage';
  phase: 'telegraph' | 'done';
  timer: number;
}
type BossAttack = AttackSlam | AttackRing | AttackBarrage;

interface PlayerState {
  pos: Vec2;
  radius: number;
  hp: number;
  maxHp: number;
  iframesRemaining: number;
  hitFlash: number;
}

interface BossState {
  pos: Vec2;
  radius: number;
  hp: number;
  maxHp: number;
  phase: number;
  cooldownRemaining: number;
  attack: BossAttack | null;
  lastKind: AttackKind | null;
}

type RunPhase = 'intro' | 'playing' | 'victory' | 'gameover';

interface RunState {
  phase: RunPhase;
  player: PlayerState;
  boss: BossState;
  projectiles: ProjectilePool;
  vfx: VfxSystem;
  damageDealt: number;
  meleeTickTimer: number;
  arenaW: number;
  arenaH: number;
  canvas: HTMLCanvasElement | null;
  ctx: CanvasRenderingContext2D | null;
  rafId: number | null;
  lastTime: number;
  pointerTarget: Vec2 | null;
  keys: Set<string>;
}

let run: RunState | null = null;
let stars: { x: number; y: number; r: number; phase: number }[] = [];

function makeRunState(): RunState {
  return {
    phase: 'intro',
    player: { pos: { x: 380, y: 470 }, radius: BALANCE.player.radius, hp: BALANCE.player.maxHp, maxHp: BALANCE.player.maxHp, iframesRemaining: 0, hitFlash: 0 },
    boss: { pos: { x: 380, y: 200 }, radius: BALANCE.boss.radius, hp: BALANCE.boss.maxHp, maxHp: BALANCE.boss.maxHp, phase: 0, cooldownRemaining: 1.2, attack: null, lastKind: null },
    projectiles: new ProjectilePool(64),
    vfx: new VfxSystem(),
    damageDealt: 0,
    meleeTickTimer: 0,
    arenaW: 760,
    arenaH: 570,
    canvas: null,
    ctx: null,
    rafId: null,
    lastTime: 0,
    pointerTarget: null,
    keys: new Set(),
  };
}

export function renderColossusGame(): void {
  if (run?.rafId != null) cancelAnimationFrame(run.rafId);
  window.removeEventListener('resize', resizeCanvas);
  window.removeEventListener('keydown', onKeyDown);
  window.removeEventListener('keyup', onKeyUp);
  run = makeRunState();
  const main = document.getElementById('main')!;
  main.innerHTML = `
    <div class="page">
      <div class="cl-shell">
        <div class="cl-hud-top">
          <div class="cl-bar-group">
            <div class="cl-bar-track boss"><div class="cl-bar-fill boss" id="clBossFill" style="width:100%"></div></div>
            <div class="cl-bar-label">KOLOSSEN</div>
          </div>
          <div class="cl-bar-group">
            <div class="cl-bar-track hp"><div class="cl-bar-fill hp" id="clHpFill" style="width:100%"></div></div>
            <div class="cl-bar-label">DIG</div>
          </div>
        </div>
        ${gameUtilBarHtml()}
        <div class="cl-canvas-wrap" id="clCanvasWrap">
          <canvas id="clCanvas"></canvas>
          <div class="cl-dmg-counter" id="clDmgCounter">0 SKADE</div>
        </div>
      </div>
    </div>
  `;
  const canvas = document.getElementById('clCanvas') as HTMLCanvasElement;
  run.canvas = canvas;
  run.ctx = canvas.getContext('2d');
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);

  wireGameChrome('colossus', renderColossusGame);
  void showIntroThenStart();
}

function resizeCanvas(): void {
  if (!run?.canvas) return;
  const rect = run.canvas.parentElement!.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  run.canvas.width = Math.round(rect.width * dpr);
  run.canvas.height = Math.round(rect.height * dpr);
  run.arenaW = rect.width;
  run.arenaH = rect.height;
  run.boss.pos = { x: run.arenaW / 2, y: run.arenaH * 0.34 };
  if (run.phase === 'intro') run.player.pos = { x: run.arenaW / 2, y: run.arenaH * 0.82 };
  run.ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);

  stars = Array.from({ length: 44 }, () => ({
    x: Math.random() * run!.arenaW,
    y: Math.random() * run!.arenaH,
    r: 0.6 + Math.random() * 1.4,
    phase: Math.random() * Math.PI * 2,
  }));
}

async function showIntroThenStart(): Promise<void> {
  if (!run) return;
  const wrap = document.getElementById('clCanvasWrap')!;
  const overlay = document.createElement('div');
  overlay.id = 'clIntroOverlay';
  overlay.style.cssText = 'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:rgba(6,4,12,.88);z-index:5;padding:20px;text-align:center';
  overlay.innerHTML = `
    <div class="hero-tag">BOSSKAMP</div>
    <div class="arena-title" style="margin:0">Kolossen vågner</div>
    <p style="color:var(--text-dim);font-size:12.5px;max-width:320px;line-height:1.5;margin:0">
      Bliv tæt på kolossen for at gøre skade. Alle angreb varsles, flyt dig i tide.
      Sejr eller død, din skade tæller.
    </p>
    <button class="btn btn-primary btn-lg" id="clStartBtn">START</button>
  `;
  wrap.appendChild(overlay);
  document.getElementById('clStartBtn')!.addEventListener('click', () => {
    Sound.click();
    overlay.remove();
    startRun();
  });
}

function startRun(): void {
  if (!run) return;
  run.phase = 'playing';
  run.lastTime = performance.now();
  run.rafId = requestAnimationFrame(loop);
}

// ---- Input -----------------------------------------------------------------

function canvasPoint(e: PointerEvent): Vec2 {
  const rect = run!.canvas!.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}
function onPointerDown(e: PointerEvent): void {
  if (!run || !e.isPrimary) return;
  run.pointerTarget = canvasPoint(e);
}
function onPointerMove(e: PointerEvent): void {
  if (!run || !e.isPrimary || !run.pointerTarget) return;
  run.pointerTarget = canvasPoint(e);
}
function onPointerUp(e: PointerEvent): void {
  if (!run || !e.isPrimary) return;
  run.pointerTarget = null;
}
const MOVE_KEYS = new Set(['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd']);
function onKeyDown(e: KeyboardEvent): void {
  if (!run) return;
  const k = e.key.toLowerCase();
  if (MOVE_KEYS.has(k)) run.keys.add(k);
}
function onKeyUp(e: KeyboardEvent): void {
  if (!run) return;
  run.keys.delete(e.key.toLowerCase());
}

function keyboardVector(keys: Set<string>): Vec2 {
  let x = 0;
  let y = 0;
  if (keys.has('arrowleft') || keys.has('a')) x -= 1;
  if (keys.has('arrowright') || keys.has('d')) x += 1;
  if (keys.has('arrowup') || keys.has('w')) y -= 1;
  if (keys.has('arrowdown') || keys.has('s')) y += 1;
  if (x === 0 && y === 0) return { x: 0, y: 0 };
  const len = Math.hypot(x, y);
  return { x: x / len, y: y / len };
}

// ---- Audio -------------------------------------------------------------

const ColossusSound = {
  telegraph(): void {
    Sound.tone(180, 0.16, 'sawtooth', 0.07);
  },
  hurt(): void {
    Sound.tone(140, 0.14, 'sawtooth', 0.1);
    Sound.tone(90, 0.18, 'sawtooth', 0.08, 0.04);
  },
  tick(): void {
    Sound.tone(320, 0.035, 'triangle', 0.035);
  },
  victory(): void {
    Sound.tone(392, 0.12, 'sine', 0.11);
    Sound.tone(523, 0.14, 'sine', 0.11, 0.1);
    Sound.tone(659, 0.16, 'sine', 0.12, 0.2);
    Sound.tone(880, 0.34, 'sine', 0.13, 0.32);
  },
};

// ---- Boss AI -------------------------------------------------------------

function bossPhaseFor(hpFraction: number): number {
  if (hpFraction <= 1 / 3) return 2;
  if (hpFraction <= 2 / 3) return 1;
  return 0;
}

function pickAttackKind(lastKind: AttackKind | null): AttackKind {
  const pool: AttackKind[] = ['slam', 'ring', 'barrage'];
  const options = lastKind ? pool.filter((k) => k !== lastKind) : pool;
  return options[Math.floor(Math.random() * options.length)];
}

function startAttack(r: RunState): void {
  const kind = pickAttackKind(r.boss.lastKind);
  r.boss.lastKind = kind;
  ColossusSound.telegraph();
  if (kind === 'slam') {
    r.boss.attack = { kind: 'slam', phase: 'telegraph', timer: BALANCE.slam.telegraphS, targetPos: { ...r.player.pos }, hasHit: false };
  } else if (kind === 'ring') {
    r.boss.attack = { kind: 'ring', phase: 'telegraph', timer: BALANCE.ring.telegraphS, radius: 0, hasHitPlayer: false };
  } else {
    r.boss.attack = { kind: 'barrage', phase: 'telegraph', timer: BALANCE.barrage.telegraphS };
  }
}

function fireBarrage(r: RunState): void {
  const b = BALANCE.barrage;
  const aimAngle = Math.atan2(r.player.pos.y - r.boss.pos.y, r.player.pos.x - r.boss.pos.x);
  const spreadRad = (b.spreadDeg * Math.PI) / 180;
  for (let i = 0; i < b.orbCount; i++) {
    const t = b.orbCount > 1 ? i / (b.orbCount - 1) - 0.5 : 0;
    const angle = aimAngle + t * spreadRad;
    r.projectiles.spawn({
      x: r.boss.pos.x,
      y: r.boss.pos.y,
      vx: Math.cos(angle) * b.orbSpeed,
      vy: Math.sin(angle) * b.orbSpeed,
      damage: b.damage,
      crit: false,
      penetration: 0,
      ricochetChance: 0,
      maxRange: 1400,
      fromPlayer: false,
      radius: b.orbRadius,
      color: '#c9a6ff',
    });
  }
  r.vfx.muzzleFlash(r.boss.pos, aimAngle);
}

function damagePlayer(r: RunState, amount: number): void {
  if (r.player.iframesRemaining > 0) return;
  r.player.hp = Math.max(0, r.player.hp - amount);
  r.player.iframesRemaining = BALANCE.player.iframesS;
  r.player.hitFlash = 0.25;
  r.vfx.impactSpark(r.player.pos, '#ff5d7a');
  r.vfx.shake(9);
  Haptics.miss();
  ColossusSound.hurt();
}

function updateAttack(r: RunState, dt: number): void {
  const attack = r.boss.attack;
  if (!attack) return;

  if (attack.kind === 'slam') {
    if (attack.phase === 'telegraph') {
      attack.timer -= dt;
      if (attack.timer <= 0) {
        attack.phase = 'active';
        attack.timer = BALANCE.slam.activeS;
        if (!attack.hasHit && vDist(r.player.pos, attack.targetPos) <= BALANCE.slam.radius) {
          damagePlayer(r, BALANCE.slam.damage);
          attack.hasHit = true;
        }
        r.vfx.shake(5);
      }
    } else if (attack.phase === 'active') {
      attack.timer -= dt;
      if (attack.timer <= 0) attack.phase = 'done';
    }
  } else if (attack.kind === 'ring') {
    if (attack.phase === 'telegraph') {
      attack.timer -= dt;
      if (attack.timer <= 0) attack.phase = 'growing';
    } else if (attack.phase === 'growing') {
      attack.radius += BALANCE.ring.speed * dt;
      const distToPlayer = vDist(r.player.pos, r.boss.pos);
      if (!attack.hasHitPlayer && Math.abs(attack.radius - distToPlayer) < BALANCE.ring.band) {
        damagePlayer(r, BALANCE.ring.damage);
        attack.hasHitPlayer = true;
      }
      if (attack.radius > Math.hypot(r.arenaW, r.arenaH) + 40) attack.phase = 'done';
    }
  } else {
    if (attack.phase === 'telegraph') {
      attack.timer -= dt;
      if (attack.timer <= 0) {
        fireBarrage(r);
        attack.phase = 'done';
      }
    }
  }

  const isDone = attack.phase === 'done';
  if (isDone) {
    r.boss.attack = null;
    r.boss.phase = bossPhaseFor(r.boss.hp / r.boss.maxHp);
    r.boss.cooldownRemaining = BALANCE.cooldownByPhase[r.boss.phase];
  }
}

// ---- Update loop -----------------------------------------------------------

function loop(now: number): void {
  if (!run || !run.canvas || !document.body.contains(run.canvas)) {
    cleanup();
    return;
  }
  const dt = Math.min(0.05, (now - run.lastTime) / 1000);
  run.lastTime = now;
  if (run.phase === 'playing') update(dt);
  render();
  run.rafId = requestAnimationFrame(loop);
}

function cleanup(): void {
  if (run?.rafId != null) cancelAnimationFrame(run.rafId);
  window.removeEventListener('resize', resizeCanvas);
  window.removeEventListener('keydown', onKeyDown);
  window.removeEventListener('keyup', onKeyUp);
  run = null;
}

function update(dt: number): void {
  if (!run) return;
  const r = run;
  const p = r.player;

  // movement — hold-to-drag on touch, or arrow/WASD on desktop; keyboard wins if both are active.
  const kbVec = keyboardVector(r.keys);
  let moveVec: Vec2 = kbVec;
  if (kbVec.x === 0 && kbVec.y === 0 && r.pointerTarget) {
    const toTarget = { x: r.pointerTarget.x - p.pos.x, y: r.pointerTarget.y - p.pos.y };
    const dist = Math.hypot(toTarget.x, toTarget.y);
    const step = BALANCE.player.moveSpeed * dt;
    if (dist <= step) {
      p.pos = { ...r.pointerTarget };
      moveVec = { x: 0, y: 0 };
    } else {
      moveVec = { x: toTarget.x / dist, y: toTarget.y / dist };
    }
  }
  if (moveVec.x !== 0 || moveVec.y !== 0) {
    p.pos.x += moveVec.x * BALANCE.player.moveSpeed * dt;
    p.pos.y += moveVec.y * BALANCE.player.moveSpeed * dt;
  }
  const pad = BALANCE.player.radius + 4;
  p.pos.x = Math.max(pad, Math.min(r.arenaW - pad, p.pos.x));
  p.pos.y = Math.max(pad, Math.min(r.arenaH - pad, p.pos.y));

  if (p.iframesRemaining > 0) p.iframesRemaining -= dt;
  if (p.hitFlash > 0) p.hitFlash -= dt;

  // passive melee damage while in range of the boss
  if (r.boss.hp > 0 && vDist(p.pos, r.boss.pos) <= BALANCE.player.meleeRange) {
    const dmg = Math.min(BALANCE.player.dps * dt, r.boss.hp);
    r.boss.hp -= dmg;
    r.damageDealt += dmg;
    r.meleeTickTimer -= dt;
    if (r.meleeTickTimer <= 0) {
      r.meleeTickTimer = 0.35;
      ColossusSound.tick();
      r.vfx.impactSpark({ x: (p.pos.x + r.boss.pos.x) / 2, y: (p.pos.y + r.boss.pos.y) / 2 }, '#8b6bff');
    }
  }

  // boss attack state machine
  if (r.boss.hp > 0) {
    if (!r.boss.attack) {
      r.boss.cooldownRemaining -= dt;
      if (r.boss.cooldownRemaining <= 0) startAttack(r);
    } else {
      updateAttack(r, dt);
    }
  }

  // boss projectiles vs player
  r.projectiles.update(dt);
  for (const proj of r.projectiles.active()) {
    if (!proj.fromPlayer && vDist({ x: proj.x, y: proj.y }, p.pos) <= proj.radius + BALANCE.player.radius) {
      damagePlayer(r, proj.damage);
      r.projectiles.deactivate(proj);
    }
  }

  r.vfx.update(dt);

  if (r.boss.hp <= 0) {
    endRun(true);
  } else if (p.hp <= 0) {
    endRun(false);
  }
}

// ---- End of run --------------------------------------------------------

function endRun(won: boolean): void {
  if (!run || run.phase !== 'playing') return;
  run.phase = won ? 'victory' : 'gameover';
  if (won) {
    run.vfx.shake(14);
    ColossusSound.victory();
  } else {
    Sound.mistake();
  }
  void finishSession(won);
}

async function finishSession(won: boolean): Promise<void> {
  if (!run) return;
  const score = Math.round(run.damageDealt);
  const { isNewBest, xpGain, rank } = await finishGameSession('colossus', score);
  Sound.complete();
  if (isNewBest) {
    setTimeout(() => Sound.pb(), 250);
    Haptics.personalBest();
  }
  drawFinalScreen(score, isNewBest, xpGain, rank, won);
}

function drawFinalScreen(score: number, isNewBest: boolean, xpGain: number, rank: number | null, won: boolean): void {
  const main = document.getElementById('main')!;
  const rating = ScoreKinds.colossus_damage.rating(score);
  main.innerHTML = `
    <div class="page">
      <div class="game-shell">
        <div class="final-wrap">
          <div class="final-label">${won ? '🏆 Kolossen er besejret' : 'Du faldt for Kolossen'}</div>
          <div class="final-score">${score}<span style="font-size:26px">skade</span></div>
          <div class="final-rating" style="color:${rating.color}">${rating.label}</div>
          ${isNewBest ? '<div class="pb-flag">★ NY PERSONLIG REKORD</div>' : ''}
          <div class="xp-toast">✦ +${xpGain} XP optjent${rank && rank <= 3 ? ' · TOP 3-BONUS' : ''}</div>

          <div class="final-stats">
            <div class="fstat"><div class="n">${score}</div><div class="l">Skade</div></div>
            <div class="fstat"><div class="n">${Math.round((score / BALANCE.boss.maxHp) * 100)}%</div><div class="l">Af kolossen</div></div>
            <div class="fstat"><div class="n">${won ? '✔' : '✘'}</div><div class="l">Besejret</div></div>
            <div class="fstat"><div class="n">+${xpGain}</div><div class="l">XP optjent</div></div>
          </div>

          <div class="final-ctas">
            <button class="btn btn-primary btn-lg" id="playAgainBtn">SPIL IGEN</button>
            <button class="btn btn-ghost btn-lg" data-nav="leaderboard-colossus">LEADERBOARD</button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.getElementById('playAgainBtn')!.addEventListener('click', () => {
    Sound.click();
    renderColossusGame();
  });
}

// ---- Render ---------------------------------------------------------------

function drawBoss(ctx: CanvasRenderingContext2D, r: RunState): void {
  const b = r.boss;
  const telegraphing = b.attack?.phase === 'telegraph';
  const enrageColor = b.phase === 2 ? '#ff5d7a' : b.phase === 1 ? '#c9a6ff' : '#8b6bff';

  // melee-range ring (affordance for "stand here")
  ctx.strokeStyle = 'rgba(139,107,255,.16)';
  ctx.setLineDash([5, 7]);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(b.pos.x, b.pos.y, BALANCE.player.meleeRange, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // tentacle spikes
  ctx.fillStyle = '#1c1330';
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const len = b.radius * (0.35 + (i % 2) * 0.15);
    const bx = b.pos.x + Math.cos(a) * b.radius * 0.9;
    const by = b.pos.y + Math.sin(a) * b.radius * 0.9;
    const tx = b.pos.x + Math.cos(a) * (b.radius * 0.9 + len);
    const ty = b.pos.y + Math.sin(a) * (b.radius * 0.9 + len);
    const perpX = -Math.sin(a) * 10;
    const perpY = Math.cos(a) * 10;
    ctx.beginPath();
    ctx.moveTo(bx + perpX, by + perpY);
    ctx.lineTo(tx, ty);
    ctx.lineTo(bx - perpX, by - perpY);
    ctx.closePath();
    ctx.fill();
  }

  // body
  const bodyGrad = ctx.createRadialGradient(b.pos.x - 20, b.pos.y - 24, 8, b.pos.x, b.pos.y, b.radius);
  bodyGrad.addColorStop(0, '#3a2a54');
  bodyGrad.addColorStop(1, '#150d22');
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.arc(b.pos.x, b.pos.y, b.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = `${enrageColor}55`;
  ctx.lineWidth = 3;
  ctx.stroke();

  // eye
  const eyeGlow = telegraphing ? 1 : 0.6;
  const eyeR = b.radius * 0.28 * (telegraphing ? 1.15 : 1);
  ctx.fillStyle = 'rgba(10,6,16,.9)';
  ctx.beginPath();
  ctx.ellipse(b.pos.x, b.pos.y - b.radius * 0.05, eyeR * 1.3, eyeR, 0, 0, Math.PI * 2);
  ctx.fill();
  const irisGrad = ctx.createRadialGradient(b.pos.x, b.pos.y - b.radius * 0.05, 1, b.pos.x, b.pos.y - b.radius * 0.05, eyeR);
  irisGrad.addColorStop(0, telegraphing ? '#ffb3c0' : '#e6d4ff');
  irisGrad.addColorStop(1, enrageColor);
  ctx.fillStyle = irisGrad;
  ctx.globalAlpha = eyeGlow;
  ctx.beginPath();
  ctx.ellipse(b.pos.x, b.pos.y - b.radius * 0.05, eyeR, eyeR * 0.8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#0a0610';
  ctx.beginPath();
  ctx.ellipse(b.pos.x, b.pos.y - b.radius * 0.05, eyeR * 0.28, eyeR * 0.62, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawAttackTelegraphs(ctx: CanvasRenderingContext2D, r: RunState): void {
  const attack = r.boss.attack;
  if (!attack) return;

  if (attack.kind === 'slam') {
    const alpha = attack.phase === 'telegraph' ? 0.35 + 0.35 * Math.sin(performance.now() / 60) : 0.5;
    ctx.strokeStyle = `rgba(255,93,122,${attack.phase === 'active' ? 0 : alpha})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(attack.targetPos.x, attack.targetPos.y, BALANCE.slam.radius, 0, Math.PI * 2);
    ctx.stroke();
    if (attack.phase === 'active') {
      ctx.fillStyle = 'rgba(255,93,122,.4)';
      ctx.beginPath();
      ctx.arc(attack.targetPos.x, attack.targetPos.y, BALANCE.slam.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (attack.kind === 'ring') {
    ctx.strokeStyle = attack.phase === 'growing' ? 'rgba(201,166,255,.65)' : 'rgba(201,166,255,.3)';
    ctx.lineWidth = attack.phase === 'growing' ? 4 : 2;
    ctx.beginPath();
    ctx.arc(r.boss.pos.x, r.boss.pos.y, Math.max(0, attack.radius), 0, Math.PI * 2);
    ctx.stroke();
  } else if (attack.kind === 'barrage') {
    const t = 1 - attack.timer / BALANCE.barrage.telegraphS;
    ctx.fillStyle = `rgba(201,166,255,${0.15 + t * 0.35})`;
    ctx.beginPath();
    ctx.arc(r.boss.pos.x, r.boss.pos.y, r.boss.radius * (0.5 + t * 0.5), 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPlayer(ctx: CanvasRenderingContext2D, r: RunState): void {
  const p = r.player;
  const flicker = p.iframesRemaining > 0 ? 0.5 + 0.5 * Math.sin(performance.now() / 40) : 1;
  ctx.globalAlpha = flicker;
  const glow = ctx.createRadialGradient(p.pos.x, p.pos.y, 1, p.pos.x, p.pos.y, p.radius * 2.2);
  glow.addColorStop(0, 'rgba(92,201,255,.5)');
  glow.addColorStop(1, 'rgba(92,201,255,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(p.pos.x, p.pos.y, p.radius * 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = p.hitFlash > 0 ? '#ffffff' : '#bfe9ff';
  ctx.beginPath();
  ctx.arc(p.pos.x, p.pos.y, p.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#5cc9ff';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function render(): void {
  if (!run?.ctx || !run.canvas) return;
  const ctx = run.ctx;
  const r = run;

  ctx.clearRect(0, 0, r.arenaW, r.arenaH);
  const bg = ctx.createRadialGradient(r.arenaW / 2, r.arenaH * 0.34, 20, r.arenaW / 2, r.arenaH * 0.5, Math.max(r.arenaW, r.arenaH) * 0.8);
  bg.addColorStop(0, '#1c1330');
  bg.addColorStop(1, '#07050c');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, r.arenaW, r.arenaH);

  const now = performance.now();
  for (const s of stars) {
    ctx.globalAlpha = 0.35 + 0.35 * Math.sin(now / 900 + s.phase);
    ctx.fillStyle = '#c9c2ff';
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  drawBoss(ctx, r);
  drawAttackTelegraphs(ctx, r);

  for (const proj of r.projectiles.active()) {
    ctx.fillStyle = proj.color;
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, proj.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  drawPlayer(ctx, r);
  r.vfx.render(ctx, r.arenaW, r.arenaH);

  const bossFill = document.getElementById('clBossFill');
  if (bossFill) bossFill.style.width = `${Math.max(0, (r.boss.hp / r.boss.maxHp) * 100)}%`;
  const hpFill = document.getElementById('clHpFill');
  if (hpFill) hpFill.style.width = `${Math.max(0, (r.player.hp / r.player.maxHp) * 100)}%`;
  const dmgCounter = document.getElementById('clDmgCounter');
  if (dmgCounter) dmgCounter.textContent = `${Math.round(r.damageDealt)} SKADE`;
}
