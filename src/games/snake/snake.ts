import { ScoreKinds } from '../../scoring';
import { Sound } from '../../sound';
import { Haptics } from '../../haptics';
import { finishGameSession } from '../../state';
import { gameUtilBarHtml, wireGameChrome } from '../../gameChrome';

const GRID = 14;
const TICK_MS = 150;
const SWIPE_THRESHOLD = 20;

type Vec = { x: number; y: number };
type Phase = 'idle' | 'playing' | 'gameover';

const MAX_QUEUED_TURNS = 2;

interface SnakeState {
  snake: Vec[];
  direction: Vec;
  /** Buffered turns (see queueDirection) — a small queue instead of a single overwritable value so a quick double-swipe/key-tap doesn't drop a turn. */
  queuedDirection: Vec[];
  food: Vec;
  phase: Phase;
  tickId: ReturnType<typeof setInterval> | null;
  score: number;
}

const DIRS: Record<string, Vec> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

let state: SnakeState = makeInitialState();
let swipeStart: { x: number; y: number } | null = null;
let swipeArmed = false;

function randomEmptyCell(snake: Vec[]): Vec {
  let cell: Vec;
  do {
    cell = { x: Math.floor(Math.random() * GRID), y: Math.floor(Math.random() * GRID) };
  } while (snake.some((s) => s.x === cell.x && s.y === cell.y));
  return cell;
}

function makeInitialState(): SnakeState {
  const start: Vec[] = [
    { x: 6, y: 7 },
    { x: 5, y: 7 },
    { x: 4, y: 7 },
  ];
  return {
    snake: start,
    direction: { x: 1, y: 0 },
    queuedDirection: [],
    food: randomEmptyCell(start),
    phase: 'idle',
    tickId: null,
    score: 0,
  };
}

function main(): HTMLElement {
  return document.getElementById('main')!;
}

export function renderSnakeGame(): void {
  if (state.tickId) clearInterval(state.tickId);
  state = makeInitialState();
  swipeStart = null;
  swipeArmed = false;
  drawShell();
  wireGameChrome('snake', renderSnakeGame);
}

function drawShell(): void {
  main().innerHTML = `
    <div class="page">
      <div class="game-shell">
        <div class="game-topbar">
          <span>SNAKE</span>
          <span class="mono" id="snakeScore">POINT: 0</span>
        </div>
        ${gameUtilBarHtml()}
        <div id="snakeArea"></div>
      </div>
    </div>
  `;
  drawArea();
}

function drawArea(): void {
  const area = document.getElementById('snakeArea')!;
  if (state.phase === 'idle') {
    area.innerHTML = `
      <div class="arena">
        <div class="arena-inner">
          <div class="arena-title">Klar?</div>
          <ul class="instructions-list">
            <li>Swipe eller brug pilene for at styre slangen</li>
            <li>Spis mad for at vokse</li>
            <li>Ram ikke væggen eller dig selv</li>
          </ul>
          <button class="btn btn-primary btn-lg" id="snakeStartBtn">START</button>
        </div>
      </div>
    `;
    document.getElementById('snakeStartBtn')!.addEventListener('click', (e) => {
      e.stopPropagation();
      startGame();
    });
  } else if (state.phase === 'playing') {
    area.innerHTML = `
      <div class="snake-wrap">
        <div class="snake-grid" id="snakeGrid"></div>
      </div>
    `;
    renderGrid();
    wireControls();
  }
}

function startGame(): void {
  state.phase = 'playing';
  drawArea();
  state.tickId = setInterval(tick, TICK_MS);
}

function isReversal(next: Vec, current: Vec): boolean {
  return next.x === -current.x && next.y === -current.y;
}

/** The direction a newly-queued turn should be checked against: the last already-buffered turn if there is one, otherwise the snake's current live direction. */
function lastEffectiveDirection(): Vec {
  const q = state.queuedDirection;
  return q.length > 0 ? q[q.length - 1] : state.direction;
}

function queueDirection(next: Vec): void {
  if (state.queuedDirection.length >= MAX_QUEUED_TURNS) return;
  const prev = lastEffectiveDirection();
  if (isReversal(next, prev)) return;
  if (next.x === prev.x && next.y === prev.y) return; // no-op turn, don't waste a buffer slot
  state.queuedDirection.push(next);
}

const ARROW_KEY_DIRS: Record<string, Vec> = {
  ArrowUp: DIRS.up,
  ArrowDown: DIRS.down,
  ArrowLeft: DIRS.left,
  ArrowRight: DIRS.right,
};

function handleKeyDown(e: KeyboardEvent): void {
  // Stale listener from a round the player has since navigated away from — see the
  // matching DOM-presence bail-out pattern in tick(). Without this it'd keep
  // preventDefault()-ing arrow keys (and queueing phantom turns) on other pages.
  if (!document.getElementById('snakeGrid')) return;
  const dir = ARROW_KEY_DIRS[e.key];
  if (!dir || state.phase !== 'playing') return;
  e.preventDefault();
  queueDirection(dir);
}

