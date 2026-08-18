import { ScoreKinds } from '../../scoring';
import { Sound } from '../../sound';
import { Haptics } from '../../haptics';
import { finishGameSession } from '../../state';
import { gameUtilBarHtml, wireGameChrome } from '../../gameChrome';
import { storage } from '../../storage';

const SIZE = 4;
const SWIPE_THRESHOLD = 24;
const SLIDE_MS = 150;
/** Merges into a tile at/above this value get the bigger "big" pop treatment instead of the standard one. */
const BIG_MERGE_THRESHOLD = 128;

type Direction = 'up' | 'down' | 'left' | 'right';
type Phase = 'idle' | 'playing' | 'gameover';

interface Tile {
  id: number;
  value: number;
  merged: boolean;
  isNew: boolean;
}
type Cell = Tile | null;
type Grid = Cell[][];

interface MergeState {
  grid: Grid;
  phase: Phase;
  best: number;
  moves: number;
}

interface SavedMergeState {
  grid: Grid;
  best: number;
  moves: number;
  nextId: number;
}
const SAVE_KEY = 'inprogress:merge';

async function saveInProgress(): Promise<void> {
  await storage.set<SavedMergeState>(SAVE_KEY, { grid: state.grid, best: state.best, moves: state.moves, nextId }, false);
}

async function clearInProgress(): Promise<void> {
  await storage.remove(SAVE_KEY, false);
}

let nextId = 1;
let state: MergeState = makeInitialState();
let swipeStart: { x: number; y: number } | null = null;
let swipeTriggered = false;
/** Persistent DOM elements keyed by tile id — lets a slide read as motion (CSS transform transition) instead of destroy/rebuild every move. */
let tileEls: Map<number, HTMLElement> = new Map();

function emptyGrid(): Grid {
  return Array.from({ length: SIZE }, () => Array<Cell>(SIZE).fill(null));
}

function makeInitialState(): MergeState {
  const grid = emptyGrid();
  spawnTile(grid);
  spawnTile(grid);
  return { grid, phase: 'idle', best: highestValue(grid), moves: 0 };
}

function highestValue(g: Grid): number {
  let best = 0;
  for (const row of g) for (const c of row) if (c && c.value > best) best = c.value;
  return best;
}

/** Sum of every tile still on the board — the actual submitted score (see endGame), so a board
 * full of mid-value tiles counts for something instead of only the single biggest tile mattering.
 * highestValue() above is kept separately as a "best tile ever reached" stat, shown on the
 * result screen but no longer what gets ranked. */
function boardSum(g: Grid): number {
  let sum = 0;
  for (const row of g) for (const c of row) if (c) sum += c.value;
  return sum;
}

function randomEmptyCell(g: Grid): { row: number; col: number } | null {
  const empties: { row: number; col: number }[] = [];
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (!g[r][c]) empties.push({ row: r, col: c });
  if (!empties.length) return null;
  return empties[Math.floor(Math.random() * empties.length)];
}

function spawnTile(g: Grid): void {
  const cell = randomEmptyCell(g);
  if (!cell) return;
  const value = Math.random() < 0.9 ? 2 : 4;
  g[cell.row][cell.col] = { id: nextId++, value, merged: false, isNew: true };
}

function getLine(g: Grid, dir: Direction, idx: number): Cell[] {
  let arr: Cell[];
  if (dir === 'left' || dir === 'right') arr = [...g[idx]];
  else arr = [g[0][idx], g[1][idx], g[2][idx], g[3][idx]];
  if (dir === 'right' || dir === 'down') arr = arr.reverse();
  return arr;
}

function putLine(g: Grid, dir: Direction, idx: number, line: Cell[]): void {
  const arr = dir === 'right' || dir === 'down' ? [...line].reverse() : line;
  if (dir === 'left' || dir === 'right') g[idx] = arr;
  else for (let r = 0; r < SIZE; r++) g[r][idx] = arr[r];
}

/** Converts a (line index, in-line result slot) pair back to grid (row, col) — mirrors putLine's reversal-for-right/down rule, needed so animated tiles know where to slide TO. */
function resolveGridPos(dir: Direction, idx: number, lineIdx: number): { row: number; col: number } {
  const actualLineIdx = dir === 'right' || dir === 'down' ? SIZE - 1 - lineIdx : lineIdx;
  return dir === 'left' || dir === 'right' ? { row: idx, col: actualLineIdx } : { row: actualLineIdx, col: idx };
}

