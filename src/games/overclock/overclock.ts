import { ScoreKinds } from '../../scoring';
import { Sound } from '../../sound';
import { Haptics } from '../../haptics';
import { finishGameSession } from '../../state';

const TOTAL_ROUNDS = 6;
const BASE_VALUE = 100;
const TICK_MS = 50;

type RoundPhase = 'ready' | 'charging' | 'busted' | 'banked';
type Phase = 'idle' | 'playing' | 'result';

interface OverclockState {
  phase: Phase;
  roundIndex: number;
  roundPhase: RoundPhase;
  totalScore: number;
  heldMs: number;
  multiplier: number;
  tickId: ReturnType<typeof setInterval> | null;
  lastChargeSoundAt: number;
}

let state: OverclockState = makeInitialState();

function makeInitialState(): OverclockState {
  return { phase: 'idle', roundIndex: 0, roundPhase: 'ready', totalScore: 0, heldMs: 0, multiplier: 1, tickId: null, lastChargeSoundAt: 0 };
}

function main(): HTMLElement {
  return document.getElementById('main')!;
}

export function renderOverclockGame(): void {
  if (state.tickId) clearInterval(state.tickId);
  state = makeInitialState();
  drawShell();
}

function drawShell(): void {
  main().innerHTML = `
    <div class="page">
      <div class="game-shell">
        <div class="game-topbar">
          <span id="ocRoundLabel">OVERCLOCK</span>
          <span id="ocScore" class="mono">0 POINT</span>
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
        <div class="arena-title">Klar til at presse held?</div>
        <ul class="instructions-list">
          <li>Hold nede for at lade kernen op — jo længere, jo højere multiplikator</li>
          <li>Slip for at banke gevinsten, før kernen overloader</li>
          <li>Overloader den mens du holder, mister du hele rundens gevinst</li>
          <li>${TOTAL_ROUNDS} runder — din samlede bankede score tæller</li>
        </ul>
        <button class="btn btn-primary btn-lg" id="startBtn">START</button>
      </div>
    `;
    document.getElementById('startBtn')!.addEventListener('click', (e) => {
      e.stopPropagation();
      startSession();
    });
  } else if (state.phase === 'playing') {
    drawRound();
  }
}

function startSession(): void {
  state.phase = 'playing';
  state.roundIndex = 0;
  state.totalScore = 0;
  updateScoreLabel();
  drawArenaContent();
}

function roundDotsHtml(): string {
  let html = '<div class="round-dots">';
  for (let i = 0; i < TOTAL_ROUNDS; i++) {
    const cls = i < state.roundIndex ? 'done' : i === state.roundIndex ? 'current' : '';
    html += `<div class="round-dot ${cls}"></div>`;
  }
  return html + '</div>';
}

function updateRoundLabel(): void {
  const el = document.getElementById('ocRoundLabel');
  if (el) el.textContent = `OVERCLOCK — RUNDE ${state.roundIndex + 1}/${TOTAL_ROUNDS}`;
}

function drawRound(): void {
  state.roundPhase = 'ready';
  state.heldMs = 0;
  state.multiplier = 1;
  updateRoundLabel();
  const a = document.getElementById('arena')!;
  a.innerHTML = `
    <div class="arena-inner" style="gap:20px">
      ${roundDotsHtml()}
      <div class="oc-core" id="ocCore">
        <div class="oc-mult mono" id="ocMult">x1.00</div>
      </div>
      <div class="oc-hint" id="ocHint">HOLD NEDE FOR AT LADE OP</div>
    </div>
  `;
  const core = document.getElementById('ocCore')!;
  core.addEventListener('pointerdown', handleCoreDown);
  core.addEventListener('pointerup', handleCoreUp);
  core.addEventListener('pointercancel', handleCoreUp);
  core.addEventListener('pointerleave', handleCoreUp);
}

function handleCoreDown(e: PointerEvent): void {
  if (!e.isPrimary) return;
  if (state.roundPhase !== 'ready') return;
  e.preventDefault();
  state.roundPhase = 'charging';
  state.heldMs = 0;
  state.lastChargeSoundAt = 0;
  const hint = document.getElementById('ocHint');
  if (hint) hint.textContent = 'SLIP FOR AT BANKE';
  document.getElementById('ocCore')?.classList.add('charging');
  Sound.countdown();
  state.tickId = setInterval(tick, TICK_MS);
}

