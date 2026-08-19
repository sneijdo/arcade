import { finishGameSession } from '../../state';
import { gameUtilBarHtml, wireGameChrome } from '../../gameChrome';
import { ScoreKinds } from '../../scoring';
import { Haptics } from '../../haptics';
import { Sound } from '../../sound';
import { VfxSystem } from '../shared/vfx';
import type { Vec2 } from '../shared/vec';

/**
 * Trajectory — drag-and-release slingshot physics. Pull back from the launch point, release to
 * fire a gravity-arc shot at a fresh balloon layout each round. 8 shots, sum of points popped is
 * the score (desc) — same "N attempts, sum points" shape as Drop Zone/Aim Trainer, just with real
 * trajectory planning instead of an instant tap. Bright carnival palette on purpose: everything
 * else in this app is dark, and a physics-arc game reads best against clear daylight.
 */

const BALANCE = {
  totalShots: 8,
  gravity: 780,
  // maxDragPx widened from 145 (felt clamped almost immediately) to 260, with powerMult scaled
  // down to match so the same pull distance still produces roughly the same shot speed/range —
  // more physical travel to work with, not just a stronger shot at the same short pull.
  powerMult: 3.6,
  maxDragPx: 260,
  minDragPx: 14,
  grabRadius: 70,
  ballRadius: 9,
};

interface Balloon {
  id: number;
  pos: Vec2;
  radius: number;
  points: number;
  color: string;
  popped: boolean;
}
interface Obstacle {
  x: number;
  y: number;
  w: number;
  h: number;
}
interface Ball {
  pos: Vec2;
  vel: Vec2;
}

type RunPhase = 'intro' | 'aiming' | 'flying' | 'gameover';

interface RunState {
  phase: RunPhase;
  shotIndex: number;
  score: number;
  balloons: Balloon[];
  obstacles: Obstacle[];
  ball: Ball | null;
  launchPos: Vec2;
  dragCurrent: Vec2 | null;
  vfx: VfxSystem;
  arenaW: number;
  arenaH: number;
  canvas: HTMLCanvasElement | null;
  ctx: CanvasRenderingContext2D | null;
  rafId: number | null;
  lastTime: number;
  nextBalloonId: number;
}

let run: RunState | null = null;
const BALLOON_COLORS = ['#ff5d7a', '#ffd23f', '#5cc9ff', '#8b6bff', '#7dd45a', '#ff8a3d'];

function makeRunState(): RunState {
  return {
    phase: 'intro',
    shotIndex: 1,
    score: 0,
    balloons: [],
    obstacles: [],
    ball: null,
    launchPos: { x: 90, y: 470 },
    dragCurrent: null,
    vfx: new VfxSystem(),
    arenaW: 760,
    arenaH: 540,
    canvas: null,
    ctx: null,
    rafId: null,
    lastTime: 0,
    nextBalloonId: 1,
  };
}

export function renderTrajectoryGame(): void {
  if (run?.rafId != null) cancelAnimationFrame(run.rafId);
  window.removeEventListener('resize', resizeCanvas);
  run = makeRunState();
  const main = document.getElementById('main')!;
  main.innerHTML = `
    <div class="page">
      <div class="tj-shell">
        <div class="tj-hud-top">
          <span class="tj-stat">🎯 <span id="tjScore">0</span></span>
          <span class="tj-stat tj-shots" id="tjShots">SKUD 1/${BALANCE.totalShots}</span>
        </div>
        ${gameUtilBarHtml()}
        <div class="tj-canvas-wrap" id="tjCanvasWrap">
          <canvas id="tjCanvas"></canvas>
        </div>
      </div>
    </div>
  `;
  const canvas = document.getElementById('tjCanvas') as HTMLCanvasElement;
  run.canvas = canvas;
  run.ctx = canvas.getContext('2d');
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerCancel);

  wireGameChrome('trajectory', renderTrajectoryGame);
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
  run.launchPos = { x: run.arenaW * 0.12, y: run.arenaH - 60 };
  run.ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
}

async function showIntroThenStart(): Promise<void> {
  if (!run) return;
  const wrap = document.getElementById('tjCanvasWrap')!;
  const overlay = document.createElement('div');
  overlay.id = 'tjIntroOverlay';
  overlay.style.cssText = 'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:rgba(10,20,40,.82);z-index:5;padding:20px;text-align:center';
  overlay.innerHTML = `
    <div class="hero-tag">SIGT & SKYD</div>
    <div class="arena-title" style="margin:0;color:#fff">Balloner venter</div>
    <p style="color:#dfe9ff;font-size:12.5px;max-width:320px;line-height:1.5;margin:0">
      Træk tilbage fra slyngen og slip for at skyde. ${BALANCE.totalShots} skud —
      ram så mange balloner som muligt. Mindre balloner giver flere point.
    </p>
    <button class="btn btn-primary btn-lg" id="tjStartBtn">START</button>
  `;
  wrap.appendChild(overlay);
  document.getElementById('tjStartBtn')!.addEventListener('click', () => {
    Sound.click();
    overlay.remove();
    startRun();
  });
}

