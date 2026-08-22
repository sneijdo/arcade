import { ScoreKinds } from '../../scoring';
import { Sound } from '../../sound';
import { Haptics } from '../../haptics';
import { finishGameSession, bestScoreForGame } from '../../state';
import { gameUtilBarHtml, wireGameChrome } from '../../gameChrome';

const TILE_COUNT = 4;
const TILE_COLORS = ['var(--violet)', 'var(--lime)', 'var(--coral)', 'var(--cyan)'];
const FLASH_ON_MS = 380;
const FLASH_GAP_MS = 180;
const PLAYER_FLASH_MS = 220;

type MemoryPhase = 'idle' | 'playback' | 'input' | 'gameover';

interface MemoryState {
  sequence: number[];
  playerIndex: number;
  phase: MemoryPhase;
  timeoutIds: ReturnType<typeof setTimeout>[];
  inputTimeoutId: ReturnType<typeof setTimeout> | null;
}

let state: MemoryState = makeInitialState();

function makeInitialState(): MemoryState {
  return { sequence: [], playerIndex: 0, phase: 'idle', timeoutIds: [], inputTimeoutId: null };
}

/** Per-tap deadline during the input phase, shrinking as the sequence grows. The whole
 * sequence replays every round (see playback()), but only the newest tile is ever actually
 * new — a player can just write that one digit down each round and read the growing list
 * back off paper at their own pace, since nothing previously timed the input phase. Real
 * memory recall + a rehearsed tap is fast (sub-second even for a long sequence); reading an
 * ever-longer written list off paper against a shrinking per-tap clock is not — so this caps
 * how far the paper trick can realistically carry someone instead of making it unbounded. */
function inputTimeoutMs(level: number): number {
  return Math.max(420, 2200 - level * 90);
}

/** Playback speeds up as the sequence grows — both a difficulty ramp and a second squeeze on
 * the write-it-down trick: transcribing a tile as it flashes gets tighter right alongside the
 * per-tap input deadline above, instead of staying at a flat, comfortably-writable pace forever
 * no matter how long the sequence gets. */
function flashOnMs(level: number): number {
  return Math.max(150, FLASH_ON_MS - level * 12);
}
function flashGapMs(level: number): number {
  return Math.max(70, FLASH_GAP_MS - level * 6);
}

function clearInputTimeout(): void {
  if (state.inputTimeoutId != null) {
    clearTimeout(state.inputTimeoutId);
    state.inputTimeoutId = null;
  }
}

function armInputTimeout(): void {
  clearInputTimeout();
  state.inputTimeoutId = setTimeout(() => {
    if (state.phase !== 'input') return;
    Sound.mistake();
    Haptics.miss();
    gridEl()?.classList.add('shake');
    state.phase = 'gameover';
    schedule(() => finishGame(), 500);
  }, inputTimeoutMs(state.sequence.length));
}

function main(): HTMLElement {
  return document.getElementById('main')!;
}
function gridEl(): HTMLElement | null {
  return document.getElementById('memoryGrid');
}

function clearPendingTimeouts(): void {
  state.timeoutIds.forEach((id) => clearTimeout(id));
  state.timeoutIds = [];
  clearInputTimeout();
}

function schedule(fn: () => void, delay: number): void {
  const id = setTimeout(fn, delay);
  state.timeoutIds.push(id);
}

export function renderMemoryGame(): void {
  clearPendingTimeouts();
  state = makeInitialState();
  drawShell();
  wireGameChrome('memory', renderMemoryGame);
}

function drawShell(): void {
  main().innerHTML = `
    <div class="page">
      <div class="game-shell">
        <div class="game-topbar">
          <span>MEMORY${state.sequence.length > 0 ? ' · NIVEAU ' + state.sequence.length : ''}</span>
        </div>
        ${gameUtilBarHtml()}
        <div class="memory-stage" id="memoryStage"></div>
      </div>
    </div>
  `;
  drawStage();
}

function drawStage(): void {
  // The player may have navigated away mid-sequence — nothing else cancels
  // pending playback timeouts on route change, so bail out instead of
  // silently resuming a game nobody is looking at anymore.
  const stage = document.getElementById('memoryStage');
  if (!stage) return;
  if (state.phase === 'idle') {
    stage.innerHTML = `
      <div class="arena-inner">
        <div class="arena-title">Klar?</div>
        <ul class="instructions-list">
          <li>Se sekvensen der lyser op</li>
          <li>Gentag den ved at tappe felterne i samme rækkefølge</li>
          <li>Sekvensen bliver ét felt længere for hver runde du klarer</li>
        </ul>
        <button class="btn btn-primary btn-lg" id="memoryStartBtn">START</button>
      </div>
    `;
    document.getElementById('memoryStartBtn')!.addEventListener('click', (e) => {
      e.stopPropagation();
      startGame();
    });
    return;
  }

  // playback / input / gameover all show the tile grid
  stage.innerHTML = `
    <div class="memory-grid" id="memoryGrid">
      ${TILE_COLORS.map((color, i) => `<button class="memory-tile" data-tile="${i}" style="--tile-color:${color}" tabindex="-1"></button>`).join('')}
    </div>
    <div class="arena-msg" id="memoryStatus">${state.phase === 'playback' ? 'se godt efter…' : state.phase === 'input' ? 'din tur' : ''}</div>
  `;
  const grid = gridEl();
  if (grid && state.phase === 'input') {
    grid.addEventListener('pointerdown', handleTilePointerDown);
  }
}

