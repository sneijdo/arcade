import { ScoreKinds } from '../../scoring';
import { Sound } from '../../sound';
import { Haptics } from '../../haptics';
import { finishGameSession } from '../../state';
import { gameUtilBarHtml, wireGameChrome } from '../../gameChrome';

type Phase = 'idle' | 'playing' | 'gameover';

const PLAYER_W = 34;
const PLAYER_H = 14;
const PLAYER_Y_FRAC = 0.86;
const STEP_PX = 40; // per keyboard press

interface Obstacle {
  x: number;
  y: number;
  w: number;
  h: number;
  passed: boolean;
  el: HTMLElement;
}

interface SwerveState {
  phase: Phase;
  /** Bumped every renderSwerveGame() call — lets the death-transition setTimeout below
   * recognize a stale firing (from a run the player already navigated away from) instead
   * of acting on whatever fresh session is now on screen; checking fieldEl() alone isn't
   * enough since a new run re-creates its own #swField. */
  sessionId: number;
  elapsedMs: number;
  obstaclesPassed: number;
  playerX: number;
  targetX: number;
  dragging: boolean;
  obstacles: Obstacle[];
  nextSpawnAt: number;
  rafId: number | null;
  lastT: number | null;
  arenaW: number;
  arenaH: number;
}

let sessionCounter = 0;
let state: SwerveState = makeInitialState();
let keydownWired = false;

function makeInitialState(): SwerveState {
  return {
    phase: 'idle',
    sessionId: ++sessionCounter,
    elapsedMs: 0,
    obstaclesPassed: 0,
    playerX: 0,
    targetX: 0,
    dragging: false,
    obstacles: [],
    nextSpawnAt: 0,
    rafId: null,
    lastT: null,
    arenaW: 0,
    arenaH: 0,
  };
}

function main(): HTMLElement {
  return document.getElementById('main')!;
}
function arenaEl(): HTMLElement | null {
  return document.getElementById('swArena');
}
function fieldEl(): HTMLElement | null {
  return document.getElementById('swField');
}

export function renderSwerveGame(): void {
  if (state.rafId != null) cancelAnimationFrame(state.rafId);
  state = makeInitialState();
  drawShell();
  wireKeydown();
  wireGameChrome('swerve', renderSwerveGame);
}

function drawShell(): void {
  main().innerHTML = `
    <div class="page">
      <div class="game-shell">
        <div class="game-topbar">
          <span>SWERVE</span>
          <span class="mono" id="swTime">0.0s</span>
        </div>
        ${gameUtilBarHtml()}
        <div class="arena" id="swArena"></div>
      </div>
    </div>
  `;
  drawIdle();
  const arena = arenaEl()!;
  arena.addEventListener('pointerdown', handlePointerDown);
  arena.addEventListener('pointermove', handlePointerMove);
  arena.addEventListener('pointerup', handlePointerUp);
  arena.addEventListener('pointercancel', handlePointerUp);
}

function drawIdle(): void {
  const arena = arenaEl();
  if (!arena) return;
  arena.innerHTML = `
    <div class="arena-inner">
      <div class="arena-title">Klar?</div>
      <ul class="instructions-list">
        <li>Træk for at styre til siden</li>
        <li>Undgå blokkene der falder ned</li>
        <li>Farten stiger, hvor længe kan du holde ud?</li>
      </ul>
      <button class="btn btn-primary btn-lg" id="swerveStartBtn">START</button>
    </div>
  `;
  document.getElementById('swerveStartBtn')!.addEventListener('click', (e) => {
    e.stopPropagation();
    startRun();
  });
}

function wireKeydown(): void {
  if (keydownWired) return;
  keydownWired = true;
  document.addEventListener('keydown', (e) => {
    if (state.phase !== 'playing') return;
    if (e.key === 'ArrowLeft') state.targetX = Math.max(PLAYER_W / 2, state.targetX - STEP_PX);
    else if (e.key === 'ArrowRight') state.targetX = Math.min(state.arenaW - PLAYER_W / 2, state.targetX + STEP_PX);
    else return;
    e.preventDefault();
  });
}

function pointerXInArena(e: PointerEvent): number {
  const arena = arenaEl()!;
  const rect = arena.getBoundingClientRect();
  return e.clientX - rect.left;
}