function tick(): void {
  if (!document.getElementById('ocCore')) {
    if (state.tickId) clearInterval(state.tickId);
    state.tickId = null;
    return;
  }
  if (state.roundPhase !== 'charging') return;
  state.heldMs += TICK_MS;
  const heldSeconds = state.heldMs / 1000;
  state.multiplier = 1 + Math.pow(heldSeconds, 1.15) * 1.1;

  // Bust hazard climbs with the multiplier already reached — near-zero at first,
  // steep once you're pushing past ~4x, so every extra second held is a real bet.
  const hazardPerTick = Math.min(0.05, 0.004 * Math.pow(Math.max(0, state.multiplier - 1), 1.6));
  if (Math.random() < hazardPerTick) {
    bust();
    return;
  }

  const multEl = document.getElementById('ocMult');
  if (multEl) multEl.textContent = `x${state.multiplier.toFixed(2)}`;
  const core = document.getElementById('ocCore');
  if (core) {
    const glow = Math.min(1, (state.multiplier - 1) / 8);
    (core as HTMLElement).style.setProperty('--oc-glow', String(glow));
  }
  if (state.heldMs - state.lastChargeSoundAt >= 160) {
    state.lastChargeSoundAt = state.heldMs;
    Sound.charge(state.multiplier);
  }
}

function handleCoreUp(e: PointerEvent): void {
  if (!e.isPrimary) return;
  if (state.roundPhase !== 'charging') return;
  bank();
}

function bank(): void {
  if (state.tickId) clearInterval(state.tickId);
  state.tickId = null;
  state.roundPhase = 'banked';
  const gained = Math.round(BASE_VALUE * state.multiplier);
  state.totalScore += gained;
  updateScoreLabel();
  Sound.bank();
  Haptics.personalBest();
  const core = document.getElementById('ocCore');
  core?.classList.remove('charging');
  core?.classList.add('banked');
  const hint = document.getElementById('ocHint');
  if (hint) hint.innerHTML = `<span style="color:var(--lime)">BANKET +${gained}</span>`;
  setTimeout(nextRoundOrFinish, 900);
}

function bust(): void {
  if (state.tickId) clearInterval(state.tickId);
  state.tickId = null;
  state.roundPhase = 'busted';
  Sound.overload();
  Haptics.miss();
  const core = document.getElementById('ocCore');
  core?.classList.remove('charging');
  core?.classList.add('busted');
  const hint = document.getElementById('ocHint');
  if (hint) hint.innerHTML = `<span style="color:var(--coral)">OVERLOAD — RUNDEN TABT</span>`;
  setTimeout(nextRoundOrFinish, 900);
}

function nextRoundOrFinish(): void {
  if (state.phase !== 'playing' || !document.getElementById('arena')) return;
  state.roundIndex++;
  if (state.roundIndex >= TOTAL_ROUNDS) {
    endSession();
  } else {
    drawRound();
  }
}

function updateScoreLabel(): void {
  const el = document.getElementById('ocScore');
  if (el) el.textContent = `${state.totalScore} POINT`;
}

function endSession(): void {
  state.phase = 'result';
  void finishSession();
}

async function finishSession(): Promise<void> {
  const score = state.totalScore;
  const { isNewBest, xpGain, rank } = await finishGameSession('overclock', score);

  Sound.complete();
  if (isNewBest) {
    setTimeout(() => Sound.pb(), 250);
    Haptics.personalBest();
  }

  drawFinalScreen(score, isNewBest, xpGain, rank);
}

function drawFinalScreen(score: number, isNewBest: boolean, xpGain: number, rank: number | null): void {
  const rating = ScoreKinds.overclock_score.rating(score);
  const avgPerRound = Math.round(score / TOTAL_ROUNDS);
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
            <div class="fstat"><div class="n">${avgPerRound}</div><div class="l">Snit/runde</div></div>
            <div class="fstat"><div class="n">${rank ? '#' + rank : '—'}</div><div class="l">Placering</div></div>
            <div class="fstat"><div class="n">+${xpGain}</div><div class="l">XP optjent</div></div>
          </div>

          <div class="final-ctas">
            <button class="btn btn-primary btn-lg" id="playAgainBtn">SPIL IGEN</button>
            <button class="btn btn-ghost btn-lg" data-nav="leaderboard-overclock">LEADERBOARD</button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.getElementById('playAgainBtn')!.addEventListener('click', () => {
    Sound.click();
    renderOverclockGame();
  });
}
