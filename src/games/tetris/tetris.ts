import { ScoreKinds } from '../../scoring';
import { Sound } from '../../sound';
import { Haptics } from '../../haptics';
import { finishGameSession } from '../../state';
import { gameUtilBarHtml, wireGameChrome } from '../../gameChrome';

const COLS = 10;
const ROWS = 20;
const LOCK_DELAY_MS = 500;
/** Real Tetris caps how many times a lock can be pushed back by moving/rotating while grounded
 * — otherwise a piece could spin forever on the floor and never lock. */
const MAX_LOCK_RESETS = 15;
const SOFT_DROP_MS = 35;
const DAS_DELAY_MS = 170;
const DAS_REPEAT_MS = 50;
const LINE_CLEAR_FLASH_MS = 260;
const LINE_SCORES = [0, 100, 300, 500, 800]; // index = lines cleared in one lock

type PieceId = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';
type Cell = [number, number];

interface PieceType {
  id: PieceId;
  color: string;
  size: number;
  baseCells: Cell[];
}

/** Every shape defined once at its spawn orientation; rotate() derives the other 3 states by
 * rotating the cell coordinates within the piece's own size×size box — no hand-written rotation
 * tables to get subtly wrong. O happens to fill its whole 2×2 box, so the same formula is a
 * geometric no-op for it — no special case needed. */