interface LineResult {
  line: Cell[];
  moved: boolean;
  mergedAny: boolean;
  /** Tiles that survived unmerged, now at result slot lineIdx (same id — the DOM element just needs repositioning). */
  moves: { id: number; lineIdx: number }[];
  /** Two consumed tiles merging into a brand-new tile id at result slot lineIdx. */
  merges: { fromIds: [number, number]; toId: number; lineIdx: number; value: number }[];
}

function processLine(line: Cell[]): LineResult {
  const tiles = line.filter((c): c is Tile => c != null);
  const result: Cell[] = [];
  const moves: LineResult['moves'] = [];
  const merges: LineResult['merges'] = [];
  let mergedAny = false;
  let i = 0;
  while (i < tiles.length) {
    const cur = tiles[i];
    const next = tiles[i + 1];
    if (next && next.value === cur.value) {
      const toId = nextId++;
      result.push({ id: toId, value: cur.value * 2, merged: true, isNew: false });
      merges.push({ fromIds: [cur.id, next.id], toId, lineIdx: result.length - 1, value: cur.value * 2 });
      mergedAny = true;
      i += 2;
    } else {
      result.push({ ...cur, merged: false, isNew: false });
      moves.push({ id: cur.id, lineIdx: result.length - 1 });
      i += 1;
    }
  }
  while (result.length < SIZE) result.push(null);
  const origVals = line.map((c) => (c ? c.value : 0));
  const newVals = result.map((c) => (c ? c.value : 0));
  const moved = origVals.some((v, idx) => v !== newVals[idx]);
  return { line: result, moved, mergedAny, moves, merges };
}

interface MoveResult {
  grid: Grid;
  moved: boolean;
  mergedAny: boolean;
  tileMoves: { id: number; row: number; col: number }[];
  tileMerges: { fromIds: [number, number]; toId: number; row: number; col: number; value: number }[];
}

function moveGrid(g: Grid, dir: Direction): MoveResult {
  const next = emptyGrid();
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) next[r][c] = g[r][c];
  let moved = false;
  let mergedAny = false;
  const tileMoves: MoveResult['tileMoves'] = [];
  const tileMerges: MoveResult['tileMerges'] = [];
  for (let idx = 0; idx < SIZE; idx++) {
    const line = getLine(next, dir, idx);
    const res = processLine(line);
    if (res.moved) moved = true;
    if (res.mergedAny) mergedAny = true;
    putLine(next, dir, idx, res.line);
    for (const m of res.moves) {
      const pos = resolveGridPos(dir, idx, m.lineIdx);
      tileMoves.push({ id: m.id, row: pos.row, col: pos.col });
    }
    for (const mg of res.merges) {
      const pos = resolveGridPos(dir, idx, mg.lineIdx);
      tileMerges.push({ fromIds: mg.fromIds, toId: mg.toId, row: pos.row, col: pos.col, value: mg.value });
    }
  }
  return { grid: next, moved, mergedAny, tileMoves, tileMerges };
}

function hasMovesLeft(g: Grid): boolean {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const cell = g[r][c];
      if (!cell) return true;
      if (c < SIZE - 1 && g[r][c + 1] && g[r][c + 1]!.value === cell.value) return true;
      if (r < SIZE - 1 && g[r + 1][c] && g[r + 1][c]!.value === cell.value) return true;
    }
  }
  return false;
}

function main(): HTMLElement {
  return document.getElementById('main')!;
}

export function renderMergeGame(): void {
  nextId = 1;
  state = makeInitialState();
  swipeStart = null;
  swipeTriggered = false;
  tileEls = new Map();
  drawShell();
  wireGameChrome('merge', renderMergeGame);
  void restoreInProgressIfAny();
}

/** Resumes an autosaved in-progress board (see saveInProgress) instead of leaving the player's
 * last session stranded — the idle "Klar?" screen renders first (synchronously, no flash) and
 * this swaps it out once the storage read resolves, unless the player already started fresh
 * (or navigated away) in the meantime. */
async function restoreInProgressIfAny(): Promise<void> {
  const saved = await storage.get<SavedMergeState>(SAVE_KEY, false);
  if (!saved || !saved.grid) return;
  if (state.phase !== 'idle' || !document.getElementById('mergeArea')) return;
  state = { grid: saved.grid, phase: 'playing', best: saved.best, moves: saved.moves };
  nextId = saved.nextId;
  drawArea();
}