function handlePointerDown(e: PointerEvent): void {
  if (!e.isPrimary) return;
  if (state.phase === 'idle') {
    startRun();
    return;
  }
  if (state.phase !== 'playing') return;
  e.preventDefault();
  state.dragging = true;
  state.targetX = Math.min(state.arenaW - PLAYER_W / 2, Math.max(PLAYER_W / 2, pointerXInArena(e)));
}

function handlePointerMove(e: PointerEvent): void {
  if (!e.isPrimary || !state.dragging || state.phase !== 'playing') return;
  e.preventDefault();
  state.targetX = Math.min(state.arenaW - PLAYER_W / 2, Math.max(PLAYER_W / 2, pointerXInArena(e)));
}

function handlePointerUp(): void {
  state.dragging = false;
}

function startRun(): void {
  const arena = arenaEl();
  if (!arena) return;
  state.arenaW = arena.clientWidth || 320;
  state.arenaH = arena.clientHeight || 400;
  state.phase = 'playing';
  state.elapsedMs = 0;
  state.obstaclesPassed = 0;
  state.playerX = state.arenaW / 2;
  state.targetX = state.playerX;
  state.obstacles = [];
  state.nextSpawnAt = 700;
  state.lastT = null;

  arena.innerHTML = `
    <div class="sw-field" id="swField">
      <div class="sw-live-time" id="swLiveTime">0.0s</div>
      <div class="sw-player" id="swPlayer"></div>
    </div>
  `;

  state.rafId = requestAnimationFrame(loop);
}

function fallSpeedPxPerSec(elapsedSec: number): number {
  return Math.min(720, 190 + elapsedSec * 15);
}
function spawnIntervalMs(elapsedSec: number): number {
  return Math.max(300, 980 - elapsedSec * 17);
}
function obstacleWidth(): number {
  return 44 + Math.random() * 46;
}

function spawnObstacle(): void {
  const field = fieldEl();
  if (!field) return;
  const w = obstacleWidth();
  const x = Math.random() * (state.arenaW - w);
  const el = document.createElement('div');
  el.className = 'sw-obstacle';
  el.style.width = `${w}px`;
  field.appendChild(el);
  state.obstacles.push({ x, y: -20, w, h: 20, passed: false, el });
}

function loop(t: number): void {
  const field = fieldEl();
  if (!field || state.phase !== 'playing') {
    if (state.rafId != null) cancelAnimationFrame(state.rafId);
    state.rafId = null;
    return;
  }

  if (state.lastT == null) state.lastT = t;
  // Clamped, then accumulated — not `t - startedAt`. rAF stops firing while the tab/app
  // is backgrounded (locked screen, app switch, minimized window); resuming afterwards
  // hands the callback a fresh, current `t`, so a raw wall-clock diff against the start
  // time would count the entire backgrounded gap as survived time and hand out a huge,
  // untouched score. Summing the same per-frame clamp already used for physics below
  // keeps the clock (and the difficulty ramp it drives) tied to frames actually run.
  const dt = Math.min((t - state.lastT) / 1000, 0.05);
  state.lastT = t;
  state.elapsedMs += dt * 1000;
  const elapsedSec = state.elapsedMs / 1000;

  // Direct 1:1 follow (no lerp) — a dodge game needs the player's input to
  // feel immediate, not smoothed/laggy.
  state.playerX = state.targetX;

  if (state.elapsedMs >= state.nextSpawnAt) {
    spawnObstacle();
    state.nextSpawnAt = state.elapsedMs + spawnIntervalMs(elapsedSec);
  }

  const speed = fallSpeedPxPerSec(elapsedSec);
  const playerY = state.arenaH * PLAYER_Y_FRAC;
  const playerLeft = state.playerX - PLAYER_W / 2;
  const playerRight = state.playerX + PLAYER_W / 2;
  const playerTop = playerY - PLAYER_H / 2;
  const playerBottom = playerY + PLAYER_H / 2;

  let dead = false;
  for (let i = state.obstacles.length - 1; i >= 0; i--) {
    const o = state.obstacles[i];
    o.y += speed * dt;
    if (o.y > state.arenaH + 20) {
      o.el.remove();
      state.obstacles.splice(i, 1);
      if (!o.passed) state.obstaclesPassed++;
      continue;
    }
    o.el.style.transform = `translate(${o.x}px, ${o.y}px)`;

    if (!o.passed && o.y > playerBottom) {
      o.passed = true;
      state.obstaclesPassed++;
    }

    if (!dead) {
      const overlapsX = o.x < playerRight && o.x + o.w > playerLeft;
      const overlapsY = o.y < playerBottom && o.y + o.h > playerTop;
      if (overlapsX && overlapsY) dead = true;
    }
  }

  const player = document.getElementById('swPlayer');
  if (player) {
    player.style.left = `${playerLeft}px`;
    player.style.top = `${playerTop}px`;
    player.style.width = `${PLAYER_W}px`;
    player.style.height = `${PLAYER_H}px`;
  }

  const liveTime = document.getElementById('swLiveTime');
  const topbarTime = document.getElementById('swTime');
  const label = `${elapsedSec.toFixed(1)}s`;
  if (liveTime) liveTime.textContent = label;
  if (topbarTime) topbarTime.textContent = label;

  if (dead) {
    triggerDeathFlash(state.playerX, playerY);
    // sessionId guard actually wired up here — fieldEl() alone doesn't catch a restart, since a
    // new run recreates its own #swField with the same id (see the sessionId doc comment above).
    // Without this, restarting within this 180ms window let a stale endRun() fire against the
    // fresh session and submit the OLD run's score as if the new one had just ended.
    const deathSessionId = state.sessionId;
    setTimeout(() => {
      if (state.sessionId !== deathSessionId || !fieldEl()) return;
      void endRun();
    }, 180);
    return;
  }

  state.rafId = requestAnimationFrame(loop);
}

