import { ScoreKinds } from '../../scoring';
import { Sound } from '../../sound';
import { Haptics } from '../../haptics';
import { finishGameSession } from '../../state';
import { gameUtilBarHtml, wireGameChrome } from '../../gameChrome';

const SESSION_MS = 55_000;
/** Time a note takes to travel from spawn to the hit-line. */
const TRAVEL_MS = 1100;
const PERFECT_WINDOW_MS = 90;
const GOOD_WINDOW_MS = 180;
/** Distance below the hit-line before an unjudged note counts as an auto-miss. */
const MISS_GRACE_FRAC = 1.35;

type Phase = 'idle' | 'playing' | 'result';

interface Note {
  id: number;
  hitTimeMs: number;
  strong: boolean;
  spawned: boolean;
  judged: boolean;
  audioPlayed: boolean;
  el: HTMLElement | null;
}

interface PulseState {
  phase: Phase;
  schedule: Note[];
  nextSpawnIdx: number;
  score: number;
  combo: number;
  bestCombo: number;
  perfectCount: number;
  goodCount: number;
  missCount: number;
  startTime: number;
  rafId: number | null;
  trackTravelPx: number;
}

let nextNoteId = 1;
let state: PulseState = makeInitialState();

function makeInitialState(): PulseState {
  return {
    phase: 'idle',
    schedule: [],
    nextSpawnIdx: 0,
    score: 0,
    combo: 0,
    bestCombo: 0,
    perfectCount: 0,
    goodCount: 0,
    missCount: 0,
    startTime: 0,
    rafId: null,
    trackTravelPx: 0,
  };
}

function main(): HTMLElement {
  return document.getElementById('main')!;
}

export function renderPulseGame(): void {
  if (state.rafId != null) cancelAnimationFrame(state.rafId);
  state = makeInitialState();
  drawShell();
  wireGameChrome('pulse', renderPulseGame);
}

function drawShell(): void {
  main().innerHTML = `
    <div class="page">
      <div class="game-shell">
        <div class="game-topbar">
          <span id="pulseTimer">PULSE — 55s</span>
          <span id="pulseScore" class="mono">0 POINT</span>
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
        <div class="arena-title">Klar til at ramme takten?</div>
        <ul class="instructions-list">
          <li>Toner falder ned mod linjen — tap et sted i banen når de rammer den</li>
          <li>Ram præcist for PERFECT, lidt ved siden af for GOD</li>
          <li>Combo øger point pr. hit — men brister ved et missede tryk</li>
        </ul>
        <button class="btn btn-primary btn-lg" id="pulseStartBtn">START</button>
      </div>
    `;
    document.getElementById('pulseStartBtn')!.addEventListener('click', (e) => {
      e.stopPropagation();
      startSession();
    });
  } else if (state.phase === 'playing') {
    a.innerHTML = `
      <div class="pulse-wrap">
        <div class="pulse-combo mono" id="pulseCombo"></div>
        <div class="pulse-track" id="pulseTrack">
          <div class="pulse-notes" id="pulseNotes"></div>
          <div class="pulse-judge" id="pulseJudge"></div>
          <div class="pulse-hitline"></div>
        </div>
      </div>
    `;
    document.getElementById('pulseTrack')!.addEventListener('pointerdown', handleTap);
  }
}

/** Builds the whole session's note timeline up front — a steady beat per segment (tempo climbing
 * 120→150 BPM across 4 segments) with an extra syncopated off-beat note on a fixed cadence, so
 * difficulty ramps mainly via rhythmic density/surprise rather than raw speed. Deliberately no
 * RNG here: a coin-flip-per-beat used to decide the off-beats, so the total note count (and
 * therefore the max score a PERFECT run could reach) varied session to session — a flawless run
 * could still lose to a luckier, denser schedule. A fixed cadence gives every session the exact
 * same chart, so score differences are purely about timing, not the luck of the draw — and the
 * cadence below is a bit denser on average than the old random rates (1/5, 1/3, 1/2 vs. .15/.3/.45),
 * so it's also a notch harder throughout. */