function drawShell(): void {
  main().innerHTML = `
    <div class="page">
      <div class="game-shell">
        <div class="game-topbar">
          <span>MERGE</span>
          <span class="mono" id="mergeScore">HØJESTE: 0</span>
        </div>
        ${gameUtilBarHtml()}
        <div id="mergeArea"></div>
      </div>
    </div>
  `;
  drawArea();
}

function drawArea(): void {
  const area = document.getElementById('mergeArea')!;
  if (state.phase === 'idle') {
    area.innerHTML = `
      <div class="arena">
        <div class="arena-inner">
          <div class="arena-title">Klar?</div>
          <ul class="instructions-list">
            <li>Swipe for at flytte alle brikker</li>
            <li>Ens tal der rammer hinanden, flettes til det dobbelte</li>
            <li>Nå så højt et tal du kan, før pladen løber tør for træk</li>
          </ul>
          <button class="btn btn-primary btn-lg" id="mergeStartBtn">START</button>
        </div>
      </div>
    `;
    document.getElementById('mergeStartBtn')!.addEventListener('click', (e) => {
      e.stopPropagation();
      startGame();
    });
  } else if (state.phase === 'playing') {
    area.innerHTML = `
      <div class="arena">
        <div class="merge-board" id="mergeBoard">
          <div class="merge-bg-grid">${'<div class="merge-bg-cell"></div>'.repeat(SIZE * SIZE)}</div>
          <div class="merge-tiles" id="mergeTiles"></div>
        </div>
      </div>
    `;
    tileEls = new Map();
    renderInitialTiles();
    wireControls();
  }
}

function startGame(): void {
  state.phase = 'playing';
  drawArea();
}

function updateScoreLabel(): void {
  const el = document.getElementById('mergeScore');
  if (el) el.textContent = `HØJESTE: ${state.best}`;
}

function tileLenClass(value: number): string {
  const len = String(value).length;
  if (len <= 2) return 'len-2';
  if (len === 3) return 'len-3';
  return 'len-4';
}

function valueClass(value: number): string {
  return `v${value > 2048 ? 'super' : value}`;
}

/** Builds a fresh tile element positioned via transform (not left/top) so later moves can animate it with a single transition-friendly property change. */
function createTileEl(id: number, row: number, col: number, value: number, extraClass?: string): HTMLElement {
  const el = document.createElement('div');
  el.className = 'merge-tile';
  el.style.transform = `translate(${col * 100}%, ${row * 100}%)`;
  const inner = document.createElement('div');
  inner.className = ['merge-tile-inner', valueClass(value), tileLenClass(value), extraClass].filter(Boolean).join(' ');
  inner.textContent = String(value);
  el.appendChild(inner);
  document.getElementById('mergeTiles')!.appendChild(el);
  tileEls.set(id, el);
  return el;
}

/** First render of a fresh game (the two starting tiles) — no prior DOM to diff against, so just place them with the spawn pop. */
function renderInitialTiles(): void {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const tile = state.grid[r][c];
      if (tile) createTileEl(tile.id, r, c, tile.value, 'is-new');
    }
  }
}

function attemptMove(dir: Direction): void {
  if (state.phase !== 'playing') return;
  const result = moveGrid(state.grid, dir);
  if (!result.moved) return;

  const prevBest = state.best;
  state.grid = result.grid;
  state.moves++;

  // Surviving tiles just reposition — same DOM element, transform transition animates the slide.
  for (const m of result.tileMoves) {
    const el = tileEls.get(m.id);
    if (el) el.style.transform = `translate(${m.col * 100}%, ${m.row * 100}%)`;
  }

  // Merges: both consumed tiles slide into the target cell and fade out while a brand-new tile
  // pops in at that same spot — reads as "two tiles collide and become one" instead of a swap.
  let biggestMergeValue = 0;
  for (const mg of result.tileMerges) {
    biggestMergeValue = Math.max(biggestMergeValue, mg.value);
    for (const fromId of mg.fromIds) {
      const el = tileEls.get(fromId);
      tileEls.delete(fromId);
      if (!el) continue;
      el.style.transform = `translate(${mg.col * 100}%, ${mg.row * 100}%)`;
      el.classList.add('fading-out');
      setTimeout(() => el.remove(), SLIDE_MS + 40);
    }
    const isBig = mg.value >= BIG_MERGE_THRESHOLD;
    createTileEl(mg.toId, mg.row, mg.col, mg.value, isBig ? 'is-merged big' : 'is-merged');
  }

  spawnTile(state.grid);
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const tile = state.grid[r][c];
      if (tile && tile.isNew && !tileEls.has(tile.id)) createTileEl(tile.id, r, c, tile.value, 'is-new');
    }
  }

  state.best = Math.max(state.best, highestValue(state.grid));
  updateScoreLabel();

  if (result.tileMerges.length === 0) {
    Sound.click();
  } else {
    Sound.merge(biggestMergeValue);
    Haptics.hit();
    if (result.tileMerges.length >= 2) {
      // A multi-merge swipe reads as a combo — a second, slightly delayed beat on top of the
      // normal merge feedback, using the same existing cue rather than inventing new audio.
      setTimeout(() => Sound.merge(biggestMergeValue), 90);
    }
    if (biggestMergeValue > prevBest && biggestMergeValue >= BIG_MERGE_THRESHOLD) {
      setTimeout(() => {
        Sound.pb();
        Haptics.personalBest();
      }, 120);
    }
  }

  if (!hasMovesLeft(state.grid)) {
    endGame();
  } else {
    void saveInProgress();
  }
}

