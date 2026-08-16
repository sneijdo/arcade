import { ScoreKinds } from '../../scoring';
import { Sound } from '../../sound';
import { Haptics } from '../../haptics';
import { finishGameSession } from '../../state';

const SESSION_MS = 45_000;

interface Rule {
  id: string;
  question: string;
  leftLabel: string;
  rightLabel: string;
  classify: (n: number) => 'left' | 'right';
  gen: () => number;
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function isPrime(n: number): boolean {
  if (n < 2) return false;
  for (let i = 2; i * i <= n; i++) if (n % i === 0) return false;
  return true;
}

const RULES: Rule[] = [
  {
    id: 'evenodd',
    question: 'LIGE ELLER ULIGE?',
    leftLabel: 'LIGE',
    rightLabel: 'ULIGE',
    classify: (n) => (n % 2 === 0 ? 'left' : 'right'),
    gen: () => randInt(1, 99),
  },
  {
    id: 'threshold50',
    question: 'UNDER ELLER OVER 50?',
    leftLabel: 'UNDER 50',
    rightLabel: 'OVER 50',
    classify: (n) => (n < 50 ? 'left' : 'right'),
    gen: () => {
      let n = randInt(1, 99);
      while (n === 50) n = randInt(1, 99);
      return n;
    },
  },
  {
    id: 'div3',
    question: 'DELELIG MED 3?',
    leftLabel: 'DELELIG MED 3',
    rightLabel: 'IKKE DELELIG',
    classify: (n) => (n % 3 === 0 ? 'left' : 'right'),
    gen: () => randInt(1, 99),
  },
  {
    id: 'prime',
    question: 'PRIMTAL?',
    leftLabel: 'PRIMTAL',
    rightLabel: 'IKKE PRIMTAL',
    classify: (n) => (isPrime(n) ? 'left' : 'right'),
    gen: () => randInt(2, 97),
  },
];

type Phase = 'idle' | 'playing' | 'result';

interface RuleBreakerState {
  phase: Phase;
  score: number;
  combo: number;
  bestCombo: number;
  ruleIdx: number;
  correctSinceSwitch: number;
  switchThreshold: number;
  currentNumber: number;
  endAt: number;
  itemDeadline: number;
  tickId: ReturnType<typeof setInterval> | null;
  answered: boolean;
}

let state: RuleBreakerState = makeInitialState();

function makeInitialState(): RuleBreakerState {
  return {
    phase: 'idle',
    score: 0,
    combo: 0,
    bestCombo: 0,
    ruleIdx: 0,
    correctSinceSwitch: 0,
    switchThreshold: randInt(5, 8),
    currentNumber: 0,
    endAt: 0,
    itemDeadline: 0,
    tickId: null,
    answered: false,
  };
}

function main(): HTMLElement {
  return document.getElementById('main')!;
}

export function renderRuleSwitchGame(): void {
  if (state.tickId) clearInterval(state.tickId);
  state = makeInitialState();
  drawShell();
}

function drawShell(): void {
  main().innerHTML = `
    <div class="page">
      <div class="game-shell">
        <div class="game-topbar">
          <span id="rbTimer">RULE BREAKER — 45s</span>
          <span id="rbScore" class="mono">0 POINT</span>
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
        <div class="arena-title">Klar til at følge reglen?</div>
        <ul class="instructions-list">
          <li>Sortér tallet efter reglen øverst — tap venstre eller højre</li>
          <li>Reglen skifter uden varsel undervejs — hold øje med banneret</li>
          <li>Svarer du ikke i tide, tæller det som forkert</li>
        </ul>
        <button class="btn btn-primary btn-lg" id="startBtn">START</button>
      </div>
    `;
    document.getElementById('startBtn')!.addEventListener('click', (e) => {
      e.stopPropagation();
      startSession();
    });
  } else if (state.phase === 'playing') {
    a.innerHTML = `<div class="rb-arena" id="rbArena"></div>`;
    nextItem();
  }
}

function startSession(): void {
  state.phase = 'playing';
  state.score = 0;
  state.combo = 0;
  state.bestCombo = 0;
  state.ruleIdx = 0;
  state.correctSinceSwitch = 0;
  state.switchThreshold = randInt(5, 8);
  state.endAt = performance.now() + SESSION_MS;
  drawArenaContent();
  updateScoreLabel();
  Sound.countdown();
  state.tickId = setInterval(tick, 100);
}

function progressFrac(): number {
  return Math.min(1, Math.max(0, 1 - (state.endAt - performance.now()) / SESSION_MS));
}

function nextItem(): void {
  const rbArena = document.getElementById('rbArena');
  if (!rbArena) return;
  const rule = RULES[state.ruleIdx];
  state.currentNumber = rule.gen();
  state.answered = false;
  const windowMs = Math.max(900, 1800 - progressFrac() * 900);
  state.itemDeadline = performance.now() + windowMs;

  rbArena.innerHTML = `
    <div class="rb-question mono">${rule.question}</div>
    <div class="rb-life-track"><div class="rb-life" id="rbLife"></div></div>
    <div class="rb-number mono" id="rbNumber">${state.currentNumber}</div>
    <div class="rb-choices">
      <button class="btn btn-ghost rb-choice" data-side="left" id="rbLeft">${rule.leftLabel}</button>
      <button class="btn btn-ghost rb-choice" data-side="right" id="rbRight">${rule.rightLabel}</button>
    </div>
  `;
  const life = document.getElementById('rbLife');
  if (life) {
    life.style.transition = 'none';
    life.style.transform = 'scaleX(1)';
    void life.offsetWidth;
    life.style.transition = `transform ${windowMs}ms linear`;
    life.style.transform = 'scaleX(0)';
  }
  document.getElementById('rbLeft')!.addEventListener('pointerdown', (e) => handleChoiceDown(e as PointerEvent, 'left'));
  document.getElementById('rbRight')!.addEventListener('pointerdown', (e) => handleChoiceDown(e as PointerEvent, 'right'));
}

