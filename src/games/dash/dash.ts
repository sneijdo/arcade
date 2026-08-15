import { ScoreKinds } from '../../scoring';
import { Sound } from '../../sound';
import { Haptics } from '../../haptics';
import { finishGameSession } from '../../state';

type Phase = 'idle' | 'playing' | 'gameover';

/** How many meters of world are visible across the arena width at once — controls pixels-per-meter scale. */
const VIEW_WIDTH_M = 8;
const PLAYER_X_FRAC = 0.25;
const PLAYER_SIZE_M = 0.6;
const PIPE_WIDTH_M = 1.0;
/** Fraction of arena height kept clear at the very top/bottom so a gap is never flush against an edge. */
const GAP_MARGIN_FRAC = 0.12;

interface Obstacle {
  xMeters: number;
  gapCenterFrac: number;
  gapSizeFrac: number;
  passed: boolean;
  top: HTMLElement;
  bottom: HTMLElement;
}

interface DashState {
  phase: Phase;
  distance: number;
  obstaclesPassed: number;
  playerY: number;
  velocity: number;
  obstacles: Obstacle[];
  nextSpawnMeters: number;
  rafId: number | null;
  lastT: number | null;
  arenaW: number;
  arenaH: number;
}

let state: DashState = makeInitialState();

function makeInitialState(): DashState {
  return {
    phase: 'idle',
    distance: 0,
    obstaclesPassed: 0,
    playerY: 0,
    velocity: 0,
    obstacles: [],
    nextSpawnMeters: 4,
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
  return document.getElementById('dashArena');
}
function fieldEl(): HTMLElement | null {
  return document.getElementById('dashField');
}

export function renderDashGame(): void {
  if (state.rafId != null) cancelAnimationFrame(state.rafId);
  state = makeInitialState();
  drawShell();
}

function drawShell(): void {
  main().innerHTML = `
    <div class="page">
      <div class="game-shell">
        <div class="game-topbar">
          <span>DASH</span>
          <span class="mono" id="dashDistance">0 m</span>
        </div>
        <div class="arena" id="dashArena"></div>
      </div>
    </div>
  `;
  drawIdle();
  const arena = arenaEl()!;
  arena.addEventListener('pointerdown', handlePointerDown);
}

function drawIdle(): void {
  const arena = arenaEl();
  if (!arena) return;
  arena.innerHTML = `
    <div class="arena-inner">
      <div class="arena-title">Klar?</div>
      <ul class="instructions-list">
        <li>Tap for at flyve op</li>
        <li>Undgå forhindringerne</li>
        <li>Hvor langt kan du nå?</li>
      </ul>
      <button class="btn btn-primary btn-lg" id="dashStartBtn">START</button>
    </div>
  `;
  document.getElementById('dashStartBtn')!.addEventListener('click', (e) => {
    e.stopPropagation();
    startRun();
  });
}

function handlePointerDown(e: PointerEvent): void {
  if (!e.isPrimary) return;
  if (state.phase === 'gameover') return;
  e.preventDefault();
  if (state.phase === 'idle') {
    startRun();
    return;
  }
  if (state.phase === 'playing') {
    flap();
  }
}

function startRun(): void {
  const arena = arenaEl();
  if (!arena) return;
  state.arenaW = arena.clientWidth || 320;
  state.arenaH = arena.clientHeight || 400;
  state.phase = 'playing';
  state.distance = 0;
  state.obstaclesPassed = 0;
  state.playerY = state.arenaH / 2;
  state.velocity = 0;
  state.obstacles = [];
  state.nextSpawnMeters = 4;
  state.lastT = null;

  arena.innerHTML = `
    <div class="dash-field" id="dashField">
      <div class="dash-live-score" id="dashLiveScore">0 m</div>
      <div class="dash-player" id="dashPlayer"></div>
    </div>
  `;

  state.rafId = requestAnimationFrame(loop);
}

function ppm(): number {
  return state.arenaW / VIEW_WIDTH_M;
}
function speedForDistance(d: number): number {
  return Math.min(14, 5.5 + d * 0.028);
}
function gapFracForDistance(d: number): number {
  return Math.max(0.24, 0.4 - d * 0.00064);
}
function spacingForDistance(d: number): number {
  return Math.max(7, 10 - d * 0.01);
}

function flap(): void {
  state.velocity = -state.arenaH * 0.85;
  Sound.click();
}

function spawnObstacle(): void {
  const field = fieldEl();
  if (!field) return;
  const gapSizeFrac = gapFracForDistance(state.distance);
  const gapCenterFrac = GAP_MARGIN_FRAC + gapSizeFrac / 2 + Math.random() * (1 - 2 * GAP_MARGIN_FRAC - gapSizeFrac);

  const top = document.createElement('div');
  top.className = 'dash-pipe dash-pipe-top';
  const bottom = document.createElement('div');
  bottom.className = 'dash-pipe dash-pipe-bottom';
  field.appendChild(top);
  field.appendChild(bottom);

  state.obstacles.push({
    xMeters: state.nextSpawnMeters,
    gapCenterFrac,
    gapSizeFrac,
    passed: false,
    top,
    bottom,
  });
  state.nextSpawnMeters += spacingForDistance(state.distance);
}

function loop(t: number): void {
  // The player may have navigated to a different page mid-run — nothing else
  // cancels this rAF loop on route change, so bail out instead of silently
  // mutating/scoring a game nobody is looking at anymore.
  const field = fieldEl();
  if (!field || state.phase !== 'playing') {
    if (state.rafId != null) cancelAnimationFrame(state.rafId);
    state.rafId = null;
    return;
  }

  if (state.lastT == null) state.lastT = t;
  const dt = Math.min((t - state.lastT) / 1000, 0.05);
  state.lastT = t;

  const gravity = state.arenaH * 2.6;
  const maxFall = state.arenaH * 1.6;
  state.velocity = Math.min(state.velocity + gravity * dt, maxFall);
  state.playerY += state.velocity * dt;

  const playerRadiusPx = (PLAYER_SIZE_M * ppm()) / 2;
  let dead = false;
  if (state.playerY - playerRadiusPx < 0) {
    state.playerY = playerRadiusPx;
    state.velocity = 0;
  }
  if (state.playerY + playerRadiusPx > state.arenaH) {
    dead = true;
  }

  const speed = speedForDistance(state.distance);
  state.distance += speed * dt;

  while (state.nextSpawnMeters < state.distance + VIEW_WIDTH_M + 1) {
    spawnObstacle();
  }

  const playerXpx = state.arenaW * PLAYER_X_FRAC;
  const pipeWidthPx = PIPE_WIDTH_M * ppm();

  for (let i = state.obstacles.length - 1; i >= 0; i--) {
    const o = state.obstacles[i];
    const centerX = (o.xMeters - state.distance) * ppm() + playerXpx;
    const left = centerX - pipeWidthPx / 2;

    if (left + pipeWidthPx < -20) {
      o.top.remove();
      o.bottom.remove();
      state.obstacles.splice(i, 1);
      continue;
    }

    const gapTop = (o.gapCenterFrac - o.gapSizeFrac / 2) * state.arenaH;
    const gapBottom = (o.gapCenterFrac + o.gapSizeFrac / 2) * state.arenaH;

    o.top.style.left = `${left}px`;
    o.top.style.width = `${pipeWidthPx}px`;
    o.top.style.height = `${Math.max(0, gapTop)}px`;
    o.bottom.style.left = `${left}px`;
    o.bottom.style.width = `${pipeWidthPx}px`;
    o.bottom.style.top = `${gapBottom}px`;
    o.bottom.style.height = `${Math.max(0, state.arenaH - gapBottom)}px`;

    if (!o.passed && o.xMeters < state.distance) {
      o.passed = true;
      state.obstaclesPassed++;
    }

    if (!dead) {
      const overlapsX = left < playerXpx + playerRadiusPx && left + pipeWidthPx > playerXpx - playerRadiusPx;
      if (overlapsX) {
        if (state.playerY - playerRadiusPx < gapTop || state.playerY + playerRadiusPx > gapBottom) {
          dead = true;
        }
      }
    }
  }

  const player = document.getElementById('dashPlayer');
  if (player) {
    const angle = Math.max(-35, Math.min(80, (state.velocity / maxFall) * 70));
    player.style.left = `${playerXpx - playerRadiusPx}px`;
    player.style.top = `${state.playerY - playerRadiusPx}px`;
    player.style.width = `${playerRadiusPx * 2}px`;
    player.style.height = `${playerRadiusPx * 2}px`;
    player.style.transform = `rotate(${angle}deg)`;
  }

  const liveScore = document.getElementById('dashLiveScore');
  if (liveScore) liveScore.textContent = `${Math.floor(state.distance)} m`;
  const topbarDistance = document.getElementById('dashDistance');
  if (topbarDistance) topbarDistance.textContent = `${Math.floor(state.distance)} m`;

  if (dead) {
    endRun();
    return;
  }

  state.rafId = requestAnimationFrame(loop);
}

async function endRun(): Promise<void> {
  if (state.rafId != null) cancelAnimationFrame(state.rafId);
  state.rafId = null;
  state.phase = 'gameover';
  Sound.mistake();
  Haptics.miss();
  const finalScore = Math.floor(state.distance);
  const { isNewBest, xpGain, rank } = await finishGameSession('dash', finalScore);
  Sound.complete();
  if (isNewBest) {
    setTimeout(() => Sound.pb(), 250);
    Haptics.personalBest();
  }
  drawFinalScreen(finalScore, isNewBest, xpGain, rank);
}

function drawFinalScreen(score: number, isNewBest: boolean, xpGain: number, rank: number | null): void {
  const rating = ScoreKinds.dash_distance.rating(score);
  main().innerHTML = `
    <div class="page">
      <div class="game-shell">
        <div class="final-wrap">
          <div class="final-label">Din score</div>
          <div class="final-score">${score}<span style="font-size:26px">m</span></div>
          <div class="final-rating" style="color:${rating.color}">${rating.label}</div>
          ${isNewBest ? '<div class="pb-flag">★ NY PERSONLIG REKORD</div>' : ''}
          <div class="xp-toast">✦ +${xpGain} XP optjent${rank && rank <= 3 ? ' · TOP 3-BONUS' : ''}</div>

          <div class="final-stats">
            <div class="fstat"><div class="n">${score}</div><div class="l">Distance (m)</div></div>
            <div class="fstat"><div class="n">${state.obstaclesPassed}</div><div class="l">Forhindringer</div></div>
            <div class="fstat"><div class="n">${rank ? '#' + rank : '—'}</div><div class="l">Placering</div></div>
            <div class="fstat"><div class="n">+${xpGain}</div><div class="l">XP optjent</div></div>
          </div>

          <div class="final-ctas">
            <button class="btn btn-primary btn-lg" id="dashPlayAgainBtn">SPIL IGEN</button>
            <button class="btn btn-ghost btn-lg" data-nav="leaderboard">LEADERBOARD</button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.getElementById('dashPlayAgainBtn')!.addEventListener('click', () => {
    Sound.click();
    renderDashGame();
  });
}
