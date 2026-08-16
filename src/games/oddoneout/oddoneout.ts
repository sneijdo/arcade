import { ScoreKinds } from '../../scoring';
import { Sound } from '../../sound';
import { Haptics } from '../../haptics';
import { finishGameSession } from '../../state';

const START_LIVES = 3;
const GLYPHS = ['⬤', '◆', '■', '▲', '★', '⬣'];
const ROUND_TRANSITION_MS = 260;

type Phase = 'idle' | 'playing' | 'result';

interface OddOneOutState {
  phase: Phase;
  /** Bumped every renderOddOneOutGame() call — lets a stray in-flight timeout from a
   * previous session recognize it's stale and no-op instead of acting on a session
   * that's no longer the one on screen (checking #arena alone doesn't catch this: a
   * fresh session re-renders its own #arena, so the element always "exists"). */
  sessionId: number;
  /** Total rounds shown so far (correct + wrong + timed-out) — drives the difficulty ramp. */
  attempt: number;
  /** Correctly-solved rounds — this is the actual score. */
  cleared: number;
  lives: number;
  glyph: string;
  gridSize: number;
  oddIndex: number;
  oddAngle: number;
  roundEndAt: number;
  tickId: ReturnType<typeof setInterval> | null;
  roundTimeoutId: ReturnType<typeof setTimeout> | null;
  locked: boolean;
}

let sessionCounter = 0;
let state: OddOneOutState = makeInitialState();

function makeInitialState(): OddOneOutState {
  return {
    phase: 'idle',
    sessionId: ++sessionCounter,
    attempt: 0,
    cleared: 0,
    lives: START_LIVES,
    glyph: GLYPHS[0],
    gridSize: 3,
    oddIndex: 0,
    oddAngle: 0,
    roundEndAt: 0,
    tickId: null,
    roundTimeoutId: null,
    locked: false,
  };
}

function main(): HTMLElement {
  return document.getElementById('main')!;
}

export function renderOddOneOutGame(): void {
  if (state.tickId) clearInterval(state.tickId);
  if (state.roundTimeoutId) clearTimeout(state.roundTimeoutId);
  state = makeInitialState();
  drawShell();
}

function gridSizeForAttempt(attempt: number): number {
  return Math.min(6, 3 + Math.floor(attempt / 3));
}
function timeMsForAttempt(attempt: number): number {
  return Math.max(1000, 3000 - attempt * 145);
}
function oddAngleForAttempt(attempt: number): number {
  return Math.max(9, 32 - attempt * 1.5);
}

function drawShell(): void {
  main().innerHTML = `
    <div class="page">
      <div class="game-shell">
        <div class="game-topbar">
          <span id="ooTitle">ODD ONE OUT — RUNDE 1</span>
          <div class="oo-lives" id="ooLives"></div>
        </div>
        <div class="arena" id="arena"></div>
      </div>
    </div>
  `;
  drawArenaContent();
}

function livesHtml(): string {
  return Array.from({ length: START_LIVES }, (_, i) => `<span class="oo-life ${i < state.lives ? '' : 'lost'}">●</span>`).join('');
}

function updateLives(): void {
  const el = document.getElementById('ooLives');
  if (el) el.innerHTML = livesHtml();
}

function drawArenaContent(): void {
  const a = document.getElementById('arena')!;
  a.className = 'arena';
  if (state.phase === 'idle') {
    a.innerHTML = `
      <div class="arena-inner">
        <div class="arena-title">Klar til at spotte det?</div>
        <ul class="instructions-list">
          <li>Find feltet der er drejet anderledes end de andre</li>
          <li>Hurtigere og federe for hver runde</li>
          <li>3 liv — forkert tap eller for langsom koster ét</li>
        </ul>
        <button class="btn btn-primary btn-lg" id="oooStartBtn">START</button>
      </div>
    `;
    document.getElementById('oooStartBtn')!.addEventListener('click', (e) => {
      e.stopPropagation();
      startSession();
    });
  } else if (state.phase === 'playing') {
    a.classList.add('oo-arena');
    renderRound();
  }
}

function startSession(): void {
  state.phase = 'playing';
  state.attempt = 0;
  state.cleared = 0;
  state.lives = START_LIVES;
  updateLives();
  drawArenaContent();
  Sound.countdown();
}

