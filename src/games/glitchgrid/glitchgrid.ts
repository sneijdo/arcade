import { ScoreKinds } from '../../scoring';
import { Sound } from '../../sound';
import { Haptics } from '../../haptics';
import { finishGameSession } from '../../state';

const SESSION_MS = 35_000;
const GRID_SIZE = 4; // 4x4 = 16 cells
const MAX_ACTIVE = 3;
const GLITCH_CHANCE = 0.72;
const CORRUPT_PENALTY = 3;

type CellKind = 'empty' | 'glitch' | 'corrupt';
type Phase = 'idle' | 'playing' | 'result';

interface Cell {
  kind: CellKind;
  expireAt: number;
}

interface GlitchGridState {
  phase: Phase;
  score: number;
  combo: number;
  bestCombo: number;
  endAt: number;
  tickId: ReturnType<typeof setInterval> | null;
  spawnTimeoutId: ReturnType<typeof setTimeout> | null;
  cells: Cell[];
}

let state: GlitchGridState = makeInitialState();

function makeInitialState(): GlitchGridState {
  return {
    phase: 'idle',
    score: 0,
    combo: 0,
    bestCombo: 0,
    endAt: 0,
    tickId: null,
    spawnTimeoutId: null,
    cells: Array.from({ length: GRID_SIZE * GRID_SIZE }, () => ({ kind: 'empty' as CellKind, expireAt: 0 })),
  };
}

function main(): HTMLElement {
  return document.getElementById('main')!;
}

export function renderGlitchGridGame(): void {
  if (state.tickId) clearInterval(state.tickId);
  if (state.spawnTimeoutId) clearTimeout(state.spawnTimeoutId);
  state = makeInitialState();
  drawShell();
}

function drawShell(): void {
  main().innerHTML = `
    <div class="page">
      <div class="game-shell">
        <div class="game-topbar">
          <span id="ggTimer">GLITCH GRID — 35s</span>
          <span id="ggScore" class="mono">0 POINT</span>
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
        <div class="arena-title">Klar til at jagte glitches?</div>
        <ul class="instructions-list">
          <li>Tap de lime-farvede "glitch"-felter så hurtigt du kan</li>
          <li>Undgå de røde "korrupte" felter — de koster point og nulstiller din combo</li>
          <li>Højere combo giver flere point pr. glitch</li>
        </ul>
        <button class="btn btn-primary btn-lg" id="glitchgridStartBtn">START</button>
      </div>
    `;
    document.getElementById('glitchgridStartBtn')!.addEventListener('click', (e) => {
      e.stopPropagation();
      startSession();
    });
  } else if (state.phase === 'playing') {
    a.classList.add('state-target');
    a.innerHTML = `
      <div class="gg-wrap">
        <div class="gg-combo mono" id="ggCombo"></div>
        <div class="gg-grid" id="ggGrid">
          ${state.cells.map((_, i) => `<div class="gg-cell" data-idx="${i}"><div class="gg-life"></div></div>`).join('')}
        </div>
      </div>
    `;
    document.getElementById('ggGrid')!.addEventListener('pointerdown', handleGridPointerDown);
  }
}

function startSession(): void {
  state.phase = 'playing';
  state.score = 0;
  state.combo = 0;
  state.bestCombo = 0;
  state.cells = state.cells.map(() => ({ kind: 'empty' as CellKind, expireAt: 0 }));
  state.endAt = performance.now() + SESSION_MS;
  drawArenaContent();
  updateScoreLabel();
  updateTimerLabel();
  Sound.countdown();
  state.tickId = setInterval(gameTick, 100);
  scheduleSpawn(500);
}

function progressFrac(): number {
  return Math.min(1, Math.max(0, 1 - (state.endAt - performance.now()) / SESSION_MS));
}

function scheduleSpawn(delay: number): void {
  state.spawnTimeoutId = setTimeout(() => {
    if (state.phase !== 'playing' || !document.getElementById('ggGrid')) return;
    spawnOne();
    const nextDelay = Math.max(280, 650 - progressFrac() * 370);
    scheduleSpawn(nextDelay);
  }, delay);
}

function spawnOne(): void {
  const emptyIdx = state.cells.reduce<number[]>((acc, c, i) => (c.kind === 'empty' ? (acc.push(i), acc) : acc), []);
  const activeCount = state.cells.length - emptyIdx.length;
  if (emptyIdx.length === 0 || activeCount >= MAX_ACTIVE) return;
  const idx = emptyIdx[Math.floor(Math.random() * emptyIdx.length)];
  const isGlitch = Math.random() < GLITCH_CHANCE;
  const lifetimeMs = Math.max(480, 900 - progressFrac() * 380);
  state.cells[idx] = { kind: isGlitch ? 'glitch' : 'corrupt', expireAt: performance.now() + lifetimeMs };
  renderCell(idx, lifetimeMs);
}