function startRun(): void {
  if (!run) return;
  run.phase = 'aiming';
  generateLayout(run);
  updateHud();
  run.lastTime = performance.now();
  run.rafId = requestAnimationFrame(loop);
}

// ---- Layout generation -----------------------------------------------------

function circlesOverlap(a: Vec2, ar: number, b: Vec2, br: number): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) < ar + br + 18;
}

function generateLayout(r: RunState): void {
  const difficulty = r.shotIndex; // 1..totalShots
  const count = 3 + Math.min(2, Math.floor(difficulty / 3));
  const balloons: Balloon[] = [];
  let attempts = 0;
  while (balloons.length < count && attempts < 200) {
    attempts++;
    const sizeRoll = Math.random() + difficulty * 0.04;
    const radius = sizeRoll > 0.62 ? 16 : sizeRoll > 0.32 ? 22 : 30;
    const points = radius <= 16 ? 30 : radius <= 22 ? 20 : 10;
    const pos: Vec2 = {
      x: r.arenaW * (0.4 + Math.random() * 0.53),
      y: r.arenaH * (0.1 + Math.random() * 0.5),
    };
    if (balloons.some((b) => circlesOverlap(pos, radius, b.pos, b.radius))) continue;
    balloons.push({ id: r.nextBalloonId++, pos, radius, points, color: BALLOON_COLORS[Math.floor(Math.random() * BALLOON_COLORS.length)], popped: false });
  }

  const obstacles: Obstacle[] = [];
  const obstacleCount = difficulty >= 6 ? 2 : difficulty >= 4 ? 1 : 0;
  for (let i = 0; i < obstacleCount; i++) {
    obstacles.push({
      x: r.arenaW * (0.32 + Math.random() * 0.28 + i * 0.12),
      y: r.arenaH * (0.38 + Math.random() * 0.24),
      w: 56,
      h: 14,
    });
  }

  r.balloons = balloons;
  r.obstacles = obstacles;
  r.ball = null;
}

// ---- Input -------------------------------------------------------------