function handleChoiceDown(e: PointerEvent, side: 'left' | 'right'): void {
  if (!e.isPrimary) return;
  if (state.phase !== 'playing' || state.answered) return;
  e.preventDefault();
  answer(side);
}

function answer(side: 'left' | 'right' | null): void {
  state.answered = true;
  const rule = RULES[state.ruleIdx];
  const correctSide = rule.classify(state.currentNumber);
  const isCorrect = side === correctSide;

  if (side) {
    const btn = document.getElementById(side === 'left' ? 'rbLeft' : 'rbRight') as HTMLButtonElement | null;
    if (btn) {
      btn.style.borderColor = isCorrect ? 'var(--lime)' : 'var(--coral)';
      btn.style.background = isCorrect ? 'rgba(201,247,62,.15)' : 'rgba(255,93,122,.15)';
    }
  }

  if (isCorrect) {
    state.score++;
    state.combo++;
    state.bestCombo = Math.max(state.bestCombo, state.combo);
    state.correctSinceSwitch++;
    Sound.hit();
    Haptics.hit();
  } else {
    state.combo = 0;
    Sound.mistake();
    Haptics.miss();
  }
  updateScoreLabel();

  setTimeout(() => {
    if (state.phase !== 'playing' || !document.getElementById('rbArena')) return;
    if (state.correctSinceSwitch >= state.switchThreshold) {
      switchRule();
    } else {
      nextItem();
    }
  }, 220);
}

function switchRule(): void {
  let next = state.ruleIdx;
  while (next === state.ruleIdx) next = randInt(0, RULES.length - 1);
  state.ruleIdx = next;
  state.correctSinceSwitch = 0;
  state.switchThreshold = randInt(5, 8);
  Sound.achievement();
  Haptics.personalBest();

  const rbArena = document.getElementById('rbArena');
  if (!rbArena) return;
  rbArena.innerHTML = `<div class="rb-switch-banner">NY REGEL<br><span>${RULES[state.ruleIdx].question}</span></div>`;
  setTimeout(() => {
    if (state.phase === 'playing' && document.getElementById('rbArena')) nextItem();
  }, 1000);
}

function tick(): void {
  if (!document.getElementById('arena')) {
    if (state.tickId) clearInterval(state.tickId);
    state.tickId = null;
    return;
  }
  const now = performance.now();
  if (!state.answered && state.itemDeadline > 0 && now >= state.itemDeadline && document.getElementById('rbArena')) {
    answer(null);
  }
  const remainingMs = state.endAt - now;
  if (remainingMs <= 0) {
    endSession();
    return;
  }
  updateTimerLabel(remainingMs);
}

function updateTimerLabel(remainingMsInput?: number): void {
  const el = document.getElementById('rbTimer');
  if (!el) return;
  const remainingMs = remainingMsInput ?? state.endAt - performance.now();
  const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
  el.textContent = `RULE BREAKER — ${seconds}s`;
}

function updateScoreLabel(): void {
  const el = document.getElementById('rbScore');
  if (el) el.textContent = `${state.score} POINT`;
}

function endSession(): void {
  if (state.tickId) clearInterval(state.tickId);
  state.tickId = null;
  state.phase = 'result';
  void finishSession();
}

async function finishSession(): Promise<void> {
  const score = state.score;
  const { isNewBest, xpGain, rank } = await finishGameSession('ruleswitch', score);

  Sound.complete();
  if (isNewBest) {
    setTimeout(() => Sound.pb(), 250);
    Haptics.personalBest();
  }

  drawFinalScreen(score, isNewBest, xpGain, rank);
}

function drawFinalScreen(score: number, isNewBest: boolean, xpGain: number, rank: number | null): void {
  const rating = ScoreKinds.ruleswitch_score.rating(score);
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
            <div class="fstat"><div class="n">${score}</div><div class="l">Rigtige</div></div>
            <div class="fstat"><div class="n">${state.bestCombo}</div><div class="l">Bedste combo</div></div>
            <div class="fstat"><div class="n">${rank ? '#' + rank : '—'}</div><div class="l">Placering</div></div>
            <div class="fstat"><div class="n">+${xpGain}</div><div class="l">XP optjent</div></div>
          </div>

          <div class="final-ctas">
            <button class="btn btn-primary btn-lg" id="playAgainBtn">SPIL IGEN</button>
            <button class="btn btn-ghost btn-lg" data-nav="leaderboard-ruleswitch">LEADERBOARD</button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.getElementById('playAgainBtn')!.addEventListener('click', () => {
    Sound.click();
    renderRuleSwitchGame();
  });
}