function buildSchedule(): Note[] {
  const segments = [
    { bpm: 120, syncEvery: 0 }, // steady beat only — no off-beats yet
    { bpm: 130, syncEvery: 5 }, // extra off-beat every 5th beat
    { bpm: 140, syncEvery: 3 }, // every 3rd beat
    { bpm: 150, syncEvery: 2 }, // every other beat
  ];
  const segMs = SESSION_MS / segments.length;
  const maxHitTime = SESSION_MS - TRAVEL_MS - 300;
  const list: { hitTimeMs: number; strong: boolean }[] = [];
  let t = 900; // small lead-in before the first note
  let segIdx = -1;
  let beatInSeg = 0;
  while (t <= maxHitTime) {
    const idx = Math.min(segments.length - 1, Math.floor(t / segMs));
    if (idx !== segIdx) {
      segIdx = idx;
      beatInSeg = 0;
    }
    const seg = segments[segIdx];
    const beatMs = 60000 / seg.bpm;
    list.push({ hitTimeMs: t, strong: true });
    if (seg.syncEvery > 0 && beatInSeg % seg.syncEvery === 0 && t + beatMs / 2 <= maxHitTime) {
      list.push({ hitTimeMs: t + beatMs / 2, strong: false });
    }
    t += beatMs;
    beatInSeg++;
  }
  list.sort((a, b) => a.hitTimeMs - b.hitTimeMs);
  return list.map((entry) => ({ id: nextNoteId++, hitTimeMs: entry.hitTimeMs, strong: entry.strong, spawned: false, judged: false, audioPlayed: false, el: null }));
}

function startSession(): void {
  state.phase = 'playing';
  state.schedule = buildSchedule();
  state.nextSpawnIdx = 0;
  state.score = 0;
  state.combo = 0;
  state.bestCombo = 0;
  state.perfectCount = 0;
  state.goodCount = 0;
  state.missCount = 0;
  drawArenaContent();
  updateScoreLabel();
  const track = document.getElementById('pulseTrack');
  const hitline = track?.querySelector<HTMLElement>('.pulse-hitline');
  state.trackTravelPx = track && hitline ? hitline.offsetTop : 380;
  Sound.countdown();
  state.startTime = performance.now();
  state.rafId = requestAnimationFrame(loop);
}

function spawnNote(note: Note): void {
  const container = document.getElementById('pulseNotes');
  if (!container) return;
  const el = document.createElement('div');
  el.className = `pulse-note ${note.strong ? 'strong' : 'weak'}`;
  el.style.transform = 'translateY(0px)';
  container.appendChild(el);
  note.spawned = true;
  note.el = el;
}

function removeNoteEl(note: Note): void {
  note.el?.remove();
  note.el = null;
}

function showJudgement(text: string, color: string): void {
  const el = document.getElementById('pulseJudge');
  if (!el) return;
  el.textContent = text;
  el.style.color = color;
  el.classList.remove('pop');
  void el.offsetWidth;
  el.classList.add('pop');
}

function comboTier(): number {
  return 1 + Math.floor(state.combo / 10);
}

function updateCombo(): void {
  const el = document.getElementById('pulseCombo');
  if (el) el.textContent = state.combo > 0 ? `COMBO ×${state.combo}` : '';
}

function judgeHit(note: Note, grade: 'perfect' | 'good'): void {
  note.judged = true;
  state.combo++;
  state.bestCombo = Math.max(state.bestCombo, state.combo);
  const base = grade === 'perfect' ? 100 : 40;
  state.score += base * comboTier();
  if (grade === 'perfect') {
    state.perfectCount++;
    Sound.perfect();
    Haptics.hit();
    showJudgement('PERFECT', 'var(--lime)');
  } else {
    state.goodCount++;
    Sound.hit();
    Haptics.tap();
    showJudgement('GOD', 'var(--cyan)');
  }
  removeNoteEl(note);
  updateScoreLabel();
  updateCombo();
}

function judgeMiss(note: Note): void {
  note.judged = true;
  state.missCount++;
  state.combo = 0;
  Sound.mistake();
  showJudgement('MISS', 'var(--coral)');
  removeNoteEl(note);
  updateCombo();
}