function renderCell(idx: number, lifetimeMs: number): void {
  const el = document.querySelector<HTMLElement>(`.gg-cell[data-idx="${idx}"]`);
  if (!el) return;
  const cell = state.cells[idx];
  el.className = `gg-cell ${cell.kind}`;
  const life = el.querySelector<HTMLElement>('.gg-life');
  if (life) {
    life.style.transition = 'none';
    life.style.transform = 'scaleX(1)';
    // Force reflow so the transition below actually animates from scaleX(1) instead of
    // jumping straight to 0 (browsers can otherwise coalesce the two style writes).
    void life.offsetWidth;
    life.style.transition = `transform ${lifetimeMs}ms linear`;
    life.style.transform = 'scaleX(0)';
  }
}

function clearCell(idx: number): void {
  state.cells[idx] = { kind: 'empty', expireAt: 0 };
  const el = document.querySelector<HTMLElement>(`.gg-cell[data-idx="${idx}"]`);
  if (el) el.className = 'gg-cell';
}

function comboTier(): number {
  return 1 + Math.floor(state.combo / 5);
}

function updateCombo(): void {
  const el = document.getElementById('ggCombo');
  if (!el) return;
  el.textContent = state.combo > 0 ? `COMBO ×${state.combo} — +${comboTier()} PR. HIT` : '';
}

function handleGridPointerDown(e: PointerEvent): void {
  if (!e.isPrimary) return;
  if (state.phase !== 'playing') return;
  const cellEl = (e.target as HTMLElement).closest<HTMLElement>('.gg-cell');
  if (!cellEl) return;
  const idx = Number(cellEl.dataset.idx);
  const cell = state.cells[idx];
  if (cell.kind === 'empty') return;
  e.preventDefault();

  if (cell.kind === 'glitch') {
    state.combo++;
    state.bestCombo = Math.max(state.bestCombo, state.combo);
    state.score += comboTier();
    Sound.hit();
    Haptics.hit();
  } else {
    state.combo = 0;
    state.score = Math.max(0, state.score - CORRUPT_PENALTY);
    Sound.mistake();
    Haptics.miss();
  }
  clearCell(idx);
  updateScoreLabel();
  updateCombo();
}

function gameTick(): void {
  if (!document.getElementById('ggGrid')) {
    if (state.tickId) clearInterval(state.tickId);
    state.tickId = null;
    if (state.spawnTimeoutId) clearTimeout(state.spawnTimeoutId);
    state.spawnTimeoutId = null;
    return;
  }
  const now = performance.now();
  let missedGlitch = false;
  state.cells.forEach((cell, idx) => {
    if (cell.kind !== 'empty' && now >= cell.expireAt) {
      if (cell.kind === 'glitch') missedGlitch = true;
      clearCell(idx);
    }
  });
  if (missedGlitch && state.combo > 0) {
    state.combo = 0;
    updateCombo();
  }

  const remainingMs = state.endAt - now;
  if (remainingMs <= 0) {
    endSession();
    return;
  }
  updateTimerLabel(remainingMs);
}

function updateTimerLabel(remainingMsInput?: number): void {
  const el = document.getElementById('ggTimer');
  if (!el) return;
  const remainingMs = remainingMsInput ?? state.endAt - performance.now();
  const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
  el.textContent = `GLITCH GRID — ${seconds}s`;
}

function updateScoreLabel(): void {
  const el = document.getElementById('ggScore');
  if (el) el.textContent = `${state.score} POINT`;
}

function endSession(): void {
  if (state.tickId) clearInterval(state.tickId);
  state.tickId = null;
  if (state.spawnTimeoutId) clearTimeout(state.spawnTimeoutId);
  state.spawnTimeoutId = null;
  state.phase = 'result';
  void finishSession();
}

async function finishSession(): Promise<void> {
  const score = state.score;
  const { isNewBest, xpGain, rank } = await finishGameSession('glitchgrid', score);

  Sound.complete();
  if (isNewBest) {
    setTimeout(() => Sound.pb(), 250);
    Haptics.personalBest();
  }

  drawFinalScreen(score, isNewBest, xpGain, rank);
}

function drawFinalScreen(score: number, isNewBest: boolean, xpGain: number, rank: number | null): void {
  const rating = ScoreKinds.glitchgrid_score.rating(score);
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
            <div class="fstat"><div class="n">${state.bestCombo}</div><div class="l">Bedste combo</div></div>
            <div class="fstat"><div class="n">${rank ? '#' + rank : '—'}</div><div class="l">Placering</div></div>
            <div class="fstat"><div class="n">+${xpGain}</div><div class="l">XP optjent</div></div>
          </div>

          <div class="final-ctas">
            <button class="btn btn-primary btn-lg" id="playAgainBtn">SPIL IGEN</button>
            <button class="btn btn-ghost btn-lg" data-nav="leaderboard-glitchgrid">LEADERBOARD</button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.getElementById('playAgainBtn')!.addEventListener('click', () => {
    Sound.click();
    renderGlitchGridGame();
  });
}
