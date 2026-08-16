import { ScoreKinds } from '../../scoring';
import { Sound } from '../../sound';
import { Haptics } from '../../haptics';
import { finishGameSession } from '../../state';

const TOTAL_BALLS = 8;
const ROWS = 7;
const MAX_COLS = 7;
const PEG_R = 5;
const BALL_R = 8;
const TOP_MARGIN = 46;
const BOTTOM_MARGIN = 54;
const GRAVITY = 1500;
const RESTITUTION = 0.55;
const BIN_VALUES = [500, 100, 20, 10, 20, 100, 500];

type Phase = 'idle' | 'playing' | 'result';
type SubPhase = 'ready' | 'aiming' | 'falling';

interface Peg {
  x: number;
  y: number;
}

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface DropZoneState {
  phase: Phase;
  sub: SubPhase;
  ballsLeft: number;
  score: number;
  bestBinValue: number;
  pegs: Peg[];
  ball: Ball | null;
  arenaW: number;
  arenaH: number;
  aimX: number;
  rafId: number | null;
  lastT: number | null;
}

let state: DropZoneState = makeInitialState();

function makeInitialState(): DropZoneState {
  return {
    phase: 'idle',
    sub: 'ready',
    ballsLeft: TOTAL_BALLS,
    score: 0,
    bestBinValue: 0,
    pegs: [],
    ball: null,
    arenaW: 0,
    arenaH: 0,
    aimX: 0,
    rafId: null,
    lastT: null,
  };
}

function main(): HTMLElement {
  return document.getElementById('main')!;
}
function fieldEl(): HTMLElement | null {
  return document.getElementById('dzField');
}

export function renderDropZoneGame(): void {
  if (state.rafId != null) cancelAnimationFrame(state.rafId);
  state = makeInitialState();
  drawShell();
}

function drawShell(): void {
  main().innerHTML = `
    <div class="page">
      <div class="game-shell">
        <div class="game-topbar">
          <span id="dzBalls">DROP ZONE</span>
          <span id="dzScore" class="mono">0 POINT</span>
        </div>
        <div class="arena" id="arena"></div>
      </div>
    </div>
  `;
  drawArenaContent();
}

function drawArenaContent(): void {
  const a = document.getElementById('arena')!;
  a.className = 'arena';
  if (state.phase === 'idle') {
    a.innerHTML = `
      <div class="arena-inner">
        <div class="arena-title">Klar til at slippe?</div>
        <ul class="instructions-list">
          <li>Hold nede for at sigte, træk for at flytte, slip for at give slip på kuglen</li>
          <li>Kuglen rikochetterer gennem felterne ned i en boks</li>
          <li>Kant-boksene giver flest point — men er svære at ramme</li>
          <li>${TOTAL_BALLS} kugler — din samlede score tæller</li>
        </ul>
        <button class="btn btn-primary btn-lg" id="startBtn">START</button>
      </div>
    `;
    document.getElementById('startBtn')!.addEventListener('click', (e) => {
      e.stopPropagation();
      startSession();
    });
  } else if (state.phase === 'playing') {
    a.innerHTML = `
      <div class="dz-field" id="dzField">
        <div class="dz-guide" id="dzGuide"></div>
        <div class="dz-pegs" id="dzPegs"></div>
        <div class="dz-ball" id="dzBall"></div>
        <div class="dz-bins" id="dzBins">
          ${BIN_VALUES.map((v) => `<div class="dz-bin"><span>${v}</span></div>`).join('')}
        </div>
      </div>
    `;
    measureAndBuildPegs();
    wireControls();
    updateBallLabel();
  }
}

function measureAndBuildPegs(): void {
  const field = fieldEl();
  if (!field) return;
  state.arenaW = field.clientWidth;
  state.arenaH = field.clientHeight;
  state.pegs = buildPegs(state.arenaW, state.arenaH);
  const pegsEl = document.getElementById('dzPegs')!;
  pegsEl.innerHTML = state.pegs.map((p) => `<div class="dz-peg" style="left:${p.x}px;top:${p.y}px"></div>`).join('');
}

