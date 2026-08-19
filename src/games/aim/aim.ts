import { ScoreKinds } from '../../scoring';
import { Sound } from '../../sound';
import { Haptics } from '../../haptics';
import { finishGameSession } from '../../state';
import { gameUtilBarHtml, wireGameChrome } from '../../gameChrome';
import { toast } from '../../toast';

const SESSION_MS = 30_000;
/** Visible target circle (identity match with Reaction's target). */
const TARGET_VISUAL_SIZE = 88;
/** Actual tappable wrapper is larger than the visible circle for forgiving mobile taps. */
const TARGET_HIT_SIZE = 108;
const ARENA_PAD = 14;
/** Below this the arena can't fit meaningful target movement — spawns collapse toward one
 * corner, which turns "aiming" into "spam a fixed point" (autoclicker-exploitable via a
 * shrunk browser window). Set low enough to clear real small phones (~320-375px viewport,
 * minus .page's mobile padding) untouched — the exploit needs a much more aggressive shrink
 * than any real device viewport to collapse spawn variance this far. */
const MIN_ARENA_W = 280;
const MIN_ARENA_H = 240;
/** Floor on time-since-spawn before a hit counts, independent of arena size — the hard cap
 * on achievable score against click-spam (autoclickers, held-down macros). Comfortably above
 * genuine target-acquisition time but far below what raw click-spam needs to rack up hits. */
const MIN_HIT_INTERVAL_MS = 110;

type AimPhase = 'idle' | 'playing' | 'result';

interface AimState {
  phase: AimPhase;
  score: number;
  endAt: number;
  tickId: ReturnType<typeof setInterval> | null;
  lastSpawnAt: number;
}

let aimState: AimState = makeInitialState();

function makeInitialState(): AimState {
  return { phase: 'idle', score: 0, endAt: 0, tickId: null, lastSpawnAt: 0 };
}

function arenaTooSmall(): boolean {
  const a = arenaEl();
  return a.clientWidth < MIN_ARENA_W || a.clientHeight < MIN_ARENA_H;
}

function main(): HTMLElement {
  return document.getElementById('main')!;
}
function arenaEl(): HTMLElement {
  return document.getElementById('arena')!;
}

export function renderAimGame(): void {
  if (aimState.tickId) clearInterval(aimState.tickId);
  aimState = makeInitialState();
  drawShell();
  wireGameChrome('aim', renderAimGame);
}

function drawShell(): void {
  main().innerHTML = `
    <div class="page">
      <div class="game-shell">
        <div class="game-topbar">
          <span id="aimTimer">AIM TRAINER — 30s</span>
          <span id="aimScore" class="mono">0 HITS</span>
        </div>
        ${gameUtilBarHtml()}
        <div class="arena" id="arena"></div>
      </div>
    </div>
  `;
  drawArenaContent();
  // Single pointerdown listener drives the hit path: fires on first contact
  // (unlike click, which waits for release) for minimum input lag.
  arenaEl().addEventListener('pointerdown', handleArenaPointerDown);
}

function drawArenaContent(): void {
  const a = arenaEl();
  a.className = 'arena';
  if (aimState.phase === 'idle') {
    a.innerHTML = `
      <div class="arena-inner">
        <div class="arena-title">Klar til at sigte?</div>
        <ul class="instructions-list">
          <li>Ram målet så mange gange du kan på 30 sekunder</li>
          <li>Målet flytter sig med det samme efter hvert hit</li>
          <li>Tap hurtigt og præcist — hvert hit tæller</li>
        </ul>
        <button class="btn btn-primary btn-lg" id="aimStartBtn">START</button>
      </div>
    `;
    document.getElementById('aimStartBtn')!.addEventListener('click', (e) => {
      e.stopPropagation();
      if (arenaTooSmall()) {
        toast('Gør browservinduet større for at spille — banen er for lille til at sigte i.');
        return;
      }
      startSession();
    });
  } else if (aimState.phase === 'playing') {
    a.classList.add('state-target');
    spawnTarget();
  }
  // 'result' phase renders a full-screen takeover via drawFinalScreen(), not into the arena.
}

function spawnTarget(): void {
  const a = arenaEl();
  const w = a.clientWidth || 600;
  const h = a.clientHeight || 400;
  const maxX = Math.max(0, w - TARGET_HIT_SIZE - ARENA_PAD * 2);
  const maxY = Math.max(0, h - TARGET_HIT_SIZE - ARENA_PAD * 2);
  const x = ARENA_PAD + Math.random() * maxX;
  const y = ARENA_PAD + Math.random() * maxY;
  a.innerHTML = `
    <div class="target-hit" style="left:${x}px; top:${y}px;">
      <button class="target-btn" style="width:${TARGET_VISUAL_SIZE}px;height:${TARGET_VISUAL_SIZE}px;" tabindex="-1"></button>
    </div>
  `;
  aimState.lastSpawnAt = performance.now();
  Sound.target();
}

