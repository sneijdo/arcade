import { ScoreKinds } from '../../scoring';
import { Sound } from '../../sound';
import { Haptics } from '../../haptics';
import { finishGameSession } from '../../state';
import { gameUtilBarHtml, wireGameChrome } from '../../gameChrome';

const SESSION_MS = 60_000;
const SYMBOLS = ['🍎', '🍋', '🍇', '🍉', '🍒', '🍑', '🍓', '🥝'];
const MATCH_POINTS = 10;
const MISMATCH_REVEAL_MS = 650;
const MATCH_LOCK_MS = 260;
const TIME_BONUS_PER_SEC = 3;

type Phase = 'idle' | 'playing' | 'result';

interface Card {
  symbol: string;
  matched: boolean;
}

interface PairsState {
  phase: Phase;
  cards: Card[];
  flipped: number[];
  locked: boolean;
  score: number;
  matches: number;
  mismatches: number;
  combo: number;
  endAt: number;
  tickId: ReturnType<typeof setInterval> | null;
}

let state: PairsState = makeInitialState();

function makeInitialState(): PairsState {
  return { phase: 'idle', cards: [], flipped: [], locked: false, score: 0, matches: 0, mismatches: 0, combo: 0, endAt: 0, tickId: null };
}

function main(): HTMLElement {
  return document.getElementById('main')!;
}

export function renderPairsGame(): void {
  if (state.tickId) clearInterval(state.tickId);
  state = makeInitialState();
  drawShell();
  wireGameChrome('pairs', renderPairsGame);
}

function shuffledDeck(): Card[] {
  const deck = [...SYMBOLS, ...SYMBOLS].map((symbol) => ({ symbol, matched: false }));
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function drawShell(): void {
  main().innerHTML = `
    <div class="page">
      <div class="game-shell">
        <div class="game-topbar">
          <span id="prTimer">PAIRS · 60s</span>
          <span id="prScore" class="mono">0 POINT</span>
        </div>
        ${gameUtilBarHtml()}
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
        <div class="arena-title">Klar til at finde par?</div>
        <ul class="instructions-list">
          <li>Vend to kort ad gangen og find parrene</li>
          <li>Fejl koster intet, men bryder din combo</li>
          <li>Bonus for tid tilbage, hvis du finder alle 8 par</li>
        </ul>
        <button class="btn btn-primary btn-lg" id="pairsStartBtn">START</button>
      </div>
    `;
    document.getElementById('pairsStartBtn')!.addEventListener('click', (e) => {
      e.stopPropagation();
      startSession();
    });
  } else if (state.phase === 'playing') {
    a.classList.add('pr-arena');
    a.innerHTML = `<div class="pr-grid" id="prGrid">${state.cards.map((_, i) => cardHtml(i)).join('')}</div>`;
    document.getElementById('prGrid')!.addEventListener('pointerdown', handleGridPointerDown);
  }
}

function cardHtml(idx: number): string {
  const card = state.cards[idx];
  const flippedNow = state.flipped.includes(idx) || card.matched;
  return `
    <button class="pr-card ${flippedNow ? 'flipped' : ''} ${card.matched ? 'matched' : ''}" data-idx="${idx}" ${card.matched ? 'disabled' : ''}>
      <div class="pr-card-inner">
        <div class="pr-card-back">?</div>
        <div class="pr-card-front">${card.symbol}</div>
      </div>
    </button>
  `;
}

function updateCardEl(idx: number): void {
  const el = document.querySelector<HTMLElement>(`.pr-card[data-idx="${idx}"]`);
  if (!el) return;
  const card = state.cards[idx];
  const flippedNow = state.flipped.includes(idx) || card.matched;
  el.className = `pr-card ${flippedNow ? 'flipped' : ''} ${card.matched ? 'matched' : ''}`;
  if (card.matched) el.setAttribute('disabled', '');
}

