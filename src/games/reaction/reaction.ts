import { ScoreKinds } from '../../scoring';
import { XP_RULES } from '../../xp';
import { Sound } from '../../sound';
import { Haptics } from '../../haptics';
import { profile, saveProfile, getCombinedLeaderboard, pushLeaderboardEntry, checkAchievements } from '../../state';
import { refreshHeader } from '../../header';

const REACTION_ROUNDS = 5;
/** Visible target circle stays this size (identity match with the original design). */
const TARGET_VISUAL_SIZE = 88;
/** Actual tappable wrapper is larger for forgiving mobile taps — min 44px is trivially covered. */
const TARGET_HIT_SIZE = 108;
const ARENA_PAD = 14;

type ReactionPhase = 'idle' | 'waiting' | 'target' | 'early' | 'roundresult';

interface ReactionState {
  round: number;
  results: number[];
  phase: ReactionPhase;
  timeoutId: ReturnType<typeof setTimeout> | null;
  targetShownAt: number;
}

let reactionState: ReactionState = makeInitialState();

function makeInitialState(): ReactionState {
  return { round: 0, results: [], phase: 'idle', timeoutId: null, targetShownAt: 0 };
}

function main(): HTMLElement {
  return document.getElementById('main')!;
}
function arenaEl(): HTMLElement {
  return document.getElementById('arena')!;
}

export function renderReactionGame(): void {
  if (reactionState.timeoutId) clearTimeout(reactionState.timeoutId);
  reactionState = makeInitialState();
  drawReactionShell();
}

function roundDotsHtml(): string {
  let html = '';
  for (let i = 0; i < REACTION_ROUNDS; i++) {
    const cls = i < reactionState.results.length ? 'done' : i === reactionState.round && reactionState.phase !== 'idle' ? 'current' : '';
    html += `<div class="round-dot ${cls}"></div>`;
  }
  return html;
}

function drawReactionShell(): void {
  main().innerHTML = `
    <div class="page">
      <div class="game-shell">
        <div class="game-topbar">
          <span>REACTION — ROUND ${Math.min(reactionState.round + 1, REACTION_ROUNDS)} / ${REACTION_ROUNDS}</span>
          <div class="round-dots">${roundDotsHtml()}</div>
        </div>
        <div class="arena" id="arena"></div>
      </div>
    </div>
  `;
  drawArenaContent();
  // Single pointerdown listener drives the whole reaction hot path: it fires
  // on first contact (unlike click, which waits for release), giving both
  // lower latency and a more accurate timestamp for the reaction reading.
  arenaEl().addEventListener('pointerdown', handleArenaPointerDown);
}

function drawArenaContent(): void {
  const a = arenaEl();
  a.className = 'arena';
  if (reactionState.phase === 'idle') {
    a.innerHTML = `
      <div class="arena-inner">
        <div class="arena-title">Ready?</div>
        <ul class="instructions-list">
          <li>Wait for the screen to light up green</li>
          <li>Click / tap the instant you see it</li>
          <li>5 rounds — clicking early costs you the round</li>
        </ul>
        <button class="btn btn-primary btn-lg" id="startBtn">START ROUND 1</button>
      </div>
    `;
    document.getElementById('startBtn')!.addEventListener('click', (e) => {
      e.stopPropagation();
      startRound();
    });
  } else if (reactionState.phase === 'waiting') {
    a.classList.add('state-wait');
    a.innerHTML = `<div class="arena-inner"><div class="arena-msg">wait for it…</div></div>`;
  } else if (reactionState.phase === 'target') {
    a.classList.add('state-target');
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
    reactionState.targetShownAt = performance.now();
    Sound.target();
  } else if (reactionState.phase === 'early') {
    a.classList.add('state-early');
    a.innerHTML = `<div class="arena-inner"><div class="too-early-label">TOO EARLY</div><div class="arena-sub">Wait for the green light next time.</div></div>`;
  } else if (reactionState.phase === 'roundresult') {
    const ms = reactionState.results[reactionState.results.length - 1];
    const rating = ScoreKinds.reaction_ms.rating(ms);
    a.innerHTML = `
      <div class="arena-inner">
        <div class="result-ms" style="color:${rating.color}">${Math.round(ms)}<span style="font-size:22px">ms</span></div>
        <div class="rating-label" style="color:${rating.color}">${rating.label}</div>
      </div>
    `;
  }
}

function startRound(): void {
  reactionState.phase = 'waiting';
  updateTopbar();
  drawArenaContent();
  Sound.countdown();
  const delay = 900 + Math.random() * 2600;
  reactionState.timeoutId = setTimeout(() => {
    reactionState.phase = 'target';
    drawArenaContent();
  }, delay);
}

function updateTopbar(): void {
  const bar = document.querySelector('.game-topbar span');
  const dots = document.querySelector('.round-dots');
  if (bar) bar.textContent = `REACTION — ROUND ${Math.min(reactionState.round + 1, REACTION_ROUNDS)} / ${REACTION_ROUNDS}`;
  if (dots) dots.innerHTML = roundDotsHtml();
}

