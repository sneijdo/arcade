import { ScoreKinds } from '../../scoring';
import { Sound } from '../../sound';
import { Haptics } from '../../haptics';
import { finishGameSession } from '../../state';

const SESSION_MS = 60_000;

type Op = '+' | '−' | '×';

interface Problem {
  a: number;
  b: number;
  op: Op;
  answer: number;
  choices: number[];
}

type RushPhase = 'idle' | 'playing' | 'result';

interface RushState {
  phase: RushPhase;
  score: number;
  endAt: number;
  tickId: ReturnType<typeof setInterval> | null;
  problem: Problem | null;
  answered: boolean;
}

let rushState: RushState = makeInitialState();

function makeInitialState(): RushState {
  return { phase: 'idle', score: 0, endAt: 0, tickId: null, problem: null, answered: false };
}

function main(): HTMLElement {
  return document.getElementById('main')!;
}

export function renderNumberRushGame(): void {
  if (rushState.tickId) clearInterval(rushState.tickId);
  rushState = makeInitialState();
  drawShell();
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function makeProblem(): Problem {
  const opRoll = Math.random();
  let a: number, b: number, op: Op, answer: number;
  if (opRoll < 0.4) {
    op = '+';
    a = randInt(1, 50);
    b = randInt(1, 50);
    answer = a + b;
  } else if (opRoll < 0.8) {
    op = '−';
    a = randInt(1, 50);
    b = randInt(1, a); // keep result non-negative
    answer = a - b;
  } else {
    op = '×';
    a = randInt(1, 12);
    b = randInt(1, 12);
    answer = a * b;
  }

  const choices = new Set<number>([answer]);
  while (choices.size < 4) {
    const spread = Math.max(2, Math.round(Math.abs(answer) * 0.25) || 3);
    const candidate = answer + randInt(-spread, spread) || answer + randInt(1, spread);
    if (candidate !== answer && candidate >= 0) choices.add(candidate);
  }
  const shuffled = [...choices].sort(() => Math.random() - 0.5);
  return { a, b, op, answer, choices: shuffled };
}

function drawShell(): void {
  main().innerHTML = `
    <div class="page">
      <div class="game-shell">
        <div class="game-topbar">
          <span id="rushTimer">NUMBER RUSH — 60s</span>
          <span id="rushScore" class="mono">0 POINT</span>
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
  if (rushState.phase === 'idle') {
    a.innerHTML = `
      <div class="arena-inner">
        <div class="arena-title">Klar til hovedregning?</div>
        <ul class="instructions-list">
          <li>Løs så mange stykker som muligt på 60 sekunder</li>
          <li>Tap det rigtige svar blandt de fire muligheder</li>
          <li>Forkert svar koster intet — du går bare videre</li>
        </ul>
        <button class="btn btn-primary btn-lg" id="startBtn">START</button>
      </div>
    `;
    document.getElementById('startBtn')!.addEventListener('click', (e) => {
      e.stopPropagation();
      startSession();
    });
  } else if (rushState.phase === 'playing') {
    renderProblem();
  }
  // 'result' phase renders a full-screen takeover via drawFinalScreen(), not into the arena.
}

function renderProblem(): void {
  const a = document.getElementById('arena')!;
  rushState.problem = makeProblem();
  rushState.answered = false;
  const p = rushState.problem;
  a.innerHTML = `
    <div class="arena-inner" style="gap:22px">
      <div class="rush-problem mono">${p.a} ${p.op} ${p.b}</div>
      <div class="rush-choices">
        ${p.choices.map((c) => `<button class="btn btn-ghost rush-choice" data-choice="${c}">${c}</button>`).join('')}
      </div>
    </div>
  `;
  a.querySelectorAll<HTMLButtonElement>('.rush-choice').forEach((btn) => {
    btn.addEventListener('pointerdown', handleChoicePointerDown);
  });
}

function handleChoicePointerDown(e: PointerEvent): void {
  if (!e.isPrimary) return; // ignore extra fingers in a multi-touch gesture
  if (rushState.phase !== 'playing' || rushState.answered || !rushState.problem) return;
  e.preventDefault();
  rushState.answered = true; // guard against double-counting the same problem

  const btn = e.currentTarget as HTMLButtonElement;
  const choice = Number(btn.dataset.choice);
  const correct = choice === rushState.problem.answer;

  if (correct) {
    rushState.score++;
    updateScoreLabel();
    btn.style.borderColor = 'var(--lime)';
    btn.style.background = 'rgba(201,247,62,.15)';
    Sound.hit();
    Haptics.hit();
  } else {
    btn.style.borderColor = 'var(--coral)';
    btn.style.background = 'rgba(255,93,122,.15)';
    Sound.mistake();
    Haptics.miss();
  }

  setTimeout(() => {
    // Bail if the player navigated away mid-problem — nothing else cancels
    // this timer on route change.
    if (rushState.phase === 'playing' && document.getElementById('arena')) renderProblem();
  }, 220);
}

function startSession(): void {
  rushState.phase = 'playing';
  rushState.score = 0;
  rushState.endAt = performance.now() + SESSION_MS;
  updateScoreLabel();
  drawArenaContent();
  updateTimerLabel();
  Sound.countdown();
  rushState.tickId = setInterval(() => {
    if (!document.getElementById('arena')) {
      if (rushState.tickId) clearInterval(rushState.tickId);
      rushState.tickId = null;
      return;
    }
    const remainingMs = rushState.endAt - performance.now();
    if (remainingMs <= 0) {
      endSession();
      return;
    }
    updateTimerLabel(remainingMs);
  }, 200);
}

function updateTimerLabel(remainingMsInput?: number): void {
  const el = document.getElementById('rushTimer');
  if (!el) return;
  const remainingMs = remainingMsInput ?? rushState.endAt - performance.now();
  const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
  el.textContent = `NUMBER RUSH — ${seconds}s`;
}

function updateScoreLabel(): void {
  const el = document.getElementById('rushScore');
  if (el) el.textContent = `${rushState.score} POINT`;
}

function endSession(): void {
  if (rushState.tickId) clearInterval(rushState.tickId);
  rushState.tickId = null;
  rushState.phase = 'result';
  void finishSession();
}

async function finishSession(): Promise<void> {
  const score = rushState.score;
  const { isNewBest, xpGain, rank } = await finishGameSession('numberrush', score);

  Sound.complete();
  if (isNewBest) {
    setTimeout(() => Sound.pb(), 250);
    Haptics.personalBest();
  }

  drawFinalScreen(score, isNewBest, xpGain, rank);
}

function drawFinalScreen(score: number, isNewBest: boolean, xpGain: number, rank: number | null): void {
  const rating = ScoreKinds.numberrush_score.rating(score);
  const perMinute = ((score / SESSION_MS) * 60000).toFixed(1);
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
            <div class="fstat"><div class="n">${perMinute}</div><div class="l">Point/min</div></div>
            <div class="fstat"><div class="n">${rank ? '#' + rank : '—'}</div><div class="l">Placering</div></div>
            <div class="fstat"><div class="n">+${xpGain}</div><div class="l">XP optjent</div></div>
          </div>

          <div class="final-ctas">
            <button class="btn btn-primary btn-lg" id="playAgainBtn">SPIL IGEN</button>
            <button class="btn btn-ghost btn-lg" data-nav="leaderboard">LEADERBOARD</button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.getElementById('playAgainBtn')!.addEventListener('click', () => {
    Sound.click();
    renderNumberRushGame();
  });
}
