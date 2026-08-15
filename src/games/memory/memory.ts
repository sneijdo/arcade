import { ScoreKinds } from '../../scoring';
import { Sound } from '../../sound';
import { Haptics } from '../../haptics';
import { finishGameSession, bestScoreForGame } from '../../state';

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
}

let state: MemoryState = makeInitialState();

function makeInitialState(): MemoryState {
  return { sequence: [], playerIndex: 0, phase: 'idle', timeoutIds: [] };
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
}

function schedule(fn: () => void, delay: number): void {
  const id = setTimeout(fn, delay);
  state.timeoutIds.push(id);
}

export function renderMemoryGame(): void {
  clearPendingTimeouts();
  state = makeInitialState();
  drawShell();
}

function drawShell(): void {
  main().innerHTML = `
    <div class="page">
      <div class="game-shell">
        <div class="game-topbar">
          <span>MEMORY${state.sequence.length > 0 ? ' — NIVEAU ' + state.sequence.length : ''}</span>
        </div>
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
        <button class="btn btn-primary btn-lg" id="startBtn">START</button>
      </div>
    `;
    document.getElementById('startBtn')!.addEventListener('click', (e) => {
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
  if (bar) bar.textContent = `MEMORY${state.sequence.length > 0 ? ' — NIVEAU ' + state.sequence.length : ''}`;
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
  state.sequence = [Math.floor(Math.random() * TILE_COUNT)];
  state.playerIndex = 0;
  updateTopbar();
  playback();
}

function playback(): void {
  state.phase = 'playback';
  updateTopbar();
  drawStage();
  Sound.countdown();

  let t = 400;
  state.sequence.forEach((tileIndex) => {
    schedule(() => {
      lightTile(tileIndex, true);
      Sound.target();
    }, t);
    schedule(() => lightTile(tileIndex, false), t + FLASH_ON_MS);
    t += FLASH_ON_MS + FLASH_GAP_MS;
  });
  schedule(() => {
    state.phase = 'input';
    state.playerIndex = 0;
    drawStage();
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
    Sound.hit();
    Haptics.hit();
    schedule(() => lightTile(tapped, false), PLAYER_FLASH_MS);
    state.playerIndex++;

    if (state.playerIndex >= state.sequence.length) {
      // round complete — grow the sequence and replay
      state.phase = 'gameover'; // temporarily block input during the pause
      setStatus('flot!');
      schedule(() => {
        state.sequence.push(Math.floor(Math.random() * TILE_COUNT));
        playback();
      }, 700);
    }
  } else {
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