function buildPegs(arenaW: number, arenaH: number): Peg[] {
  const pegs: Peg[] = [];
  const binAreaH = BOTTOM_MARGIN;
  const usableH = arenaH - TOP_MARGIN - binAreaH;
  const rowGap = usableH / (ROWS + 1);
  for (let row = 1; row <= ROWS; row++) {
    const y = TOP_MARGIN + row * rowGap;
    const cols = row % 2 === 0 ? MAX_COLS : MAX_COLS - 1;
    const colGap = arenaW / (cols + 1);
    const offsetX = row % 2 === 0 ? 0 : colGap / 2;
    for (let c = 1; c <= cols; c++) {
      pegs.push({ x: offsetX + c * colGap, y });
    }
  }
  return pegs;
}

function clampAimX(x: number): number {
  const margin = BALL_R + 4;
  return Math.max(margin, Math.min(state.arenaW - margin, x));
}

function wireControls(): void {
  const field = fieldEl();
  if (!field) return;
  field.addEventListener('pointerdown', (e) => {
    if (!e.isPrimary || state.sub !== 'ready') return;
    e.preventDefault();
    state.sub = 'aiming';
    updateAim(e.clientX);
    document.getElementById('dzGuide')?.classList.add('visible');
  });
  field.addEventListener('pointermove', (e) => {
    if (!e.isPrimary || state.sub !== 'aiming') return;
    updateAim(e.clientX);
  });
  field.addEventListener('pointerup', (e) => {
    if (!e.isPrimary || state.sub !== 'aiming') return;
    e.preventDefault();
    releaseBall();
  });
  field.addEventListener('pointercancel', () => {
    if (state.sub !== 'aiming') return;
    state.sub = 'ready';
    document.getElementById('dzGuide')?.classList.remove('visible');
  });
}

function updateAim(clientX: number): void {
  const field = fieldEl();
  if (!field) return;
  const rect = field.getBoundingClientRect();
  state.aimX = clampAimX(clientX - rect.left);
  const guide = document.getElementById('dzGuide');
  if (guide) guide.style.transform = `translateX(${state.aimX}px)`;
}

function releaseBall(): void {
  document.getElementById('dzGuide')?.classList.remove('visible');
  state.sub = 'falling';
  state.ball = { x: state.aimX, y: BALL_R + 2, vx: 0, vy: 0 };
  Sound.click();
  state.lastT = performance.now();
  state.rafId = requestAnimationFrame(physicsLoop);
}

function physicsLoop(now: number): void {
  if (state.phase !== 'playing' || !document.getElementById('dzField') || !state.ball) {
    if (state.rafId != null) cancelAnimationFrame(state.rafId);
    state.rafId = null;
    return;
  }
  const dt = Math.min(0.032, (now - (state.lastT ?? now)) / 1000);
  state.lastT = now;
  const ball = state.ball;

  ball.vy += GRAVITY * dt;
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  const leftWall = BALL_R;
  const rightWall = state.arenaW - BALL_R;
  if (ball.x < leftWall) {
    ball.x = leftWall;
    ball.vx = -ball.vx * RESTITUTION;
  } else if (ball.x > rightWall) {
    ball.x = rightWall;
    ball.vx = -ball.vx * RESTITUTION;
  }

  for (const peg of state.pegs) {
    const dx = ball.x - peg.x;
    const dy = ball.y - peg.y;
    const dist = Math.hypot(dx, dy);
    const minDist = BALL_R + PEG_R;
    if (dist > 0 && dist < minDist) {
      const nx = dx / dist;
      const ny = dy / dist;
      const overlap = minDist - dist;
      ball.x += nx * overlap;
      ball.y += ny * overlap;
      const vDotN = ball.vx * nx + ball.vy * ny;
      ball.vx -= (1 + RESTITUTION) * vDotN * nx;
      ball.vy -= (1 + RESTITUTION) * vDotN * ny;
      ball.vx += (Math.random() - 0.5) * 50; // a little chaos so bounces don't feel mechanical
      Sound.pegBounce();
      Haptics.tap();
      break; // resolve at most one peg collision per frame — keeps the physics stable
    }
  }

  const ballEl = document.getElementById('dzBall');
  if (ballEl) ballEl.style.transform = `translate(${ball.x - BALL_R}px, ${ball.y - BALL_R}px)`;

  if (ball.y >= state.arenaH - BOTTOM_MARGIN) {
    landBall();
    return;
  }

  state.rafId = requestAnimationFrame(physicsLoop);
}