function handleGridPointerDown(e: PointerEvent): void {
  if (!e.isPrimary) return;
  if (state.phase !== 'playing' || state.locked) return;
  const cardEl = (e.target as HTMLElement).closest<HTMLElement>('.pr-card');
  if (!cardEl) return;
  const idx = Number(cardEl.dataset.idx);
  const card = state.cards[idx];
  if (card.matched || state.flipped.includes(idx)) return;
  e.preventDefault();

  state.flipped.push(idx);
  updateCardEl(idx);
  Sound.click();

  if (state.flipped.length < 2) return;

  state.locked = true;
  const [i1, i2] = state.flipped;
  const c1 = state.cards[i1];
  const c2 = state.cards[i2];

  if (c1.symbol === c2.symbol) {
    setTimeout(() => {
      if (!document.getElementById('prGrid')) return;
      c1.matched = true;
      c2.matched = true;
      state.matches++;
      state.combo++;
      const gain = MATCH_POINTS + (state.combo - 1) * 2;
      state.score += gain;
      state.flipped = [];
      state.locked = false;
      updateCardEl(i1);
      updateCardEl(i2);
      updateScoreLabel();
      Sound.hit();
      Haptics.hit();
      if (state.matches === SYMBOLS.length) {
        endSession(true);
      }
    }, MATCH_LOCK_MS);
  } else {
    setTimeout(() => {
      if (!document.getElementById('prGrid')) return;
      state.combo = 0;
      state.mismatches++;
      state.flipped = [];
      state.locked = false;
      updateCardEl(i1);
      updateCardEl(i2);
      Sound.mistake();
      Haptics.miss();
    }, MISMATCH_REVEAL_MS);
  }
}

function startSession(): void {
  state.phase = 'playing';
  state.cards = shuffledDeck();
  state.flipped = [];
  state.locked = false;
  state.score = 0;
  state.matches = 0;
  state.mismatches = 0;
  state.combo = 0;
  state.endAt = performance.now() + SESSION_MS;
  updateScoreLabel();
  drawArenaContent();
  updateTimerLabel();
  Sound.countdown();
  state.tickId = setInterval(() => {
    if (!document.getElementById('arena')) {
      if (state.tickId) clearInterval(state.tickId);
      state.tickId = null;
      return;
    }
    const remainingMs = state.endAt - performance.now();
    if (remainingMs <= 0) {
      endSession(false);
      return;
    }
    updateTimerLabel(remainingMs);
  }, 200);
}

function updateTimerLabel(remainingMsInput?: number): void {
  const el = document.getElementById('prTimer');
  if (!el) return;
  const remainingMs = remainingMsInput ?? state.endAt - performance.now();
  const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
  el.textContent = `PAIRS · ${seconds}s`;
}

function updateScoreLabel(): void {
  const el = document.getElementById('prScore');
  if (el) el.textContent = `${state.score} POINT`;
}

function endSession(completed: boolean): void {
  if (state.tickId) clearInterval(state.tickId);
  state.tickId = null;
  state.phase = 'result';
  if (completed) {
    const remainingSec = Math.max(0, Math.ceil((state.endAt - performance.now()) / 1000));
    state.score += remainingSec * TIME_BONUS_PER_SEC;
  }
  void finishSession();
}

async function finishSession(): Promise<void> {
  const score = state.score;
  const { isNewBest, xpGain, rank } = await finishGameSession('pairs', score);

  Sound.complete();
  if (isNewBest) {
    setTimeout(() => Sound.pb(), 250);
    Haptics.personalBest();
  }

  drawFinalScreen(score, isNewBest, xpGain, rank);
}

function drawFinalScreen(score: number, isNewBest: boolean, xpGain: number, rank: number | null): void {
  const rating = ScoreKinds.pairs_score.rating(score);
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
            <div class="fstat"><div class="n">${state.matches} / ${SYMBOLS.length}</div><div class="l">Par fundet</div></div>
            <div class="fstat"><div class="n">${state.mismatches}</div><div class="l">Fejl</div></div>
            <div class="fstat"><div class="n">${rank ? '#' + rank : '—'}</div><div class="l">Placering</div></div>
            <div class="fstat"><div class="n">+${xpGain}</div><div class="l">XP optjent</div></div>
          </div>

          <div class="final-ctas">
            <button class="btn btn-primary btn-lg" id="pairsPlayAgainBtn">SPIL IGEN</button>
            <button class="btn btn-ghost btn-lg" data-nav="leaderboard-pairs">LEADERBOARD</button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.getElementById('pairsPlayAgainBtn')!.addEventListener('click', () => {
    Sound.click();
    renderPairsGame();
  });
}