const PIECES: PieceType[] = [
  { id: 'I', color: '#22d3ee', size: 4, baseCells: [[0, 1], [1, 1], [2, 1], [3, 1]] },
  { id: 'O', color: '#facc15', size: 2, baseCells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  { id: 'T', color: '#a855f7', size: 3, baseCells: [[1, 0], [0, 1], [1, 1], [2, 1]] },
  { id: 'S', color: '#4ade80', size: 3, baseCells: [[1, 0], [2, 0], [0, 1], [1, 1]] },
  { id: 'Z', color: '#f87171', size: 3, baseCells: [[0, 0], [1, 0], [1, 1], [2, 1]] },
  { id: 'J', color: '#60a5fa', size: 3, baseCells: [[0, 0], [0, 1], [1, 1], [2, 1]] },
  { id: 'L', color: '#fb923c', size: 3, baseCells: [[2, 0], [0, 1], [1, 1], [2, 1]] },
];

/** Small, deliberately-not-official-SRS wall-kick attempts: in place, shift a step sideways,
 * shift up a step, then the same two steps further out. Handles the vast majority of real
 * rotate-near-a-wall/near-the-stack situations without needing the full guideline kick tables. */
const KICKS: Cell[] = [[0, 0], [-1, 0], [1, 0], [0, -1], [-2, 0], [2, 0]];

type Phase = 'idle' | 'playing' | 'gameover';

interface ActivePiece {
  type: PieceType;
  rotation: number;
  cells: Cell[];
  x: number;
  y: number;
}

interface TetrisState {
  phase: Phase;
  board: (string | null)[][];
  queue: PieceType[];
  current: ActivePiece | null;
  hold: PieceType | null;
  holdUsed: boolean;
  score: number;
  lines: number;
  level: number;
  paused: boolean;
  clearingRows: number[] | null;
  dropAcc: number;
  lockAcc: number;
  lockResets: number;
  softDropping: boolean;
  rafId: number | null;
  lastT: number;
  clearTimeoutId: ReturnType<typeof setTimeout> | null;
}

let state: TetrisState = makeInitialState();
let dasTimer: ReturnType<typeof setTimeout> | null = null;
let dasInterval: ReturnType<typeof setInterval> | null = null;
let dasDir: -1 | 0 | 1 = 0;

function makeInitialState(): TetrisState {
  return {
    phase: 'idle',
    board: Array.from({ length: ROWS }, () => new Array<string | null>(COLS).fill(null)),
    queue: [],
    current: null,
    hold: null,
    holdUsed: false,
    score: 0,
    lines: 0,
    level: 1,
    paused: false,
    clearingRows: null,
    dropAcc: 0,
    lockAcc: 0,
    lockResets: 0,
    softDropping: false,
    rafId: null,
    lastT: 0,
    clearTimeoutId: null,
  };
}

function main(): HTMLElement {
  return document.getElementById('main')!;
}
function boardEl(): HTMLElement | null {
  return document.getElementById('tetrisBoard');
}

function clearDAS(): void {
  if (dasTimer) clearTimeout(dasTimer);
  if (dasInterval) clearInterval(dasInterval);
  dasTimer = null;
  dasInterval = null;
  dasDir = 0;
}

export function renderTetrisGame(): void {
  if (state.rafId != null) cancelAnimationFrame(state.rafId);
  if (state.clearTimeoutId) clearTimeout(state.clearTimeoutId);
  clearDAS();
  state = makeInitialState();
  drawShell();
  wireGameChrome('tetris', renderTetrisGame);
}

function drawShell(): void {
  main().innerHTML = `
    <div class="page">
      <div class="game-shell">
        <div class="game-topbar">
          <span>TETRIS</span>
          <span style="display:flex;align-items:center;gap:10px">
            <button class="tetris-pause-btn" id="tetrisPauseBtn" title="Pause" style="display:none">⏸</button>
            <span class="mono" id="tetrisScoreLabel">0 POINT</span>
          </span>
        </div>
        ${gameUtilBarHtml()}
        <div id="tetrisArea"></div>
      </div>
    </div>
  `;
  drawArea();
}

function drawArea(): void {
  const area = document.getElementById('tetrisArea');
  if (!area) return;
  if (state.phase === 'idle') {
    area.innerHTML = `
      <div class="arena">
        <div class="arena-inner">
          <div class="arena-title">Klar til at bygge?</div>
          <ul class="instructions-list">
            <li>Pile eller knapperne styrer: Op/tap roterer, Space/DROP hard-dropper</li>
            <li>Klar linjer for point, flere på én gang giver mere</li>
            <li>Farten stiger med niveauet, hold styr på tempoet</li>
          </ul>
          <button class="btn btn-primary btn-lg" id="tetrisStartBtn">START</button>
        </div>
      </div>
    `;
    document.getElementById('tetrisStartBtn')!.addEventListener('click', (e) => {
      e.stopPropagation();
      startGame();
    });
  } else if (state.phase === 'playing') {
    area.innerHTML = `
      <div class="tetris-wrap">
        <div class="tetris-board-col">
          <div class="tetris-board" id="tetrisBoard">
            <div class="tetris-locked-grid" id="tetrisLockedGrid"></div>
            <div class="tetris-ghost-layer" id="tetrisGhostLayer"></div>
            <div class="tetris-piece-layer" id="tetrisPieceLayer"></div>
            <div class="tetris-pause-overlay" id="tetrisPauseOverlay" style="display:none">PAUSET<span>tryk P for at fortsætte</span></div>
          </div>
          <div class="tetris-controls">
            <button class="tetris-ctrl" data-act="rotccw" aria-label="Rotér mod uret">↺</button>
            <button class="tetris-ctrl" data-act="left" aria-label="Venstre">←</button>
            <button class="tetris-ctrl" data-act="down" aria-label="Blødt drop">▼</button>
            <button class="tetris-ctrl" data-act="right" aria-label="Højre">→</button>
            <button class="tetris-ctrl" data-act="rotcw" aria-label="Rotér med uret">↻</button>
          </div>
          <div class="tetris-controls tetris-controls-wide">
            <button class="tetris-ctrl-wide" data-act="hold">HOLD</button>
            <button class="tetris-ctrl-wide primary" data-act="harddrop">HARD DROP</button>
          </div>
        </div>
        <div class="tetris-side">
          <div class="tetris-panel">
            <div class="tetris-panel-label">HOLD</div>
            <div class="tetris-hold" id="tetrisHold"></div>
          </div>
          <div class="tetris-panel">
            <div class="tetris-panel-label">NÆSTE</div>
            <div class="tetris-next" id="tetrisNext"></div>
          </div>
          <div class="tetris-panel tetris-stats">
            <div class="tetris-stat"><span class="l">NIVEAU</span><span class="v" id="tetrisLevel">1</span></div>
            <div class="tetris-stat"><span class="l">LINJER</span><span class="v" id="tetrisLines">0</span></div>
          </div>
        </div>
      </div>
    `;
    const pauseBtn = document.getElementById('tetrisPauseBtn');
    if (pauseBtn) pauseBtn.style.display = '';
    renderLockedBoard();
    renderSidePanels();
    wireControls();
  }
}

// ---- piece geometry -------------------------------------------------------

function cellsForRotation(type: PieceType, rotation: number): Cell[] {
  let cells = type.baseCells;
  for (let i = 0; i < rotation; i++) {
    cells = cells.map(([x, y]): Cell => [type.size - 1 - y, x]);
  }
  return cells;
}

function shuffledBag(): PieceType[] {
  const bag = [...PIECES];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

function ensureQueue(): void {
  while (state.queue.length < 7) state.queue.push(...shuffledBag());
}

function collidesAt(x: number, y: number, cells: Cell[]): boolean {
  for (const [cx, cy] of cells) {
    const bx = x + cx;
    const by = y + cy;
    if (bx < 0 || bx >= COLS || by >= ROWS) return true;
    if (by >= 0 && state.board[by][bx]) return true;
  }
  return false;
}

function spawnPiece(): void {
  ensureQueue();
  const type = state.queue.shift()!;
  ensureQueue();
  const rotation = 0;
  const cells = cellsForRotation(type, rotation);
  const x = Math.floor((COLS - type.size) / 2);
  const y = 0;
  state.current = { type, rotation, cells, x, y };
  state.holdUsed = false;
  state.dropAcc = 0;
  state.lockAcc = 0;
  state.lockResets = 0;
  if (collidesAt(x, y, cells)) {
    state.current = null;
    void gameOver();
    return;
  }
  renderSidePanels();
  renderActivePiece();
  renderGhost();
}

// ---- movement / rotation ---------------------------------------------------

function tryMove(dx: number, dy: number): boolean {
  const p = state.current;
  if (!p || state.phase !== 'playing' || state.paused || state.clearingRows) return false;
  if (collidesAt(p.x + dx, p.y + dy, p.cells)) return false;
  p.x += dx;
  p.y += dy;
  onPlayerAction();
  return true;
}

function tryRotate(dir: 1 | -1): void {
  const p = state.current;
  if (!p || state.phase !== 'playing' || state.paused || state.clearingRows) return;
  const newRotation = (p.rotation + dir + 4) % 4;
  const newCells = cellsForRotation(p.type, newRotation);
  for (const [kx, ky] of KICKS) {
    if (!collidesAt(p.x + kx, p.y + ky, newCells)) {
      p.x += kx;
      p.y += ky;
      p.rotation = newRotation;
      p.cells = newCells;
      Sound.click();
      onPlayerAction();
      return;
    }
  }
}

/** Called after any successful player-initiated move/rotate. If the piece is (still or newly)
 * resting on something, gives it a fresh lock-delay window rather than letting an in-flight
 * timer expire mid-adjustment — capped by MAX_LOCK_RESETS so a piece can't be spun forever. */
function onPlayerAction(): void {
  const p = state.current;
  if (!p) return;
  if (collidesAt(p.x, p.y + 1, p.cells)) {
    if (state.lockResets < MAX_LOCK_RESETS) {
      state.lockAcc = 0;
      state.lockResets++;
    }
  } else {
    state.lockAcc = 0;
    state.lockResets = 0;
  }
  renderActivePiece();
}

function ghostY(): number {
  const p = state.current!;
  let y = p.y;
  while (!collidesAt(p.x, y + 1, p.cells)) y++;
  return y;
}

function hardDrop(): void {
  const p = state.current;
  if (!p || state.phase !== 'playing' || state.paused || state.clearingRows) return;
  const gy = ghostY();
  state.score += (gy - p.y) * 2;
  p.y = gy;
  Sound.whoosh();
  updateScoreLabel();
  lockPiece();
}

function holdPiece(): void {
  const p = state.current;
  if (!p || state.holdUsed || state.phase !== 'playing' || state.paused || state.clearingRows) return;
  const swappedIn = state.hold;
  state.hold = p.type;
  state.holdUsed = true;
  if (swappedIn) {
    const rotation = 0;
    const cells = cellsForRotation(swappedIn, rotation);
    const x = Math.floor((COLS - swappedIn.size) / 2);
    state.current = { type: swappedIn, rotation, cells, x, y: 0 };
    state.dropAcc = 0;
    state.lockAcc = 0;
    state.lockResets = 0;
    if (collidesAt(x, 0, cells)) {
      state.current = null;
      void gameOver();
      return;
    }
  } else {
    state.current = null;
    spawnPiece();
    // spawnPiece() resets holdUsed for the normal lock→spawn flow — reassert it here since
    // this spawn was itself triggered by a hold, which must still count as "used" until
    // whatever's now active actually locks.
    state.holdUsed = true;
  }
  Sound.click();
  renderSidePanels();
  renderActivePiece();
  renderGhost();
}

// ---- locking / line clears --------------------------------------------------

function lockPiece(): void {
  const p = state.current;
  if (!p) return;
  for (const [cx, cy] of p.cells) {
    const bx = p.x + cx;
    const by = p.y + cy;
    if (by < 0) {
      // Locked while still (partly) above the visible board — topped out.
      state.current = null;
      void gameOver();
      return;
    }
    state.board[by][bx] = p.type.color;
  }
  state.current = null;
  Haptics.tap();

  const fullRows: number[] = [];
  for (let r = 0; r < ROWS; r++) {
    if (state.board[r].every((c) => c !== null)) fullRows.push(r);
  }

  renderLockedBoard();
  document.getElementById('tetrisPieceLayer')!.innerHTML = '';
  document.getElementById('tetrisGhostLayer')!.innerHTML = '';

  if (fullRows.length === 0) {
    Sound.place();
    spawnPiece();
    return;
  }

  state.clearingRows = fullRows;
  flashClearingRows(fullRows);
  if (fullRows.length >= 4) {
    Sound.perfect();
    Haptics.legendary();
  } else {
    Sound.hit();
    Haptics.hit();
  }
  state.clearTimeoutId = setTimeout(() => finalizeClear(fullRows), LINE_CLEAR_FLASH_MS);
}

function flashClearingRows(rows: number[]): void {
  const grid = document.getElementById('tetrisLockedGrid');
  if (!grid) return;
  for (const r of rows) {
    for (let c = 0; c < COLS; c++) {
      const cell = grid.children[r * COLS + c] as HTMLElement | undefined;
      cell?.classList.add('clearing');
    }
  }
}

function finalizeClear(rows: number[]): void {
  state.clearTimeoutId = null;
  const rowSet = new Set(rows);
  const remaining = state.board.filter((_, i) => !rowSet.has(i));
  const empties = Array.from({ length: rows.length }, () => new Array<string | null>(COLS).fill(null));
  state.board = [...empties, ...remaining];

  const cleared = rows.length;
  const prevLevel = state.level;
  state.lines += cleared;
  state.level = Math.floor(state.lines / 10) + 1;
  state.score += LINE_SCORES[cleared] * prevLevel;
  state.clearingRows = null;

  updateScoreLabel();
  renderLockedBoard();
  renderSidePanels();
  if (state.level > prevLevel) Sound.achievement();

  if (!document.getElementById('tetrisBoard')) return; // navigated away mid-clear
  spawnPiece();
}

// ---- game loop ---------------------------------------------------------

function dropIntervalMs(level: number): number {
  return Math.max(120, 800 - (level - 1) * 60);
}

function startGame(): void {
  state.phase = 'playing';
  state.board = Array.from({ length: ROWS }, () => new Array<string | null>(COLS).fill(null));
  state.queue = [];
  state.hold = null;
  state.score = 0;
  state.lines = 0;
  state.level = 1;
  state.paused = false;
  state.clearingRows = null;
  drawArea();
  updateScoreLabel();
  Sound.countdown();
  ensureQueue();
  spawnPiece();
  state.lastT = performance.now();
  state.rafId = requestAnimationFrame(loop);
}

function loop(t: number): void {
  if (!boardEl() || state.phase !== 'playing') {
    state.rafId = null;
    return;
  }
  const dt = Math.min(0.05, (t - state.lastT) / 1000);
  state.lastT = t;

  if (!state.paused && !state.clearingRows && state.current) {
    const p = state.current;
    const grounded = collidesAt(p.x, p.y + 1, p.cells);
    if (grounded) {
      state.lockAcc += dt * 1000;
      if (state.lockAcc >= LOCK_DELAY_MS) {
        lockPiece();
      }
    } else {
      state.lockAcc = 0;
      state.lockResets = 0;
      const interval = state.softDropping ? SOFT_DROP_MS : dropIntervalMs(state.level);
      state.dropAcc += dt * 1000;
      if (state.dropAcc >= interval) {
        state.dropAcc -= interval;
        p.y += 1;
        if (state.softDropping) {
          state.score += 1;
          updateScoreLabel();
        }
        renderActivePiece();
        renderGhost();
      }
    }
  }
  state.rafId = requestAnimationFrame(loop);
}

// ---- rendering -----------------------------------------------------------

function renderLockedBoard(): void {
  const grid = document.getElementById('tetrisLockedGrid');
  if (!grid) return;
  const cells: string[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const color = state.board[r][c];
      cells.push(color ? `<div class="tetris-cell filled" style="background:${color}"></div>` : `<div class="tetris-cell"></div>`);
    }
  }
  grid.innerHTML = cells.join('');
}

function renderActivePiece(): void {
  const layer = document.getElementById('tetrisPieceLayer');
  if (!layer || !state.current) return;
  const p = state.current;
  const abs = p.cells.map(([cx, cy]): Cell => [p.x + cx, p.y + cy]).filter(([, y]) => y >= 0);
  layer.innerHTML = abs
    .map(
      ([x, y]) =>
        `<div class="tetris-piece-cell" style="left:${(x / COLS) * 100}%;top:${(y / ROWS) * 100}%;width:${(1 / COLS) * 100}%;height:${(1 / ROWS) * 100}%;background:${p.type.color}"></div>`,
    )
    .join('');
}

function renderGhost(): void {
  const layer = document.getElementById('tetrisGhostLayer');
  if (!layer || !state.current) return;
  const p = state.current;
  const gy = ghostY();
  if (gy === p.y) {
    layer.innerHTML = '';
    return;
  }
  const abs = p.cells.map(([cx, cy]): Cell => [p.x + cx, gy + cy]).filter(([, y]) => y >= 0);
  layer.innerHTML = abs
    .map(
      ([x, y]) =>
        `<div class="tetris-ghost-cell" style="left:${(x / COLS) * 100}%;top:${(y / ROWS) * 100}%;width:${(1 / COLS) * 100}%;height:${(1 / ROWS) * 100}%;border-color:${p.type.color}"></div>`,
    )
    .join('');
}

function miniPieceHtml(type: PieceType | null): string {
  if (!type) return '<div class="tetris-mini-empty">—</div>';
  const cells = type.baseCells;
  return `
    <div class="tetris-mini-grid" style="grid-template-columns:repeat(${type.size},1fr);grid-template-rows:repeat(${type.size},1fr)">
      ${Array.from({ length: type.size * type.size }, (_, i) => {
        const x = i % type.size;
        const y = Math.floor(i / type.size);
        const filled = cells.some(([cx, cy]) => cx === x && cy === y);
        return `<div class="tetris-mini-cell" style="${filled ? `background:${type.color}` : ''}"></div>`;
      }).join('')}
    </div>
  `;
}

function renderSidePanels(): void {
  const holdEl = document.getElementById('tetrisHold');
  if (holdEl) holdEl.innerHTML = miniPieceHtml(state.hold);
  const nextEl = document.getElementById('tetrisNext');
  if (nextEl) {
    ensureQueue();
    nextEl.innerHTML = state.queue.slice(0, 3).map(miniPieceHtml).join('');
  }
  const levelEl = document.getElementById('tetrisLevel');
  if (levelEl) levelEl.textContent = `${state.level}`;
  const linesEl = document.getElementById('tetrisLines');
  if (linesEl) linesEl.textContent = `${state.lines}`;
}

function updateScoreLabel(): void {
  const el = document.getElementById('tetrisScoreLabel');
  if (el) el.textContent = `${state.score} POINT`;
}

// ---- input ---------------------------------------------------------------

function startSoftDrop(): void {
  if (state.softDropping) return;
  state.softDropping = true;
  state.dropAcc = 0;
}
function stopSoftDrop(): void {
  state.softDropping = false;
}

function startDAS(dir: -1 | 1): void {
  if (dasDir === dir) return;
  clearDAS();
  dasDir = dir;
  tryMove(dir, 0);
  renderGhost();
  dasTimer = setTimeout(() => {
    dasInterval = setInterval(() => {
      tryMove(dir, 0);
      renderGhost();
    }, DAS_REPEAT_MS);
  }, DAS_DELAY_MS);
}

function togglePause(): void {
  if (state.phase !== 'playing') return;
  state.paused = !state.paused;
  const overlay = document.getElementById('tetrisPauseOverlay');
  if (overlay) overlay.style.display = state.paused ? 'flex' : 'none';
  if (state.paused) clearDAS();
  Sound.click();
}

function handleKeyDown(e: KeyboardEvent): void {
  if (!boardEl() || state.phase !== 'playing') return;
  if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
    e.preventDefault();
    togglePause();
    return;
  }
  if (state.paused) return;
  if (e.key === 'ArrowLeft') {
    if (!e.repeat) startDAS(-1);
    e.preventDefault();
  } else if (e.key === 'ArrowRight') {
    if (!e.repeat) startDAS(1);
    e.preventDefault();
  } else if (e.key === 'ArrowDown') {
    if (!e.repeat) startSoftDrop();
    e.preventDefault();
  } else if (e.key === 'ArrowUp' || e.key === 'x' || e.key === 'X') {
    if (!e.repeat) { tryRotate(1); renderGhost(); }
    e.preventDefault();
  } else if (e.key === 'z' || e.key === 'Z') {
    if (!e.repeat) { tryRotate(-1); renderGhost(); }
    e.preventDefault();
  } else if (e.key === ' ') {
    if (!e.repeat) hardDrop();
    e.preventDefault();
  } else if (e.key === 'c' || e.key === 'C' || e.key === 'Shift') {
    if (!e.repeat) holdPiece();
    e.preventDefault();
  }
}