function wireControls(): void {
  const board = document.getElementById('mergeBoard')!;

  board.addEventListener('pointerdown', (e) => {
    if (!e.isPrimary) return;
    e.preventDefault();
    swipeStart = { x: e.clientX, y: e.clientY };
    swipeTriggered = false;
  });
  board.addEventListener('pointermove', (e) => {
    if (!swipeStart || swipeTriggered || !e.isPrimary) return;
    const dx = e.clientX - swipeStart.x;
    const dy = e.clientY - swipeStart.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_THRESHOLD) return;
    swipeTriggered = true;
    if (Math.abs(dx) > Math.abs(dy)) attemptMove(dx > 0 ? 'right' : 'left');
    else attemptMove(dy > 0 ? 'down' : 'up');
  });
  const endSwipe = () => {
    swipeStart = null;
    swipeTriggered = false;
  };
  board.addEventListener('pointerup', endSwipe);
  board.addEventListener('pointercancel', endSwipe);
}

async function endGame(): Promise<void> {
  state.phase = 'gameover';
  void clearInProgress();
  Sound.mistake();
  Haptics.miss();
  const board = document.getElementById('mergeBoard');
  board?.classList.add('game-over-flourish');
  await new Promise((r) => setTimeout(r, 320));
  // Bails if the player left this game entirely (nav to another page) during the flourish delay —
  // checking DOM presence, not just state.phase, since phase alone doesn't reset on navigation.
  if (state.phase !== 'gameover' || !document.getElementById('mergeBoard')) return;
  const score = boardSum(state.grid);
  const { isNewBest, xpGain, rank } = await finishGameSession('merge', score, { mergeBestTile: state.best });
  Sound.complete();
  if (isNewBest) {
    setTimeout(() => Sound.pb(), 250);
    Haptics.personalBest();
  }
  drawFinalScreen(score, state.best, isNewBest, xpGain, rank);
}

function drawFinalScreen(score: number, bestTile: number, isNewBest: boolean, xpGain: number, rank: number | null): void {
  const rating = ScoreKinds.merge_tile.rating(score);
  main().innerHTML = `
    <div class="page">
      <div class="game-shell">
        <div class="final-wrap">
          <div class="final-label">Point på pladen</div>
          <div class="final-score">${score}</div>
          <div class="final-rating" style="color:${rating.color}">${rating.label}</div>
          ${isNewBest ? '<div class="pb-flag">★ NY PERSONLIG REKORD</div>' : ''}
          <div class="xp-toast">✦ +${xpGain} XP optjent${rank && rank <= 3 ? ' · TOP 3-BONUS' : ''}</div>

          <div class="final-stats">
            <div class="fstat"><div class="n">${score}</div><div class="l">Point på pladen</div></div>
            <div class="fstat"><div class="n">${bestTile}</div><div class="l">Højeste tal</div></div>
            <div class="fstat"><div class="n">${rank ? '#' + rank : '—'}</div><div class="l">Placering</div></div>
            <div class="fstat"><div class="n">+${xpGain}</div><div class="l">XP optjent</div></div>
          </div>

          <div class="final-ctas">
            <button class="btn btn-primary btn-lg" id="mergePlayAgainBtn">SPIL IGEN</button>
            <button class="btn btn-ghost btn-lg" data-nav="leaderboard-merge">LEADERBOARD</button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.getElementById('mergePlayAgainBtn')!.addEventListener('click', () => {
    Sound.click();
    renderMergeGame();
  });
}