function landBall(): void {
  if (state.rafId != null) cancelAnimationFrame(state.rafId);
  state.rafId = null;
  const ball = state.ball!;
  const binWidth = state.arenaW / BIN_VALUES.length;
  const binIdx = Math.max(0, Math.min(BIN_VALUES.length - 1, Math.floor(ball.x / binWidth)));
  const value = BIN_VALUES[binIdx];
  state.score += value;
  state.bestBinValue = Math.max(state.bestBinValue, value);
  Sound.binLand(value);
  Haptics.hit();
  flashBin(binIdx, value);
  state.ball = null;
  document.getElementById('dzBall')?.style.setProperty('transform', 'translate(-999px,-999px)');
  updateScoreLabel();

  state.ballsLeft--;
  state.sub = 'ready';
  updateBallLabel();
  setTimeout(() => {
    if (state.phase !== 'playing') return;
    if (state.ballsLeft <= 0) endSession();
  }, 550);
}

function flashBin(idx: number, value: number): void {
  const bins = document.querySelectorAll<HTMLElement>('.dz-bin');
  const bin = bins[idx];
  if (!bin) return;
  bin.classList.remove('hit');
  void bin.offsetWidth;
  bin.classList.add('hit');
  const popup = document.createElement('div');
  popup.className = 'dz-popup';
  popup.textContent = `+${value}`;
  bin.appendChild(popup);
  setTimeout(() => popup.remove(), 700);
}

function startSession(): void {
  state.phase = 'playing';
  state.ballsLeft = TOTAL_BALLS;
  state.score = 0;
  state.bestBinValue = 0;
  drawArenaContent();
  updateScoreLabel();
  Sound.countdown();
}

function updateBallLabel(): void {
  const el = document.getElementById('dzBalls');
  if (el) el.textContent = `DROP ZONE — ${state.ballsLeft} KUGLER TILBAGE`;
}

function updateScoreLabel(): void {
  const el = document.getElementById('dzScore');
  if (el) el.textContent = `${state.score} POINT`;
}

function endSession(): void {
  state.phase = 'result';
  void finishSession();
}

async function finishSession(): Promise<void> {
  const score = state.score;
  const { isNewBest, xpGain, rank } = await finishGameSession('dropzone', score);

  Sound.complete();
  if (isNewBest) {
    setTimeout(() => Sound.pb(), 250);
    Haptics.personalBest();
  }

  drawFinalScreen(score, isNewBest, xpGain, rank);
}

function drawFinalScreen(score: number, isNewBest: boolean, xpGain: number, rank: number | null): void {
  const rating = ScoreKinds.dropzone_score.rating(score);
  main().innerHTML = `
    <div class="page">
      <div class="game-shell">
        <div class="final-wrap">
          <div class="final-label">Din score</div>
          <div class="final-score">${score}<span style="font-size:26px">point</span></div>
          <div class="final-rating" style="color:${rating.color}">${rating.label}</div>
          ${isNewBest ? '<div class="pb-flag">★ NY PERSONLIG REKORD</div>' : ''}
          <div class="xp-toast">✦ +${xpGain} XP optjent${rank && rank <= 3 ? ' · TOP 3-BONUS' : ''}</div>

          <div class="final-stats">
            <div class="fstat"><div class="n">${score}</div><div class="l">Point</div></div>
            <div class="fstat"><div class="n">${state.bestBinValue}</div><div class="l">Bedste boks</div></div>
            <div class="fstat"><div class="n">${rank ? '#' + rank : '—'}</div><div class="l">Placering</div></div>
            <div class="fstat"><div class="n">+${xpGain}</div><div class="l">XP optjent</div></div>
          </div>

          <div class="final-ctas">
            <button class="btn btn-primary btn-lg" id="playAgainBtn">SPIL IGEN</button>
            <button class="btn btn-ghost btn-lg" data-nav="leaderboard-dropzone">LEADERBOARD</button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.getElementById('playAgainBtn')!.addEventListener('click', () => {
    Sound.click();
    renderDropZoneGame();
  });
}
