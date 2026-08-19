import { ScoreKinds } from '../../scoring';
import { Sound } from '../../sound';
import { Haptics } from '../../haptics';
import { finishGameSession } from '../../state';
import { gameUtilBarHtml, wireGameChrome } from '../../gameChrome';

const COLOR_ROUNDS = 5;
const MAX_DIST = Math.sqrt(3 * 255 * 255);
/** Time to lock in a guess before it auto-confirms as-is — without this, nothing punished
 * endlessly fine-tuning sliders, which is why everyone converged on the same 95-99% cluster. */
const ROUND_TIME_MS = 7000;
/** Accuracy = 100 * closeness^ACCURACY_CURVE (closeness = 1 - dist/MAX_DIST). >1 stretches the
 * top of the scale out (near-perfect guesses spread across a wider range) while compressing bad
 * guesses toward 0 — the linear version (curve=1) let everyone's "pretty close" guesses land
 * within a few points of each other at the top. */
const ACCURACY_CURVE = 1.8;

type ColorPhase = 'idle' | 'guessing' | 'roundresult';

interface RGB {
  r: number;
  g: number;
  b: number;
}

interface ColorState {
  phase: ColorPhase;
  round: number;
  target: RGB;
  guess: RGB;
  results: number[]; // accuracy % per round
  timeoutId: ReturnType<typeof setTimeout> | null;
}

let colorState: ColorState = makeInitialState();

function makeInitialState(): ColorState {
  return { phase: 'idle', round: 0, target: { r: 128, g: 128, b: 128 }, guess: { r: 128, g: 128, b: 128 }, results: [], timeoutId: null };
}

function main(): HTMLElement {
  return document.getElementById('main')!;
}
function arenaEl(): HTMLElement {
  return document.getElementById('arena')!;
}

export function renderColorGame(): void {
  if (colorState.timeoutId) clearTimeout(colorState.timeoutId);
  colorState = makeInitialState();
  drawShell();
  wireGameChrome('color', renderColorGame);
}

function roundDotsHtml(): string {
  let html = '';
  for (let i = 0; i < COLOR_ROUNDS; i++) {
    const cls = i < colorState.results.length ? 'done' : i === colorState.round && colorState.phase !== 'idle' ? 'current' : '';
    html += `<div class="round-dot ${cls}"></div>`;
  }
  return html;
}

function drawShell(): void {
  main().innerHTML = `
    <div class="page">
      <div class="game-shell">
        <div class="game-topbar">
          <span>COLOR MATCH — RUNDE ${Math.min(colorState.round + 1, COLOR_ROUNDS)} / ${COLOR_ROUNDS}</span>
          <div class="round-dots">${roundDotsHtml()}</div>
        </div>
        ${gameUtilBarHtml()}
        <div class="arena" id="arena"></div>
      </div>
    </div>
  `;
  drawArenaContent();
}

function updateTopbar(): void {
  const bar = document.querySelector('.game-topbar span');
  const dots = document.querySelector('.round-dots');
  if (bar) bar.textContent = `COLOR MATCH — RUNDE ${Math.min(colorState.round + 1, COLOR_ROUNDS)} / ${COLOR_ROUNDS}`;
  if (dots) dots.innerHTML = roundDotsHtml();
}

/** 20..235 keeps targets away from pure black/white so all three sliders stay meaningfully in play. */
function randChannel(): number {
  return 20 + Math.floor(Math.random() * 216);
}

function rgbCss(c: RGB): string {
  return `rgb(${c.r},${c.g},${c.b})`;
}