function handleKeyUp(e: KeyboardEvent): void {
  if (!boardEl()) return;
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    if (dasDir === (e.key === 'ArrowLeft' ? -1 : 1)) clearDAS();
  } else if (e.key === 'ArrowDown') {
    stopSoftDrop();
  }
}

function wireControls(): void {
  document.removeEventListener('keydown', handleKeyDown);
  document.addEventListener('keydown', handleKeyDown);
  document.removeEventListener('keyup', handleKeyUp);
  document.addEventListener('keyup', handleKeyUp);

  document.getElementById('tetrisPauseBtn')?.addEventListener('click', togglePause);

  document.querySelectorAll<HTMLButtonElement>('.tetris-ctrl, .tetris-ctrl-wide').forEach((btn) => {
    const act = btn.dataset.act;
    if (act === 'left' || act === 'right') {
      const dir = act === 'left' ? -1 : 1;
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (state.paused) return;
        startDAS(dir);
      });
      btn.addEventListener('pointerup', () => {
        if (dasDir === dir) clearDAS();
      });
      btn.addEventListener('pointerleave', () => {
        if (dasDir === dir) clearDAS();
      });
    } else if (act === 'down') {
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (!state.paused) startSoftDrop();
      });
      btn.addEventListener('pointerup', stopSoftDrop);
      btn.addEventListener('pointerleave', stopSoftDrop);
    } else if (act === 'rotcw') {
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (!state.paused) { tryRotate(1); renderGhost(); }
      });
    } else if (act === 'rotccw') {
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (!state.paused) { tryRotate(-1); renderGhost(); }
      });
    } else if (act === 'harddrop') {
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (!state.paused) hardDrop();
      });
    } else if (act === 'hold') {
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (!state.paused) holdPiece();
      });
    }
  });
}

