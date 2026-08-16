import { ScoreKinds } from '../../scoring';
import { Sound } from '../../sound';
import { Haptics } from '../../haptics';
import { finishGameSession } from '../../state';

const BLOCK_HEIGHT = 32;
const PERFECT_TOLERANCE = 6;
const MISS_EPS = 4;
const PERFECT_GROW = 5;
const SPEED_STEP_EVERY = 3;
const MAX_SPEED_MULT = 2.4;
const VISIBLE_TOP_FRACTION = 0.35; // topmost block sits this far up from the arena floor (~65% down from the top)
const HUE_START = 255;
const HUE_STEP = 17;

type Phase = 'idle' | 'playing' | 'gameover';

interface Block {
  x: number;
  width: number;
  hue: number;
}

interface Current {
  x: number;
  width: number;
  dir: 1 | -1;
  speed: number;
  hue: number;
}

const MILESTONE_EVERY = 10;

interface StackState {
  phase: Phase;
  blocks: Block[];
  current: Current | null;
  score: number;
  perfectCount: number;
  perfectStreak: number;
  rafId: number | null;
  lastT: number;
  arenaW: number;
  arenaH: number;
  baseWidth: number;
  baseSpeed: number;
}

let state: StackState = makeInitialState();

function makeInitialState(): StackState {
  return {
    phase: 'idle',
    blocks: [],
    current: null,
    score: 0,
    perfectCount: 0,
    perfectStreak: 0,
    rafId: null,
    lastT: 0,
    arenaW: 0,
    arenaH: 0,
    baseWidth: 0,
    baseSpeed: 0,
  };
}

function main(): HTMLElement {
  return document.getElementById('main')!;
}
function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function renderStackGame(): void {
  if (state.rafId != null) cancelAnimationFrame(state.rafId);
  state = makeInitialState();
  drawShell();
}

function drawShell(): void {
  main().innerHTML = `
    <div class="page">
      <div class="game-shell">
        <div class="game-topbar">
          <span>STACK TOWER</span>
          <span class="mono" id="stackScore">BLOKKE: 0</span>
        </div>
        <div class="arena stack-arena" id="stackArena"></div>
      </div>
    </div>
  `;
  drawIdle();
}

function drawIdle(): void {
  const a = document.getElementById('stackArena')!;
  a.classList.remove('playing');
  a.innerHTML = `
    <div class="arena-inner">
      <div class="arena-title">Klar til at bygge?</div>
      <ul class="instructions-list">
        <li>Tap for at droppe blokken på tårnet</li>
        <li>Kun det overlappende stykke overlever</li>
        <li>Ram præcist for en PERFEKT-bonus</li>
      </ul>
      <button class="btn btn-primary btn-lg" id="stackStartBtn">START</button>
    </div>
  `;
  document.getElementById('stackStartBtn')!.addEventListener('click', (e) => {
    e.stopPropagation();
    startGame();
  });
}

function startGame(): void {
  const arena = document.getElementById('stackArena')!;
  arena.classList.add('playing');
  arena.innerHTML = `
    <div class="stack-flash" id="stackFlash"></div>
    <div class="stack-tower" id="stackTower"></div>
    <div class="stack-block stack-current" id="stackCurrent"></div>
    <div class="stack-perfect" id="stackPerfect">PERFEKT!</div>
    <div class="stack-milestone" id="stackMilestone"></div>
  `;

  state.arenaW = arena.clientWidth;
  state.arenaH = arena.clientHeight;
  state.baseWidth = clamp(state.arenaW * 0.55, 120, 220);
  state.baseSpeed = state.arenaW * 0.38;

  const base: Block = { x: (state.arenaW - state.baseWidth) / 2, width: state.baseWidth, hue: HUE_START };
  state.blocks = [base];
  renderTowerBlock(base, 0);
  updateCameraAndCurrentBottom();
  spawnCurrent();

  state.phase = 'playing';
  updateScore();
  arena.addEventListener('pointerdown', handlePointerDown);
  state.lastT = performance.now();
  state.rafId = requestAnimationFrame(loop);
}

function speedForCount(n: number): number {
  const steps = Math.floor(n / SPEED_STEP_EVERY);
  return Math.min(state.baseSpeed * MAX_SPEED_MULT, state.baseSpeed + steps * (state.baseSpeed * 0.14));
}

function spawnCurrent(): void {
  const top = state.blocks[state.blocks.length - 1];
  const dir: 1 | -1 = state.blocks.length % 2 === 0 ? -1 : 1;
  const startX = dir === 1 ? 0 : state.arenaW - top.width;
  const hue = (HUE_START + state.blocks.length * HUE_STEP) % 360;
  state.current = { x: startX, width: top.width, dir, speed: speedForCount(state.blocks.length), hue };
  renderCurrentEl();
}

function renderCurrentEl(): void {
  const el = document.getElementById('stackCurrent');
  if (!el || !state.current) return;
  el.style.left = `${state.current.x}px`;
  el.style.width = `${state.current.width}px`;
  el.style.height = `${BLOCK_HEIGHT}px`;
  el.style.background = `hsl(${state.current.hue}, 82%, 60%)`;
}