function startSession(): void {
  aimState.phase = 'playing';
  aimState.score = 0;
  aimState.endAt = performance.now() + SESSION_MS;
  drawArenaContent();
  updateTimerLabel();
  Sound.countdown();
  aimState.tickId = setInterval(() => {
    // The user may have navigated to a different page mid-session — the interval
    // keeps running (nothing clears it on route change), so bail out instead of
    // silently finalizing/scoring a session nobody is looking at anymore.
    if (!document.getElementById('arena')) {
      if (aimState.tickId) clearInterval(aimState.tickId);
      aimState.tickId = null;
      return;
    }
    const remainingMs = aimState.endAt - performance.now();
    if (remainingMs <= 0) {
      endSession();
      return;
    }
    updateTimerLabel(remainingMs);
  }, 200);
}

function updateTimerLabel(remainingMsInput?: number): void {
  const el = document.getElementById('aimTimer');
  if (!el) return;
  const remainingMs = remainingMsInput ?? aimState.endAt - performance.now();
  const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
  el.textContent = `AIM TRAINER — ${seconds}s`;
}

function updateScoreLabel(): void {
  const el = document.getElementById('aimScore');
  if (el) el.textContent = `${aimState.score} HITS`;
}

function handleArenaPointerDown(e: PointerEvent): void {
  if (!e.isPrimary) return; // ignore extra fingers in a multi-touch gesture
  if (aimState.phase !== 'playing') return;
  e.preventDefault();

  const hitTarget = (e.target as HTMLElement).closest('.target-hit');
  if (!hitTarget) {
    Sound.mistake();
    return;
  }

  // Both guards below reject the hit without moving the target — a shrunk-window or
  // click-spam exploit just stalls out on a target it can no longer legally claim,
  // rather than getting a fresh (and equally free) respawn to try again on.
  if (arenaTooSmall()) {
    Sound.mistake();
    return;
  }
  if (performance.now() - aimState.lastSpawnAt < MIN_HIT_INTERVAL_MS) {
    Sound.mistake();
    return;
  }

  aimState.score++;
  updateScoreLabel();
  Sound.hit();
  Haptics.hit();
  spawnTarget();
}

function endSession(): void {
  if (aimState.tickId) clearInterval(aimState.tickId);
  aimState.tickId = null;
  aimState.phase = 'result';
  void finishSession();
}

async function finishSession(): Promise<void> {
  const score = aimState.score;
  const { isNewBest, xpGain, rank } = await finishGameSession('aim', score);

  Sound.complete();
  if (isNewBest) {
    setTimeout(() => Sound.pb(), 250);
    Haptics.personalBest();
  }

  drawFinalScreen(score, isNewBest, xpGain, rank);
}

function drawFinalScreen(score: number, isNewBest: boolean, xpGain: number, rank: number | null): void {
  const rating = ScoreKinds.aim_hits.rating(score);
  const perSecond = (score / (SESSION_MS / 1000)).toFixed(1);
  main().innerHTML = `
    <div class="page">
      <div class="game-shell">
        <div class="final-wrap">
          <div class="final-label">Din score</div>
          <div class="final-score">${score}<span style="font-size:26px">hits</span></div>
          <div class="final-rating" style="color:${rating.color}">${rating.label}</div>
          ${isNewBest ? '<div class="pb-flag">★ NY PERSONLIG REKORD</div>' : ''}
          <div class="xp-toast">✦ +${xpGain} XP optjent${rank && rank <= 3 ? ' · TOP 3-BONUS' : ''}</div>

          <div class="final-stats">
            <div class="fstat"><div class="n">${score}</div><div class="l">Hits</div></div>
            <div class="fstat"><div class="n">${perSecond}</div><div class="l">Hits/sek</div></div>
            <div class="fstat"><div class="n">${rank ? '#' + rank : '—'}</div><div class="l">Placering</div></div>
            <div class="fstat"><div class="n">+${xpGain}</div><div class="l">XP optjent</div></div>
          </div>

          <div class="final-ctas">
            <button class="btn btn-primary btn-lg" id="playAgainBtn">SPIL IGEN</button>
            <button class="btn btn-ghost btn-lg" data-nav="leaderboard-aim">LEADERBOARD</button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.getElementById('playAgainBtn')!.addEventListener('click', () => {
    Sound.click();
    renderAimGame();
  });
}