// ---- end of game -----------------------------------------------------------

async function gameOver(): Promise<void> {
  if (state.rafId != null) cancelAnimationFrame(state.rafId);
  state.rafId = null;
  if (state.clearTimeoutId) clearTimeout(state.clearTimeoutId);
  state.clearTimeoutId = null;
  clearDAS();
  state.phase = 'gameover';
  Sound.death();
  Haptics.miss();
  const { isNewBest, xpGain, rank } = await finishGameSession('tetris', state.score);
  if (!document.getElementById('main')) return;
  Sound.complete();
  if (isNewBest) {
    setTimeout(() => Sound.pb(), 250);
    Haptics.personalBest();
  }
  drawFinalScreen(isNewBest, xpGain, rank);
}

function drawFinalScreen(isNewBest: boolean, xpGain: number, rank: number | null): void {
  const rating = ScoreKinds.tetris_score.rating(state.score);
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
            <div class="fstat"><div class="n">${state.score}</div><div class="l">Point</div></div>
            <div class="fstat"><div class="n">${state.lines}</div><div class="l">Linjer</div></div>
            <div class="fstat"><div class="n">${rank ? '#' + rank : '—'}</div><div class="l">Placering</div></div>
            <div class="fstat"><div class="n">+${xpGain}</div><div class="l">XP optjent</div></div>
          </div>

          <div class="final-ctas">
            <button class="btn btn-primary btn-lg" id="tetrisPlayAgainBtn">SPIL IGEN</button>
            <button class="btn btn-ghost btn-lg" data-nav="leaderboard-tetris">LEADERBOARD</button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.getElementById('tetrisPlayAgainBtn')!.addEventListener('click', () => {
    Sound.click();
    renderTetrisGame();
  });
}