function loop(t: number): void {
  // The player may have navigated away mid-game — nothing else cancels this
  // rAF on route change, so bail out instead of silently mutating a game
  // nobody is looking at anymore.
  if (!document.getElementById('stackArena')) {
    state.rafId = null;
    return;
  }
  const dt = Math.min(0.05, (t - state.lastT) / 1000);
  state.lastT = t;

  if (state.phase === 'playing' && state.current) {
    const c = state.current;
    c.x += c.dir * c.speed * dt;
    const maxX = state.arenaW - c.width;
    if (c.x <= 0) {
      c.x = 0;
      c.dir = 1;
    } else if (c.x >= maxX) {
      c.x = maxX;
      c.dir = -1;
    }
    const el = document.getElementById('stackCurrent');
    if (el) el.style.left = `${c.x}px`;
  }
  state.rafId = requestAnimationFrame(loop);
}

function handlePointerDown(e: PointerEvent): void {
  if (!e.isPrimary) return;
  if (state.phase !== 'playing' || !state.current) return;
  e.preventDefault();
  dropBlock();
}

function dropBlock(): void {
  const current = state.current!;
  const top = state.blocks[state.blocks.length - 1];
  const offset = current.x - top.x;
  const absOffset = Math.abs(offset);
  const overlapLeft = Math.max(current.x, top.x);
  const overlapRight = Math.min(current.x + current.width, top.x + top.width);
  const overlapWidth = overlapRight - overlapLeft;

  if (overlapWidth < MISS_EPS) {
    missDrop(current);
    return;
  }

  const dropBottom = Math.min(state.blocks.length * BLOCK_HEIGHT, state.arenaH * VISIBLE_TOP_FRACTION);
  const isPerfect = absOffset <= PERFECT_TOLERANCE;
  let placed: Block;
  let overhang: { x: number; width: number } | null = null;

  if (isPerfect) {
    const newWidth = Math.min(state.baseWidth, top.width + PERFECT_GROW);
    placed = { x: top.x - (newWidth - top.width) / 2, width: newWidth, hue: current.hue };
  } else {
    placed = { x: overlapLeft, width: overlapWidth, hue: current.hue };
    if (current.x < overlapLeft) overhang = { x: current.x, width: overlapLeft - current.x };
    else if (current.x + current.width > overlapRight) overhang = { x: overlapRight, width: current.x + current.width - overlapRight };
  }

  state.blocks.push(placed);
  state.score++;
  renderTowerBlock(placed, state.blocks.length - 1);
  updateCameraAndCurrentBottom();
  updateScore();

  if (overhang && overhang.width > 0.5) spawnFallingPiece(overhang.x, overhang.width, current.hue, dropBottom);

  if (isPerfect) {
    state.perfectCount++;
    state.perfectStreak++;
    showPerfectCallout(state.perfectStreak);
    flashBlock(state.blocks.length - 1);
    Sound.perfect();
    Haptics.personalBest();
  } else {
    state.perfectStreak = 0;
    // A landing that barely survived (most of the block sliced off) gets a
    // sharp little camera jolt — landing precision reads as different from
    // a comfortable overlap, not just as the same "thud" every time.
    if (overlapWidth < current.width * 0.4) triggerTowerJolt();
    Sound.place();
    Haptics.hit();
  }

  if (state.score % MILESTONE_EVERY === 0) triggerMilestone(state.score);

  spawnCurrent();
}

function missDrop(current: Current): void {
  state.phase = 'gameover';
  state.current = null;
  if (state.rafId != null) cancelAnimationFrame(state.rafId);
  state.rafId = null;

  const dropBottom = Math.min(state.blocks.length * BLOCK_HEIGHT, state.arenaH * VISIBLE_TOP_FRACTION);
  spawnFallingPiece(current.x, current.width, current.hue, dropBottom, true);
  document.getElementById('stackCurrent')?.remove();
  triggerFlash('death');

  Sound.mistake();
  Haptics.miss();
  void finishStackSession();
}

function renderTowerBlock(block: Block, index: number): void {
  const tower = document.getElementById('stackTower');
  if (!tower) return;
  const el = document.createElement('div');
  el.className = 'stack-block';
  el.style.bottom = `${index * BLOCK_HEIGHT}px`;
  el.style.left = `${block.x}px`;
  el.style.width = `${block.width}px`;
  el.style.height = `${BLOCK_HEIGHT}px`;
  el.style.background = `hsl(${block.hue}, 82%, 60%)`;
  tower.appendChild(el);
}

function updateCameraAndCurrentBottom(): void {
  const cameraShift = Math.max(0, state.blocks.length * BLOCK_HEIGHT - state.arenaH * VISIBLE_TOP_FRACTION);
  const tower = document.getElementById('stackTower');
  if (tower) tower.style.transform = `translateY(${cameraShift}px)`;
  const currentBottom = Math.min(state.blocks.length * BLOCK_HEIGHT, state.arenaH * VISIBLE_TOP_FRACTION);
  const currentEl = document.getElementById('stackCurrent');
  if (currentEl) currentEl.style.bottom = `${currentBottom}px`;
}