function canvasPoint(e: PointerEvent): Vec2 {
  const rect = run!.canvas!.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

let dragging = false;
function onPointerDown(e: PointerEvent): void {
  if (!run || !e.isPrimary || run.phase !== 'aiming') return;
  const pt = canvasPoint(e);
  if (Math.hypot(pt.x - run.launchPos.x, pt.y - run.launchPos.y) > BALANCE.grabRadius * 1.6) return;
  dragging = true;
  run.dragCurrent = pt;
}
function onPointerMove(e: PointerEvent): void {
  if (!run || !e.isPrimary || !dragging) return;
  run.dragCurrent = canvasPoint(e);
}
function onPointerUp(e: PointerEvent): void {
  if (!run || !e.isPrimary || !dragging) return;
  dragging = false;
  launchIfValid();
}
function onPointerCancel(): void {
  dragging = false;
  if (run) run.dragCurrent = null;
}

function launchIfValid(): void {
  if (!run || !run.dragCurrent) return;
  const pull = { x: run.launchPos.x - run.dragCurrent.x, y: run.launchPos.y - run.dragCurrent.y };
  const dist = Math.hypot(pull.x, pull.y);
  run.dragCurrent = null;
  if (dist < BALANCE.minDragPx) return;
  const clamped = Math.min(dist, BALANCE.maxDragPx);
  const nx = pull.x / dist;
  const ny = pull.y / dist;
  run.ball = { pos: { ...run.launchPos }, vel: { x: nx * clamped * BALANCE.powerMult, y: ny * clamped * BALANCE.powerMult } };
  run.phase = 'flying';
  Sound.tone(320, 0.07, 'triangle', 0.08);
}

// ---- Loop ------------------------------------------------------------------

function loop(now: number): void {
  if (!run || !run.canvas || !document.body.contains(run.canvas)) {
    cleanup();
    return;
  }
  const dt = Math.min(0.05, (now - run.lastTime) / 1000);
  run.lastTime = now;
  update(dt);
  render();
  run.rafId = requestAnimationFrame(loop);
}

function cleanup(): void {
  if (run?.rafId != null) cancelAnimationFrame(run.rafId);
  window.removeEventListener('resize', resizeCanvas);
  run = null;
}

function update(dt: number): void {
  if (!run) return;
  const r = run;
  r.vfx.update(dt);
  if (r.phase !== 'flying' || !r.ball) return;

  const ball = r.ball;
  ball.vel.y += BALANCE.gravity * dt;
  ball.pos.x += ball.vel.x * dt;
  ball.pos.y += ball.vel.y * dt;

  for (const balloon of r.balloons) {
    if (balloon.popped) continue;
    if (Math.hypot(ball.pos.x - balloon.pos.x, ball.pos.y - balloon.pos.y) <= balloon.radius + BALANCE.ballRadius) {
      balloon.popped = true;
      r.score += balloon.points;
      r.vfx.deathBurst(balloon.pos, balloon.color);
      r.vfx.damageNumber(balloon.pos, balloon.points, balloon.points >= 30);
      Sound.tone(520 + balloon.points * 4, 0.09, 'sine', 0.1);
      Haptics.hit();
      updateHud();
    }
  }

  for (const ob of r.obstacles) {
    if (ball.pos.x >= ob.x && ball.pos.x <= ob.x + ob.w && ball.pos.y >= ob.y && ball.pos.y <= ob.y + ob.h) {
      r.vfx.impactSpark(ball.pos, '#c9a37a');
      Sound.tone(160, 0.1, 'square', 0.08);
      endShot();
      return;
    }
  }

  if (ball.pos.y > r.arenaH + 30 || ball.pos.x < -30 || ball.pos.x > r.arenaW + 30) {
    endShot();
  }
}

function endShot(): void {
  if (!run) return;
  run.ball = null;
  run.shotIndex++;
  if (run.shotIndex > BALANCE.totalShots) {
    void finishSession();
    return;
  }
  run.phase = 'aiming';
  generateLayout(run);
  updateHud();
}

function updateHud(): void {
  if (!run) return;
  const scoreEl = document.getElementById('tjScore');
  if (scoreEl) scoreEl.textContent = `${run.score}`;
  const shotsEl = document.getElementById('tjShots');
  if (shotsEl) shotsEl.textContent = `SKUD ${Math.min(run.shotIndex, BALANCE.totalShots)}/${BALANCE.totalShots}`;
}

// ---- End of run --------------------------------------------------------

async function finishSession(): Promise<void> {
  if (!run) return;
  run.phase = 'gameover';
  const score = run.score;
  const { isNewBest, xpGain, rank } = await finishGameSession('trajectory', score);
  Sound.complete();
  if (isNewBest) {
    setTimeout(() => Sound.pb(), 250);
    Haptics.personalBest();
  }
  drawFinalScreen(score, isNewBest, xpGain, rank);
}

function drawFinalScreen(score: number, isNewBest: boolean, xpGain: number, rank: number | null): void {
  const main = document.getElementById('main')!;
  const rating = ScoreKinds.trajectory_score.rating(score);
  main.innerHTML = `
    <div class="page">
      <div class="game-shell">
        <div class="final-wrap">
          <div class="final-label">Point i alt</div>
          <div class="final-score">${score}<span style="font-size:26px">point</span></div>
          <div class="final-rating" style="color:${rating.color}">${rating.label}</div>
          ${isNewBest ? '<div class="pb-flag">★ NY PERSONLIG REKORD</div>' : ''}
          <div class="xp-toast">✦ +${xpGain} XP optjent${rank && rank <= 3 ? ' · TOP 3-BONUS' : ''}</div>

          <div class="final-stats">
            <div class="fstat"><div class="n">${score}</div><div class="l">Point</div></div>
            <div class="fstat"><div class="n">${BALANCE.totalShots}</div><div class="l">Skud</div></div>
            <div class="fstat"><div class="n">${(score / BALANCE.totalShots).toFixed(1)}</div><div class="l">Point/skud</div></div>
            <div class="fstat"><div class="n">+${xpGain}</div><div class="l">XP optjent</div></div>
          </div>

          <div class="final-ctas">
            <button class="btn btn-primary btn-lg" id="playAgainBtn">SPIL IGEN</button>
            <button class="btn btn-ghost btn-lg" data-nav="leaderboard-trajectory">LEADERBOARD</button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.getElementById('playAgainBtn')!.addEventListener('click', () => {
    Sound.click();
    renderTrajectoryGame();
  });
}

// ---- Render ---------------------------------------------------------------

function drawBalloon(ctx: CanvasRenderingContext2D, b: Balloon): void {
  if (b.popped) return;
  ctx.strokeStyle = 'rgba(0,0,0,.2)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(b.pos.x, b.pos.y + b.radius);
  ctx.lineTo(b.pos.x, b.pos.y + b.radius + 16);
  ctx.stroke();

  const grad = ctx.createRadialGradient(b.pos.x - b.radius * 0.35, b.pos.y - b.radius * 0.35, 2, b.pos.x, b.pos.y, b.radius);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.25, b.color);
  grad.addColorStop(1, b.color);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(b.pos.x, b.pos.y, b.radius * 0.85, b.radius, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.15)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = b.color;
  ctx.beginPath();
  ctx.moveTo(b.pos.x - 4, b.pos.y + b.radius - 1);
  ctx.lineTo(b.pos.x + 4, b.pos.y + b.radius - 1);
  ctx.lineTo(b.pos.x, b.pos.y + b.radius + 6);
  ctx.closePath();
  ctx.fill();
}

function drawTrajectoryPreview(ctx: CanvasRenderingContext2D, r: RunState): void {
  if (!r.dragCurrent) return;
  const pull = { x: r.launchPos.x - r.dragCurrent.x, y: r.launchPos.y - r.dragCurrent.y };
  const dist = Math.hypot(pull.x, pull.y);
  if (dist < BALANCE.minDragPx) return;
  const clamped = Math.min(dist, BALANCE.maxDragPx);
  const nx = pull.x / dist;
  const ny = pull.y / dist;
  let px = r.launchPos.x;
  let py = r.launchPos.y;
  let vx = nx * clamped * BALANCE.powerMult;
  let vy = ny * clamped * BALANCE.powerMult;
  ctx.fillStyle = 'rgba(255,255,255,.5)';
  for (let i = 0; i < 16; i++) {
    vy += BALANCE.gravity * 0.045;
    px += vx * 0.045;
    py += vy * 0.045;
    if (py > r.arenaH) break;
    ctx.beginPath();
    ctx.arc(px, py, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = 'rgba(255,210,63,.8)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(r.launchPos.x, r.launchPos.y);
  const dragClampedPos = { x: r.launchPos.x - nx * clamped, y: r.launchPos.y - ny * clamped };
  ctx.lineTo(dragClampedPos.x, dragClampedPos.y);
  ctx.stroke();
}

function render(): void {
  if (!run?.ctx || !run.canvas) return;
  const ctx = run.ctx;
  const r = run;
  ctx.clearRect(0, 0, r.arenaW, r.arenaH);

  const sky = ctx.createLinearGradient(0, 0, 0, r.arenaH);
  sky.addColorStop(0, '#4a9fe0');
  sky.addColorStop(0.7, '#a9d8f0');
  sky.addColorStop(1, '#e8f4e0');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, r.arenaW, r.arenaH);

  ctx.fillStyle = 'rgba(255,255,255,.75)';
  ctx.beginPath();
  ctx.ellipse(r.arenaW * 0.75, r.arenaH * 0.18, 42, 16, 0, 0, Math.PI * 2);
  ctx.ellipse(r.arenaW * 0.82, r.arenaH * 0.14, 30, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(r.arenaW * 0.18, r.arenaH * 0.1, 34, 13, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#7ab84a';
  ctx.fillRect(0, r.arenaH - 22, r.arenaW, 22);
  ctx.fillStyle = '#5a9a38';
  ctx.fillRect(0, r.arenaH - 22, r.arenaW, 4);

  // launch stand
  ctx.fillStyle = '#6b4a2f';
  ctx.fillRect(r.launchPos.x - 5, r.launchPos.y - 4, 10, 60);
  ctx.strokeStyle = '#4a3320';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(r.launchPos.x - 16, r.launchPos.y - 34);
  ctx.lineTo(r.launchPos.x, r.launchPos.y - 6);
  ctx.moveTo(r.launchPos.x + 16, r.launchPos.y - 34);
  ctx.lineTo(r.launchPos.x, r.launchPos.y - 6);
  ctx.stroke();

  for (const ob of r.obstacles) {
    ctx.fillStyle = '#8a6a45';
    ctx.fillRect(ob.x, ob.y, ob.w, ob.h);
    ctx.strokeStyle = '#5a4028';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(ob.x, ob.y, ob.w, ob.h);
  }

  for (const b of r.balloons) drawBalloon(ctx, b);

  if (r.phase === 'aiming') drawTrajectoryPreview(ctx, r);

  if (r.ball) {
    ctx.fillStyle = '#e05a3f';
    ctx.beginPath();
    ctx.arc(r.ball.pos.x, r.ball.pos.y, BALANCE.ballRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#8a2e1c';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  } else if (r.phase === 'aiming') {
    ctx.fillStyle = '#e05a3f';
    ctx.beginPath();
    ctx.arc(r.launchPos.x, r.launchPos.y, BALANCE.ballRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  r.vfx.render(ctx, r.arenaW, r.arenaH);
}