function updateTopbar(): void {
  const bar = document.querySelector('.game-topbar span');
  if (bar) bar.textContent = `MEMORY${state.sequence.length > 0 ? ' · NIVEAU ' + state.sequence.length : ''}`;
}

function setStatus(text: string): void {
  const el = document.getElementById('memoryStatus');
  if (el) el.textContent = text;
}

function lightTile(index: number, on: boolean): void {
  const tile = gridEl()?.querySelector<HTMLElement>(`[data-tile="${index}"]`);
  if (tile) tile.classList.toggle('lit', on);
}

function startGame(): void {
  // Guards against a double-tap on START firing this twice — without it, a second
  // call didn't cancel the first playback()'s already-scheduled setTimeouts (only
  // renderMemoryGame(), i.e. a fresh page load, ever did that), so both sequences'
  // flashes would fire interleaved on top of each other: a couple of tiles light up
  // correctly, then it turns to chaos as the two schedules collide.
  if (state.phase !== 'idle') return;
  state.sequence = [Math.floor(Math.random() * TILE_COUNT)];
  state.playerIndex = 0;
  updateTopbar();
  playback();
}

function playback(): void {
  // Defensive even beyond the startGame() guard above — makes playback() itself
  // immune to ever having two overlapping timeout batches in flight, regardless of
  // what re-triggers it in the future.
  clearPendingTimeouts();
  state.phase = 'playback';
  updateTopbar();
  drawStage();
  Sound.countdown();

  const level = state.sequence.length;
  const onMs = flashOnMs(level);
  const gapMs = flashGapMs(level);
  let t = 400;
  state.sequence.forEach((tileIndex) => {
    schedule(() => {
      lightTile(tileIndex, true);
      Sound.note(tileIndex);
    }, t);
    schedule(() => lightTile(tileIndex, false), t + onMs);
    t += onMs + gapMs;
  });
  schedule(() => {
    state.phase = 'input';
    state.playerIndex = 0;
    drawStage();
    armInputTimeout();
  }, t + 150);
}

function handleTilePointerDown(e: PointerEvent): void {
  if (!e.isPrimary) return;
  if (state.phase !== 'input') return;
  const target = (e.target as HTMLElement).closest<HTMLElement>('[data-tile]');
  if (!target) return;
  e.preventDefault();
  const tapped = Number(target.dataset.tile);

  if (tapped === state.sequence[state.playerIndex]) {
    lightTile(tapped, true);
    Sound.note(tapped);
    Haptics.hit();
    schedule(() => lightTile(tapped, false), PLAYER_FLASH_MS);
    state.playerIndex++;

    if (state.playerIndex >= state.sequence.length) {
      // round complete — grow the sequence and replay
      clearInputTimeout();
      state.phase = 'gameover'; // temporarily block input during the pause
      setStatus('flot!');
      schedule(() => {
        state.sequence.push(Math.floor(Math.random() * TILE_COUNT));
        playback();
      }, 700);
    } else {
      // Correct so far, but the deadline is per-tap, not for the whole input — re-arm
      // it for the next tile rather than letting one early tap buy time for the rest.
      armInputTimeout();
    }
  } else {
    clearInputTimeout();
    Sound.mistake();
    Haptics.miss();
    lightTile(tapped, true);
    gridEl()?.classList.add('shake');
    state.phase = 'gameover';
    schedule(() => finishGame(), 500);
  }
}

async function finishGame(): Promise<void> {
  const score = state.sequence.length - 1;
  // Score/XP/leaderboard are legitimate to save even if the player has since
  // navigated away — the round genuinely finished. Only the final-screen
  // takeover of #main should be suppressed in that case.
  const result = await finishGameSession('memory', score);
  if (!document.getElementById('memoryStage')) return;
  Sound.complete();
  if (result.isNewBest) {
    schedule(() => Sound.pb(), 250);
    Haptics.personalBest();
  }
  drawFinalScreen(score, result.isNewBest, result.xpGain, result.rank);
}

function drawFinalScreen(score: number, isNewBest: boolean, xpGain: number, rank: number | null): void {
  const rating = ScoreKinds.memory_level.rating(score);
  const best = bestScoreForGame('memory');
  main().innerHTML = `
    <div class="page">
      <div class="game-shell">
        <div class="final-wrap">
          <div class="final-label">Din score</div>
          <div class="final-score">${score}<span style="font-size:26px"> niveau</span></div>
          <div class="final-rating" style="color:${rating.color}">${rating.label}</div>
          ${isNewBest ? '<div class="pb-flag">★ NY PERSONLIG REKORD</div>' : ''}
          <div class="xp-toast">✦ +${xpGain} XP optjent${rank && rank <= 3 ? ' · TOP 3-BONUS' : ''}</div>

          <div class="final-stats">
            <div class="fstat"><div class="n">${score}</div><div class="l">Niveau</div></div>
            <div class="fstat"><div class="n">${best != null ? best : '—'}</div><div class="l">Rekord</div></div>
            <div class="fstat"><div class="n">${rank ? '#' + rank : '—'}</div><div class="l">Placering</div></div>
            <div class="fstat"><div class="n">+${xpGain}</div><div class="l">XP optjent</div></div>
          </div>

          <div class="final-ctas">
            <button class="btn btn-primary btn-lg" id="playAgainBtn">SPIL IGEN</button>
            <button class="btn btn-ghost btn-lg" data-nav="leaderboard-memory">LEADERBOARD</button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.getElementById('playAgainBtn')!.addEventListener('click', () => {
    Sound.click();
    renderMemoryGame();
  });
}