function handleTap(e: PointerEvent): void {
  if (!e.isPrimary) return;
  if (state.phase !== 'playing') return;
  e.preventDefault();
  const elapsed = performance.now() - state.startTime;

  let closest: Note | null = null;
  let bestDelta = Infinity;
  for (const note of state.schedule) {
    if (!note.spawned || note.judged) continue;
    const delta = Math.abs(note.hitTimeMs - elapsed);
    if (delta < bestDelta) {
      bestDelta = delta;
      closest = note;
    }
  }
  if (closest && bestDelta <= GOOD_WINDOW_MS) {
    judgeHit(closest, bestDelta <= PERFECT_WINDOW_MS ? 'perfect' : 'good');
  } else {
    state.combo = 0;
    Sound.click();
    updateCombo();
  }
}

function loop(): void {
  if (state.phase !== 'playing' || !document.getElementById('pulseTrack')) {
    if (state.rafId != null) cancelAnimationFrame(state.rafId);
    state.rafId = null;
    return;
  }
  const elapsed = performance.now() - state.startTime;

  while (state.nextSpawnIdx < state.schedule.length && state.schedule[state.nextSpawnIdx].hitTimeMs - TRAVEL_MS <= elapsed) {
    spawnNote(state.schedule[state.nextSpawnIdx]);
    state.nextSpawnIdx++;
  }

  for (const note of state.schedule) {
    if (!note.spawned) continue;
    if (!note.audioPlayed && elapsed >= note.hitTimeMs) {
      note.audioPlayed = true;
      if (note.strong) Sound.beatKick();
      else Sound.beatHat();
    }
    if (note.judged) continue;
    const progress = (elapsed - (note.hitTimeMs - TRAVEL_MS)) / TRAVEL_MS;
    if (progress > MISS_GRACE_FRAC) {
      judgeMiss(note);
      continue;
    }
    if (note.el) note.el.style.transform = `translateY(${progress * state.trackTravelPx}px)`;
  }

  if (elapsed >= SESSION_MS) {
    endSession();
    return;
  }
  updateTimerLabel(SESSION_MS - elapsed);
  state.rafId = requestAnimationFrame(loop);
}

function updateTimerLabel(remainingMs: number): void {
  const el = document.getElementById('pulseTimer');
  if (!el) return;
  const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
  el.textContent = `PULSE — ${seconds}s`;
}

function updateScoreLabel(): void {
  const el = document.getElementById('pulseScore');
  if (el) el.textContent = `${state.score} POINT`;
}

function endSession(): void {
  if (state.rafId != null) cancelAnimationFrame(state.rafId);
  state.rafId = null;
  state.phase = 'result';
  void finishSession();
}

async function finishSession(): Promise<void> {
  const score = state.score;
  const { isNewBest, xpGain, rank } = await finishGameSession('pulse', score);

  Sound.complete();
  if (isNewBest) {
    setTimeout(() => Sound.pb(), 250);
    Haptics.personalBest();
  }

  drawFinalScreen(score, isNewBest, xpGain, rank);
}

function drawFinalScreen(score: number, isNewBest: boolean, xpGain: number, rank: number | null): void {
  const rating = ScoreKinds.pulse_score.rating(score);
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
            <div class="fstat"><div class="n">${state.perfectCount}</div><div class="l">Perfect</div></div>
            <div class="fstat"><div class="n">${state.bestCombo}</div><div class="l">Bedste combo</div></div>
            <div class="fstat"><div class="n">${rank ? '#' + rank : '—'}</div><div class="l">Placering</div></div>
            <div class="fstat"><div class="n">+${xpGain}</div><div class="l">XP optjent</div></div>
          </div>

          <div class="final-ctas">
            <button class="btn btn-primary btn-lg" id="playAgainBtn">SPIL IGEN</button>
            <button class="btn btn-ghost btn-lg" data-nav="leaderboard-pulse">LEADERBOARD</button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.getElementById('playAgainBtn')!.addEventListener('click', () => {
    Sound.click();
    renderPulseGame();
  });
}