function handleArenaPointerDown(e: PointerEvent): void {
  if (!e.isPrimary) return; // ignore extra fingers in a multi-touch gesture
  if (reactionState.phase === 'idle' || reactionState.phase === 'roundresult') return;
  e.preventDefault();

  if (reactionState.phase === 'waiting') {
    if (reactionState.timeoutId) clearTimeout(reactionState.timeoutId);
    reactionState.phase = 'early';
    drawArenaContent();
    Sound.mistake();
    Haptics.miss();
    setTimeout(() => {
      advanceAfterRound(1200);
    }, 1100);
    return;
  }

  if (reactionState.phase === 'target') {
    const ms = performance.now() - reactionState.targetShownAt;
    reactionState.results.push(ms);
    reactionState.phase = 'roundresult';
    updateTopbar();
    drawArenaContent();
    Sound.hit();
    Haptics.hit();
    setTimeout(() => {
      advanceAfterRound(650);
    }, 50);
  }
}

function advanceAfterRound(delay: number): void {
  setTimeout(async () => {
    reactionState.round++;
    if (reactionState.round >= REACTION_ROUNDS) {
      await finishReactionSession();
    } else {
      reactionState.phase = 'idle';
      updateTopbar();
      drawArenaContent();
      // auto-continue to keep flow snappy
      const arena = arenaEl();
      arena.innerHTML = `
        <div class="arena-inner">
          <div class="arena-title">Round ${reactionState.round + 1}</div>
          <button class="btn btn-primary btn-lg" id="nextBtn">CONTINUE</button>
        </div>
      `;
      document.getElementById('nextBtn')!.addEventListener('click', (e) => {
        e.stopPropagation();
        startRound();
      });
    }
  }, delay);
}

async function finishReactionSession(): Promise<void> {
  if (!profile) return;
  const results = reactionState.results;
  while (results.length < REACTION_ROUNDS) results.push(600); // safety fallback, shouldn't normally trigger
  const avg = results.reduce((a, b) => a + b, 0) / results.length;
  const best = Math.min(...results);
  const isNewBest = profile.bestReaction == null || best < profile.bestReaction;
  const isNewAvgBest = profile.bestAvg == null || avg < profile.bestAvg;

  profile.sessionsPlayed++;
  if (isNewBest) profile.bestReaction = best;
  if (isNewAvgBest) profile.bestAvg = avg;
  profile.history.unshift({ date: Date.now(), results, avg, best });
  profile.history = profile.history.slice(0, 20);
  const currentBest = profile.bestReaction; // guaranteed non-null: either just set, or already existed
  await saveProfile();
  await pushLeaderboardEntry(currentBest!);

  let xpGain = XP_RULES.complete;
  if (isNewBest) xpGain += XP_RULES.personalBest;
  const board = await getCombinedLeaderboard();
  const myRank = board.findIndex((e) => e.id === profile!.id) + 1;
  if (myRank > 0 && myRank <= 3) xpGain += XP_RULES.top3;

  profile.xp += xpGain;
  await saveProfile();
  refreshHeader();

  Sound.complete();
  if (isNewBest) {
    setTimeout(() => Sound.pb(), 250);
    Haptics.personalBest();
  }

  drawFinalScreen(results, avg, best, isNewBest, xpGain, myRank);
  await checkAchievements();
}

function drawFinalScreen(results: number[], avg: number, best: number, isNewBest: boolean, xpGain: number, rank: number): void {
  const rating = ScoreKinds.reaction_ms.rating(avg);
  main().innerHTML = `
    <div class="page">
      <div class="game-shell">
        <div class="final-wrap">
          <div class="final-label">Your score</div>
          <div class="final-score">${Math.round(avg)}<span style="font-size:26px">ms</span></div>
          <div class="final-rating" style="color:${rating.color}">${rating.label}</div>
          ${isNewBest ? '<div class="pb-flag">★ NEW PERSONAL BEST</div>' : ''}
          <div class="xp-toast">✦ +${xpGain} XP earned${rank && rank <= 3 ? ' · TOP 3 BONUS' : ''}</div>

          <div class="final-stats">
            <div class="fstat"><div class="n">${Math.round(best)}</div><div class="l">Best round</div></div>
            <div class="fstat"><div class="n">${Math.round(avg)}</div><div class="l">Average</div></div>
            <div class="fstat"><div class="n">${rank ? '#' + rank : '—'}</div><div class="l">Rank</div></div>
            <div class="fstat"><div class="n">+${xpGain}</div><div class="l">XP earned</div></div>
          </div>

          <div class="panel" style="width:100%;text-align:left;padding:18px">
            <div class="section-label" style="margin-bottom:12px">Round breakdown</div>
            <div class="round-breakdown">
              ${results
                .map((r, i) => {
                  const pct = Math.max(6, 100 - Math.min(100, (r / 500) * 100));
                  return `<div class="rb-row"><span class="rb-idx">${i + 1}</span><div class="rb-bar-track"><div class="rb-bar-fill" style="width:${pct}%"></div></div><span class="rb-val">${Math.round(r)} ms</span></div>`;
                })
                .join('')}
            </div>
          </div>

          <div class="final-ctas">
            <button class="btn btn-primary btn-lg" id="playAgainBtn">PLAY AGAIN</button>
            <button class="btn btn-ghost btn-lg" data-nav="leaderboard">LEADERBOARD</button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.getElementById('playAgainBtn')!.addEventListener('click', () => {
    Sound.click();
    renderReactionGame();
  });
}