function triggerDeathFlash(x: number, y: number): void {
  const field = fieldEl();
  if (!field) return;
  const flash = document.createElement('div');
  flash.className = 'sw-death-flash';
  field.appendChild(flash);
  setTimeout(() => flash.remove(), 300);

  const burstCount = 8;
  for (let i = 0; i < burstCount; i++) {
    const p = document.createElement('div');
    p.className = 'sw-death-particle';
    const angle = (i / burstCount) * Math.PI * 2 + Math.random() * 0.4;
    const dist = 26 + Math.random() * 36;
    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    p.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
    p.style.setProperty('--dy', `${Math.sin(angle) * dist}px`);
    field.appendChild(p);
    setTimeout(() => p.remove(), 420);
  }
}

async function endRun(): Promise<void> {
  if (state.rafId != null) cancelAnimationFrame(state.rafId);
  state.rafId = null;
  state.phase = 'gameover';
  Sound.mistake();
  Haptics.miss();
  const finalScoreMs = Math.round(state.elapsedMs);
  const { isNewBest, xpGain, rank } = await finishGameSession('swerve', finalScoreMs);
  Sound.complete();
  if (isNewBest) {
    setTimeout(() => Sound.pb(), 250);
    Haptics.personalBest();
  }
  drawFinalScreen(finalScoreMs, isNewBest, xpGain, rank);
}

function drawFinalScreen(scoreMs: number, isNewBest: boolean, xpGain: number, rank: number | null): void {
  const rating = ScoreKinds.swerve_time.rating(scoreMs);
  const seconds = (scoreMs / 1000).toFixed(1);
  main().innerHTML = `
    <div class="page">
      <div class="game-shell">
        <div class="final-wrap">
          <div class="final-label">Din score</div>
          <div class="final-score">${seconds}<span style="font-size:26px">s</span></div>
          <div class="final-rating" style="color:${rating.color}">${rating.label}</div>
          ${isNewBest ? '<div class="pb-flag">★ NY PERSONLIG REKORD</div>' : ''}
          <div class="xp-toast">✦ +${xpGain} XP optjent${rank && rank <= 3 ? ' · TOP 3-BONUS' : ''}</div>

          <div class="final-stats">
            <div class="fstat"><div class="n">${seconds}s</div><div class="l">Overlevede</div></div>
            <div class="fstat"><div class="n">${state.obstaclesPassed}</div><div class="l">Undgået</div></div>
            <div class="fstat"><div class="n">${rank ? '#' + rank : '—'}</div><div class="l">Placering</div></div>
            <div class="fstat"><div class="n">+${xpGain}</div><div class="l">XP optjent</div></div>
          </div>

          <div class="final-ctas">
            <button class="btn btn-primary btn-lg" id="swervePlayAgainBtn">SPIL IGEN</button>
            <button class="btn btn-ghost btn-lg" data-nav="leaderboard-swerve">LEADERBOARD</button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.getElementById('swervePlayAgainBtn')!.addEventListener('click', () => {
    Sound.click();
    renderSwerveGame();
  });
}