function distance(a: RGB, b: RGB): number {
  const dr = a.r - b.r,
    dg = a.g - b.g,
    db = a.b - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function accuracyFor(a: RGB, b: RGB): number {
  const d = distance(a, b);
  const closeness = Math.max(0, 1 - d / MAX_DIST);
  return 100 * Math.pow(closeness, ACCURACY_CURVE);
}

/** Live "getting warmer" feedback while dragging — the glow intensity (a CSS custom property, see #guessSwatch in color.css) tracks the same distance formula the final score uses, so the swatch itself telegraphs how close you are before you ever hit BEKRÆFT. */
function updateGuessSwatch(): void {
  const swatch = document.getElementById('guessSwatch');
  if (!swatch) return;
  swatch.style.background = rgbCss(colorState.guess);
  const liveAcc = accuracyFor(colorState.target, colorState.guess);
  swatch.style.setProperty('--glow', String(Math.round(liveAcc)));
  swatch.classList.toggle('is-hot', liveAcc >= 75);
}

function sliderHtml(ch: 'r' | 'g' | 'b', label: string, value: number): string {
  return `
    <div class="slider-row">
      <span class="slider-label slider-label-${ch}">${label}</span>
      <input type="range" min="0" max="255" value="${value}" id="slider-${ch}" class="color-slider slider-${ch}">
    </div>
  `;
}

function drawArenaContent(): void {
  const a = arenaEl();
  a.className = 'arena';
  if (colorState.phase === 'idle') {
    a.innerHTML = `
      <div class="arena-inner">
        <div class="arena-title">Klar til at matche farver?</div>
        <ul class="instructions-list">
          <li>Du får vist en målfarve</li>
          <li>Brug skyderne til at genskabe den så præcist som muligt</li>
          <li>${(ROUND_TIME_MS / 1000).toFixed(0)} sekunder pr. runde — løber tiden ud, bekræftes gættet som det står</li>
          <li>5 runder — jo tættere du rammer, jo højere nøjagtighed</li>
        </ul>
        <button class="btn btn-primary btn-lg" id="colorStartBtn">START RUNDE 1</button>
      </div>
    `;
    document.getElementById('colorStartBtn')!.addEventListener('click', (e) => {
      e.stopPropagation();
      startRound();
    });
  } else if (colorState.phase === 'guessing') {
    a.classList.add('state-guessing');
    a.innerHTML = `
      <div class="color-round">
        <div class="swatch-row">
          <div class="swatch-block">
            <div class="swatch" style="background:${rgbCss(colorState.target)}"></div>
            <div class="swatch-label">Mål</div>
          </div>
          <div class="swatch-block">
            <div class="swatch" id="guessSwatch" style="background:${rgbCss(colorState.guess)}"></div>
            <div class="swatch-label">Din farve</div>
          </div>
        </div>
        <div class="slider-stack">
          ${sliderHtml('r', 'R', colorState.guess.r)}
          ${sliderHtml('g', 'G', colorState.guess.g)}
          ${sliderHtml('b', 'B', colorState.guess.b)}
        </div>
        <div class="color-timer-track"><div class="color-timer-bar" id="colorTimerBar"></div></div>
        <button class="btn btn-primary btn-lg" id="confirmBtn">BEKRÆFT</button>
      </div>
    `;
    startRoundTimer();
    (['r', 'g', 'b'] as const).forEach((ch) => {
      const input = document.getElementById(`slider-${ch}`) as HTMLInputElement;
      input.addEventListener('input', () => {
        colorState.guess[ch] = Number(input.value);
        updateGuessSwatch();
      });
      // A visible "weight" while actively dragging — see .color-slider.is-dragging in color.css.
      const startDrag = () => input.classList.add('is-dragging');
      const endDrag = () => input.classList.remove('is-dragging');
      input.addEventListener('pointerdown', startDrag);
      input.addEventListener('pointerup', endDrag);
      input.addEventListener('pointercancel', endDrag);
    });
    updateGuessSwatch();
    document.getElementById('confirmBtn')!.addEventListener('click', (e) => {
      e.stopPropagation();
      handleConfirm();
    });
  } else if (colorState.phase === 'roundresult') {
    const acc = colorState.results[colorState.results.length - 1];
    const rating = ScoreKinds.color_accuracy.rating(acc);
    const isLast = colorState.round >= COLOR_ROUNDS - 1;
    const isTopTier = acc >= 82;
    a.innerHTML = `
      <div class="arena-inner reveal-pop">
        ${isTopTier ? '<div class="result-flash"></div>' : ''}
        <div class="swatch-row">
          <div class="swatch-block">
            <div class="swatch" style="background:${rgbCss(colorState.target)}"></div>
            <div class="swatch-label">Mål</div>
          </div>
          <div class="swatch-block">
            <div class="swatch" style="background:${rgbCss(colorState.guess)}"></div>
            <div class="swatch-label">Din farve</div>
          </div>
        </div>
        <div class="result-ms" style="color:${rating.color}"><span id="accCountUp">0</span><span style="font-size:22px">%</span></div>
        <div class="rating-label" style="color:${rating.color}">${rating.label}</div>
        <button class="btn btn-primary btn-lg" id="nextBtn">${isLast ? 'SE RESULTAT' : 'NÆSTE RUNDE'}</button>
      </div>
    `;
    animateCountUp(document.getElementById('accCountUp')!, Math.round(acc));
    document.getElementById('nextBtn')!.addEventListener('click', (e) => {
      e.stopPropagation();
      advanceAfterRound();
    });
  }
}

/** Counts a number element up from 0 to `target` over ~450ms — the reveal reads as a genuine moment rather than an instant text swap. Guards against the player having navigated away mid-count. */
function animateCountUp(el: HTMLElement, target: number): void {
  const start = performance.now();
  const durationMs = 450;
  function tick(now: number): void {
    if (!document.body.contains(el)) return; // navigated away — stop silently
    const t = Math.min(1, (now - start) / durationMs);
    const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
    el.textContent = String(Math.round(target * eased));
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function startRound(): void {
  colorState.target = { r: randChannel(), g: randChannel(), b: randChannel() };
  colorState.guess = { r: 128, g: 128, b: 128 };
  colorState.phase = 'guessing';
  updateTopbar();
  drawArenaContent();
}

/** Kicks off the visible countdown bar and the matching auto-confirm timeout — same
 * forced-reflow CSS transition trick the Quiz Duel timer uses (see renderQuestion in
 * pages/duel.ts) so the bar animates from full to empty instead of just appearing empty. */
function startRoundTimer(): void {
  if (colorState.timeoutId) clearTimeout(colorState.timeoutId);
  const bar = document.getElementById('colorTimerBar');
  if (bar) {
    bar.style.transition = 'none';
    bar.style.width = '100%';
    void bar.offsetWidth;
    bar.style.transition = `width ${ROUND_TIME_MS}ms linear`;
    bar.style.width = '0%';
  }
  colorState.timeoutId = setTimeout(() => {
    if (colorState.phase !== 'guessing') return;
    handleConfirm();
  }, ROUND_TIME_MS);
}

function handleConfirm(): void {
  if (colorState.timeoutId) {
    clearTimeout(colorState.timeoutId);
    colorState.timeoutId = null;
  }
  const acc = accuracyFor(colorState.target, colorState.guess);
  colorState.results.push(acc);
  colorState.phase = 'roundresult';
  updateTopbar();
  drawArenaContent();
  if (acc >= 82) {
    Sound.pb();
    Haptics.personalBest();
  } else if (acc >= 29) {
    Sound.hit();
    Haptics.hit();
  } else {
    Sound.mistake();
    Haptics.miss();
  }
}

function advanceAfterRound(): void {
  // The player may have navigated away — nothing else cancels this handler on route change.
  if (!document.getElementById('arena')) return;
  colorState.round++;
  if (colorState.round >= COLOR_ROUNDS) {
    void finishSession();
    return;
  }
  colorState.phase = 'idle';
  updateTopbar();
  const arena = arenaEl();
  arena.innerHTML = `
    <div class="arena-inner">
      <div class="arena-title">Runde ${colorState.round + 1}</div>
      <button class="btn btn-primary btn-lg" id="colorStartBtn">START</button>
    </div>
  `;
  document.getElementById('colorStartBtn')!.addEventListener('click', (e) => {
    e.stopPropagation();
    startRound();
  });
}

async function finishSession(): Promise<void> {
  const avg = colorState.results.reduce((sum, r) => sum + r, 0) / colorState.results.length;
  const score = Math.round(avg);
  const { isNewBest, xpGain, rank } = await finishGameSession('color', score);

  Sound.complete();
  if (isNewBest) {
    setTimeout(() => Sound.pb(), 250);
    Haptics.personalBest();
  }

  drawFinalScreen(score, isNewBest, xpGain, rank);
}

function drawFinalScreen(score: number, isNewBest: boolean, xpGain: number, rank: number | null): void {
  const rating = ScoreKinds.color_accuracy.rating(score);
  const results = colorState.results;
  main().innerHTML = `
    <div class="page">
      <div class="game-shell">
        <div class="final-wrap">
          <div class="final-label">Din score</div>
          <div class="final-score">${score}<span style="font-size:26px">%</span></div>
          <div class="final-rating" style="color:${rating.color}">${rating.label}</div>
          ${isNewBest ? '<div class="pb-flag">★ NY PERSONLIG REKORD</div>' : ''}
          <div class="xp-toast">✦ +${xpGain} XP optjent${rank && rank <= 3 ? ' · TOP 3-BONUS' : ''}</div>

          <div class="final-stats">
            <div class="fstat"><div class="n">${Math.round(Math.max(...results))}</div><div class="l">Bedste runde</div></div>
            <div class="fstat"><div class="n">${score}</div><div class="l">Gennemsnit</div></div>
            <div class="fstat"><div class="n">${rank ? '#' + rank : '—'}</div><div class="l">Placering</div></div>
            <div class="fstat"><div class="n">+${xpGain}</div><div class="l">XP optjent</div></div>
          </div>

          <div class="panel" style="width:100%;text-align:left;padding:18px">
            <div class="section-label" style="margin-bottom:12px">Runde for runde</div>
            <div class="round-breakdown">
              ${results
                .map((r, i) => {
                  const pct = Math.max(6, r);
                  return `<div class="rb-row rb-stagger" style="animation-delay:${i * 90}ms"><span class="rb-idx">${i + 1}</span><div class="rb-bar-track"><div class="rb-bar-fill" style="width:${pct}%"></div></div><span class="rb-val">${Math.round(r)}%</span></div>`;
                })
                .join('')}
            </div>
          </div>

          <div class="final-ctas">
            <button class="btn btn-primary btn-lg" id="playAgainBtn">SPIL IGEN</button>
            <button class="btn btn-ghost btn-lg" data-nav="leaderboard-color">LEADERBOARD</button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.getElementById('playAgainBtn')!.addEventListener('click', () => {
    Sound.click();
    renderColorGame();
  });
}