function renderRound(): void {
  const a = document.getElementById('arena');
  if (!a) return;
  state.attempt++;
  state.locked = false;
  state.gridSize = gridSizeForAttempt(state.attempt);
  state.glyph = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
  const total = state.gridSize * state.gridSize;
  state.oddIndex = Math.floor(Math.random() * total);
  state.oddAngle = oddAngleForAttempt(state.attempt) * (Math.random() < 0.5 ? -1 : 1);

  const titleEl = document.getElementById('ooTitle');
  if (titleEl) titleEl.textContent = `ODD ONE OUT — RUNDE ${state.attempt}`;

  a.innerHTML = `
    <div class="oo-grid" id="ooGrid" style="grid-template-columns:repeat(${state.gridSize}, 1fr)">
      ${Array.from({ length: total }, (_, i) => {
        const angle = i === state.oddIndex ? state.oddAngle : 0;
        return `<button class="oo-cell" data-idx="${i}" style="transform:rotate(${angle}deg)">${state.glyph}</button>`;
      }).join('')}
    </div>
    <div class="oo-round-bar-track"><div class="oo-round-bar-fill" id="ooRoundBar"></div></div>
  `;
  document.getElementById('ooGrid')!.addEventListener('pointerdown', handleGridPointerDown);

  const durationMs = timeMsForAttempt(state.attempt);
  state.roundEndAt = performance.now() + durationMs;
  const bar = document.getElementById('ooRoundBar');
  if (bar) {
    bar.style.transition = 'none';
    bar.style.transform = 'scaleX(1)';
    void (bar as HTMLElement).offsetWidth;
    bar.style.transition = `transform ${durationMs}ms linear`;
    bar.style.transform = 'scaleX(0)';
  }
  const roundSessionId = state.sessionId;
  state.roundTimeoutId = setTimeout(() => {
    if (state.sessionId !== roundSessionId || state.phase !== 'playing' || !document.getElementById('ooGrid') || state.locked) return;
    resolveRound(false);
  }, durationMs);
}

function handleGridPointerDown(e: PointerEvent): void {
  if (!e.isPrimary) return;
  if (state.phase !== 'playing' || state.locked) return;
  const cellEl = (e.target as HTMLElement).closest<HTMLElement>('.oo-cell');
  if (!cellEl) return;
  const idx = Number(cellEl.dataset.idx);
  e.preventDefault();
  resolveRound(idx === state.oddIndex, cellEl);
}

function resolveRound(correct: boolean, tappedEl?: HTMLElement): void {
  state.locked = true;
  if (state.roundTimeoutId) clearTimeout(state.roundTimeoutId);
  state.roundTimeoutId = null;

  const oddEl = document.querySelector<HTMLElement>(`.oo-cell[data-idx="${state.oddIndex}"]`);
  if (correct) {
    state.cleared++;
    oddEl?.classList.add('correct');
    Sound.hit();
    Haptics.hit();
  } else {
    oddEl?.classList.add('reveal');
    tappedEl?.classList.add('wrong');
    state.lives--;
    updateLives();
    Sound.mistake();
    Haptics.miss();
  }

  const roundSessionId = state.sessionId;
  state.roundTimeoutId = setTimeout(() => {
    if (state.sessionId !== roundSessionId || !document.getElementById('arena')) return;
    if (!correct && state.lives <= 0) {
      endSession();
      return;
    }
    // A wrong/timed-out tap still advances to a fresh round rather than
    // retrying the same board — losing a life is the whole penalty.
    renderRound();
  }, ROUND_TRANSITION_MS);
}

function endSession(): void {
  state.phase = 'result';
  if (state.tickId) clearInterval(state.tickId);
  state.tickId = null;
  if (state.roundTimeoutId) clearTimeout(state.roundTimeoutId);
  state.roundTimeoutId = null;
  void finishSession();
}

async function finishSession(): Promise<void> {
  const score = state.cleared;
  const { isNewBest, xpGain, rank } = await finishGameSession('oddoneout', score);

  Sound.complete();
  if (isNewBest) {
    setTimeout(() => Sound.pb(), 250);
    Haptics.personalBest();
  }

  drawFinalScreen(score, isNewBest, xpGain, rank);
}

function drawFinalScreen(score: number, isNewBest: boolean, xpGain: number, rank: number | null): void {
  const rating = ScoreKinds.oddoneout_score.rating(score);
  main().innerHTML = `
    <div class="page">
      <div class="game-shell">
        <div class="final-wrap">
          <div class="final-label">Din score</div>
          <div class="final-score">${score}<span style="font-size:26px">runder</span></div>
          <div class="final-rating" style="color:${rating.color}">${rating.label}</div>
          ${isNewBest ? '<div class="pb-flag">★ NY PERSONLIG REKORD</div>' : ''}
          <div class="xp-toast">✦ +${xpGain} XP optjent${rank && rank <= 3 ? ' · TOP 3-BONUS' : ''}</div>

          <div class="final-stats">
            <div class="fstat"><div class="n">${score}</div><div class="l">Runder klaret</div></div>
            <div class="fstat"><div class="n">${state.gridSize}×${state.gridSize}</div><div class="l">Sidste gitter</div></div>
            <div class="fstat"><div class="n">${rank ? '#' + rank : '—'}</div><div class="l">Placering</div></div>
            <div class="fstat"><div class="n">+${xpGain}</div><div class="l">XP optjent</div></div>
          </div>

          <div class="final-ctas">
            <button class="btn btn-primary btn-lg" id="oooPlayAgainBtn">SPIL IGEN</button>
            <button class="btn btn-ghost btn-lg" data-nav="leaderboard-oddoneout">LEADERBOARD</button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.getElementById('oooPlayAgainBtn')!.addEventListener('click', () => {
    Sound.click();
    renderOddOneOutGame();
  });
}