function spawnFallingPiece(x: number, width: number, hue: number, bottom: number, isDeath = false): void {
  const arena = document.getElementById('stackArena');
  if (!arena) return;
  const el = document.createElement('div');
  el.className = isDeath ? 'stack-block stack-falling death' : 'stack-block stack-falling';
  el.style.left = `${x}px`;
  el.style.width = `${width}px`;
  el.style.height = `${BLOCK_HEIGHT}px`;
  el.style.bottom = `${bottom}px`;
  el.style.background = `hsl(${hue}, 82%, 60%)`;
  // Slight random rotation/direction variance so debris doesn't all fall
  // identically — reads as physical, not like the same UI animation repeating.
  const spin = isDeath ? 55 + Math.random() * 25 : 16 + Math.random() * 12;
  const spinDir = Math.random() < 0.5 ? -1 : 1;
  el.style.setProperty('--stack-fall-rot', `${spin * spinDir}deg`);
  arena.appendChild(el);
  requestAnimationFrame(() => el.classList.add('falling-active'));
  setTimeout(
    () => {
      if (el.parentNode) el.remove();
    },
    isDeath ? 820 : 550,
  );
}

function showPerfectCallout(streak: number): void {
  const el = document.getElementById('stackPerfect');
  if (!el) return;
  el.textContent = streak >= 2 ? `PERFEKT! ×${streak}` : 'PERFEKT!';
  el.classList.remove('show', 'streak-hot');
  void el.offsetWidth; // restart the CSS animation even on back-to-back perfects
  if (streak >= 3) el.classList.add('streak-hot');
  el.classList.add('show');
}

function flashBlock(index: number): void {
  const tower = document.getElementById('stackTower');
  const el = tower?.children[index] as HTMLElement | undefined;
  if (!el) return;
  el.classList.add('perfect-flash');
  setTimeout(() => el.classList.remove('perfect-flash'), 420);
}

/** A quick shake on the whole arena — reserved for landings that barely survived, so precision itself feels different from a comfortable overlap. Targets the arena rather than the tower: the tower's own inline transform already drives the camera-follow translateY every drop, and a CSS animation on the same property would fight it. */
function triggerTowerJolt(): void {
  const arena = document.getElementById('stackArena');
  if (!arena) return;
  arena.classList.remove('jolt');
  void arena.offsetWidth;
  arena.classList.add('jolt');
  setTimeout(() => arena.classList.remove('jolt'), 260);
}

/** Height milestone every MILESTONE_EVERY blocks — an escalating reward beat independent of whether the triggering drop happened to be perfect. */
function triggerMilestone(score: number): void {
  const el = document.getElementById('stackMilestone');
  if (el) {
    el.textContent = `${score} HØJT!`;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  }
  triggerFlash('milestone');
  Sound.achievement();
  Haptics.personalBest();
}

function triggerFlash(kind: 'milestone' | 'death'): void {
  const el = document.getElementById('stackFlash');
  if (!el) return;
  el.classList.remove('flash-milestone', 'flash-death');
  void el.offsetWidth;
  el.classList.add(kind === 'milestone' ? 'flash-milestone' : 'flash-death');
}

function updateScore(): void {
  const el = document.getElementById('stackScore');
  if (el) el.textContent = `BLOKKE: ${state.score}`;
}

async function finishStackSession(): Promise<void> {
  const { isNewBest, xpGain, rank } = await finishGameSession('stack', state.score);
  Sound.complete();
  if (isNewBest) {
    setTimeout(() => Sound.pb(), 250);
    Haptics.personalBest();
  }
  drawFinalScreen(isNewBest, xpGain, rank);
}

function drawFinalScreen(isNewBest: boolean, xpGain: number, rank: number | null): void {
  const rating = ScoreKinds.stack_height.rating(state.score);
  main().innerHTML = `
    <div class="page">
      <div class="game-shell">
        <div class="final-wrap">
          <div class="final-label">Din score</div>
          <div class="final-score">${state.score}</div>
          <div class="final-rating" style="color:${rating.color}">${rating.label}</div>
          ${isNewBest ? '<div class="pb-flag">★ NY PERSONLIG REKORD</div>' : ''}
          <div class="xp-toast">✦ +${xpGain} XP optjent${rank && rank <= 3 ? ' · TOP 3-BONUS' : ''}</div>

          <div class="final-stats">
            <div class="fstat"><div class="n">${state.score}</div><div class="l">Blokke</div></div>
            <div class="fstat"><div class="n">${state.perfectCount}</div><div class="l">Perfekte</div></div>
            <div class="fstat"><div class="n">${rank ? '#' + rank : '—'}</div><div class="l">Placering</div></div>
            <div class="fstat"><div class="n">+${xpGain}</div><div class="l">XP optjent</div></div>
          </div>

          <div class="final-ctas">
            <button class="btn btn-primary btn-lg" id="stackPlayAgainBtn">SPIL IGEN</button>
            <button class="btn btn-ghost btn-lg" data-nav="leaderboard-stack">LEADERBOARD</button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.getElementById('stackPlayAgainBtn')!.addEventListener('click', () => {
    Sound.click();
    renderStackGame();
  });
}