function wireControls(): void {
  const grid = document.getElementById('snakeGrid')!;

  // The whole grid is one large swipe surface — no on-screen D-pad. Small,
  // precisely-targeted buttons proved fiddly on mobile; a full-arena swipe
  // (which pointer events already give us for free, mouse or touch) doesn't
  // require any precision at all.
  grid.addEventListener('pointerdown', (e) => {
    if (!e.isPrimary) return;
    e.preventDefault();
    swipeStart = { x: e.clientX, y: e.clientY };
    swipeArmed = true;
  });
  grid.addEventListener('pointermove', (e) => {
    if (!swipeArmed || !swipeStart || !e.isPrimary) return;
    const dx = e.clientX - swipeStart.x;
    const dy = e.clientY - swipeStart.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_THRESHOLD) return;
    if (Math.abs(dx) > Math.abs(dy)) queueDirection(dx > 0 ? DIRS.right : DIRS.left);
    else queueDirection(dy > 0 ? DIRS.down : DIRS.up);
    swipeStart = { x: e.clientX, y: e.clientY };
  });
  const endSwipe = () => {
    swipeArmed = false;
    swipeStart = null;
  };
  grid.addEventListener('pointerup', endSwipe);
  grid.addEventListener('pointercancel', endSwipe);

  // Desktop had no touch D-pad to begin with — arrow keys keep it fully playable
  // without a mouse-drag swipe. Remove-then-add so replaying doesn't stack duplicate
  // listeners (handleKeyDown is a stable function reference, so this dedupes cleanly).
  document.removeEventListener('keydown', handleKeyDown);
  document.addEventListener('keydown', handleKeyDown);
}

function tick(): void {
  // The user may have navigated to a different page mid-game — nothing else
  // clears this interval on route change, so bail out instead of silently
  // mutating/scoring a game nobody is looking at anymore.
  if (!document.getElementById('snakeGrid')) {
    if (state.tickId) clearInterval(state.tickId);
    state.tickId = null;
    return;
  }
  if (state.queuedDirection.length > 0) {
    const next = state.queuedDirection.shift()!;
    if (!isReversal(next, state.direction)) {
      state.direction = next;
    }
  }

  const head = state.snake[0];
  const newHead: Vec = { x: head.x + state.direction.x, y: head.y + state.direction.y };

  if (newHead.x < 0 || newHead.x >= GRID || newHead.y < 0 || newHead.y >= GRID) {
    endGame();
    return;
  }
  const willEat = newHead.x === state.food.x && newHead.y === state.food.y;
  const bodyToCheck = willEat ? state.snake : state.snake.slice(0, -1);
  if (bodyToCheck.some((s) => s.x === newHead.x && s.y === newHead.y)) {
    endGame();
    return;
  }

  state.snake = [newHead, ...state.snake];
  if (willEat) {
    state.score++;
    state.food = randomEmptyCell(state.snake);
    Sound.eat();
    Haptics.hit();
    const scoreEl = document.getElementById('snakeScore');
    if (scoreEl) scoreEl.textContent = `POINT: ${state.score}`;
  } else {
    state.snake.pop();
  }
  renderGrid();
}

function renderGrid(): void {
  const grid = document.getElementById('snakeGrid');
  if (!grid) return;
  const snakeSet = new Set(state.snake.map((s) => `${s.x},${s.y}`));
  const head = state.snake[0];
  const cells: string[] = [];
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const isHead = head.x === x && head.y === y;
      const isFood = state.food.x === x && state.food.y === y;
      const isBody = !isHead && snakeSet.has(`${x},${y}`);
      let cls = 'snake-cell';
      if (isHead) cls += ' head';
      else if (isBody) cls += ' body';
      else if (isFood) cls += ' food';
      cells.push(`<div class="${cls}"></div>`);
    }
  }
  grid.innerHTML = cells.join('');
}

async function endGame(): Promise<void> {
  if (state.tickId) clearInterval(state.tickId);
  state.tickId = null;
  state.phase = 'gameover';
  Sound.death();
  Haptics.miss();
  const { isNewBest, xpGain, rank } = await finishGameSession('snake', state.score);
  Sound.complete();
  if (isNewBest) {
    setTimeout(() => Sound.pb(), 250);
    Haptics.personalBest();
  }
  drawFinalScreen(state.score, state.snake.length, isNewBest, xpGain, rank);
}

function drawFinalScreen(score: number, length: number, isNewBest: boolean, xpGain: number, rank: number | null): void {
  const rating = ScoreKinds.snake_score.rating(score);
  main().innerHTML = `
    <div class="page">
      <div class="game-shell">
        <div class="final-wrap">
          <div class="final-label">Din score</div>
          <div class="final-score">${score}</div>
          <div class="final-rating" style="color:${rating.color}">${rating.label}</div>
          ${isNewBest ? '<div class="pb-flag">★ NY PERSONLIG REKORD</div>' : ''}
          <div class="xp-toast">✦ +${xpGain} XP optjent${rank && rank <= 3 ? ' · TOP 3-BONUS' : ''}</div>

          <div class="final-stats">
            <div class="fstat"><div class="n">${score}</div><div class="l">Point</div></div>
            <div class="fstat"><div class="n">${length}</div><div class="l">Længde</div></div>
            <div class="fstat"><div class="n">${rank ? '#' + rank : '—'}</div><div class="l">Placering</div></div>
            <div class="fstat"><div class="n">+${xpGain}</div><div class="l">XP optjent</div></div>
          </div>

          <div class="final-ctas">
            <button class="btn btn-primary btn-lg" id="snakePlayAgainBtn">SPIL IGEN</button>
            <button class="btn btn-ghost btn-lg" data-nav="leaderboard-snake">LEADERBOARD</button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.getElementById('snakePlayAgainBtn')!.addEventListener('click', () => {
    Sound.click();
    renderSnakeGame();
  });
}
