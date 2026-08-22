import { ScoreKinds } from '../../scoring';
import { Sound } from '../../sound';
import { Haptics } from '../../haptics';
import { finishGameSession } from '../../state';
import { gameUtilBarHtml, wireGameChrome } from '../../gameChrome';

const SESSION_MS = 40_000;

/** Common Danish words, roughly grouped short→long — makeWord() biases toward the back of this
 * list as the session progresses, so typing gets a little harder over time without a hard cutoff. */
const WORDS = [
  'hus',
  'bil',
  'kat',
  'hund',
  'sol',
  'mor',
  'far',
  'bog',
  'glas',
  'is',
  'ost',
  'mel',
  'sne',
  'sky',
  'træ',
  'blad',
  'gulv',
  'dør',
  'stol',
  'bord',
  'seng',
  'pude',
  'lampe',
  'spejl',
  'kande',
  'kop',
  'kniv',
  'ske',
  'flaske',
  'æble',
  'banan',
  'drue',
  'kage',
  'brød',
  'smør',
  'mælk',
  'kaffe',
  'vand',
  'saft',
  'sukker',
  'salt',
  'peber',
  'løg',
  'kartoffel',
  'gulerod',
  'tomat',
  'agurk',
  'salat',
  'kylling',
  'fisk',
  'suppe',
  'ferie',
  'sommer',
  'vinter',
  'forår',
  'morgen',
  'aften',
  'nat',
  'dag',
  'time',
  'minut',
  'uge',
  'måned',
  'familie',
  'søster',
  'bror',
  'barn',
  'skole',
  'lærer',
  'elev',
  'blyant',
  'papir',
  'skærm',
  'musik',
  'sang',
  'dans',
  'film',
  'museum',
  'strand',
  'skov',
  'bjerg',
  'flod',
  'himmel',
  'stjerne',
  'måne',
  'vind',
  'storm',
  'torden',
  'regnbue',
  'blomst',
  'græs',
  'have',
  'fugl',
  'sommerfugl',
  'edderkop',
  'hest',
  'gris',
  'kanin',
  'ræv',
  'ulv',
  'bjørn',
  'løve',
  'elefant',
  'giraf',
  'slange',
  'skildpadde',
  'delfin',
  'hval',
  'arbejde',
  'penge',
  'butik',
  'marked',
  'station',
  'lufthavn',
  'motorcykel',
  'bygning',
  'lejlighed',
  'kirke',
  'slot',
  'tårn',
  'trappe',
  'elevator',
  'kælder',
  'altan',
  'køkken',
  'kontor',
  'sygehus',
  'apotek',
  'mekaniker',
  'gartner',
  'fisker',
];

type Phase = 'idle' | 'playing' | 'result';

interface WordRushState {
  phase: Phase;
  score: number;
  totalChars: number;
  endAt: number;
  tickId: ReturnType<typeof setInterval> | null;
  currentWord: string;
  recentWords: string[];
}

let state: WordRushState = makeInitialState();

function makeInitialState(): WordRushState {
  return { phase: 'idle', score: 0, totalChars: 0, endAt: 0, tickId: null, currentWord: '', recentWords: [] };
}

function main(): HTMLElement {
  return document.getElementById('main')!;
}

export function renderWordRushGame(): void {
  if (state.tickId) clearInterval(state.tickId);
  state = makeInitialState();
  drawShell();
  wireGameChrome('wordrush', renderWordRushGame);
}

function progressFrac(): number {
  return Math.min(1, Math.max(0, 1 - (state.endAt - performance.now()) / SESSION_MS));
}

/** Biases toward longer words later in the session (see WORDS' short→long ordering), while
 * avoiding the last few repeats so the same word can't show up back-to-back. */
function pickWord(): string {
  const maxIdx = Math.max(6, Math.round(WORDS.length * Math.min(1, 0.35 + progressFrac() * 0.75)));
  let word = WORDS[Math.floor(Math.random() * maxIdx)];
  let guard = 0;
  while (state.recentWords.includes(word) && guard++ < 8) {
    word = WORDS[Math.floor(Math.random() * maxIdx)];
  }
  state.recentWords.push(word);
  if (state.recentWords.length > 5) state.recentWords.shift();
  return word;
}

function drawShell(): void {
  main().innerHTML = `
    <div class="page">
      <div class="game-shell">
        <div class="game-topbar">
          <span id="wrTimer">WORD RUSH · 40s</span>
          <span id="wrScore" class="mono">0 ORD</span>
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
        <div class="arena-title">Klar til at skrive?</div>
        <ul class="instructions-list">
          <li>Skriv ordet på skærmen så hurtigt du kan</li>
          <li>Ordet skifter automatisk når du rammer det rigtigt</li>
          <li>Fejl koster intet, du går bare videre</li>
        </ul>
        <button class="btn btn-primary btn-lg" id="wordrushStartBtn">START</button>
      </div>
    `;
    document.getElementById('wordrushStartBtn')!.addEventListener('click', (e) => {
      e.stopPropagation();
      startSession();
    });
  } else if (state.phase === 'playing') {
    a.innerHTML = `
      <div class="arena-inner wr-wrap">
        <div class="wr-word mono" id="wrWord"></div>
        <input
          class="wr-input"
          id="wrInput"
          type="text"
          autocomplete="off"
          autocapitalize="off"
          autocorrect="off"
          spellcheck="false"
          inputmode="text"
        />
      </div>
    `;
    const input = document.getElementById('wrInput') as HTMLInputElement;
    input.addEventListener('input', handleInput);
    nextWord();
    // Focusing here (inside a click-handler-triggered call chain — see the START
    // button above) is still within the user-gesture window most mobile browsers
    // require to raise the on-screen keyboard.
    input.focus();
  }
}

function nextWord(): void {
  state.currentWord = pickWord();
  const input = document.getElementById('wrInput') as HTMLInputElement | null;
  if (input) {
    input.value = '';
    input.maxLength = state.currentWord.length + 2; // a couple of chars of slack for a trailing typo
  }
  renderWordDisplay('');
}

function renderWordDisplay(typed: string): void {
  const el = document.getElementById('wrWord');
  if (!el) return;
  const target = state.currentWord;
  const typedLower = typed.toLowerCase();
  const chars = target
    .split('')
    .map((ch, i) => {
      const got = typedLower[i];
      if (got == null) return `<span class="wr-char">${ch}</span>`;
      if (got === ch.toLowerCase()) return `<span class="wr-char correct">${ch}</span>`;
      return `<span class="wr-char wrong">${ch}</span>`;
    })
    .join('');
  el.innerHTML = chars;
}

function handleInput(e: Event): void {
  if (state.phase !== 'playing') return;
  const input = e.target as HTMLInputElement;
  const typed = input.value;
  renderWordDisplay(typed);

  if (typed.trim().toLowerCase() === state.currentWord.toLowerCase()) {
    state.score++;
    state.totalChars += state.currentWord.length;
    updateScoreLabel();
    Sound.hit();
    Haptics.hit();
    const wordEl = document.getElementById('wrWord');
    if (wordEl) {
      wordEl.classList.remove('wr-pop');
      void (wordEl as HTMLElement).offsetWidth;
      wordEl.classList.add('wr-pop');
    }
    nextWord();
  }
}

function startSession(): void {
  state.phase = 'playing';
  state.score = 0;
  state.totalChars = 0;
  state.recentWords = [];
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
      endSession();
      return;
    }
    updateTimerLabel(remainingMs);
  }, 200);
}

function updateTimerLabel(remainingMsInput?: number): void {
  const el = document.getElementById('wrTimer');
  if (!el) return;
  const remainingMs = remainingMsInput ?? state.endAt - performance.now();
  const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
  el.textContent = `WORD RUSH · ${seconds}s`;
}

function updateScoreLabel(): void {
  const el = document.getElementById('wrScore');
  if (el) el.textContent = `${state.score} ORD`;
}

function endSession(): void {
  if (state.tickId) clearInterval(state.tickId);
  state.tickId = null;
  state.phase = 'result';
  void finishSession();
}

async function finishSession(): Promise<void> {
  const score = state.score;
  const { isNewBest, xpGain, rank } = await finishGameSession('wordrush', score);

  Sound.complete();
  if (isNewBest) {
    setTimeout(() => Sound.pb(), 250);
    Haptics.personalBest();
  }

  drawFinalScreen(score, isNewBest, xpGain, rank);
}

function drawFinalScreen(score: number, isNewBest: boolean, xpGain: number, rank: number | null): void {
  const rating = ScoreKinds.wordrush_score.rating(score);
  const charsPerMin = Math.round((state.totalChars / SESSION_MS) * 60000);
  main().innerHTML = `
    <div class="page">
      <div class="game-shell">
        <div class="final-wrap">
          <div class="final-label">Din score</div>
          <div class="final-score">${score}<span style="font-size:26px">ord</span></div>
          <div class="final-rating" style="color:${rating.color}">${rating.label}</div>
          ${isNewBest ? '<div class="pb-flag">★ NY PERSONLIG REKORD</div>' : ''}
          <div class="xp-toast">✦ +${xpGain} XP optjent${rank && rank <= 3 ? ' · TOP 3-BONUS' : ''}</div>

          <div class="final-stats">
            <div class="fstat"><div class="n">${score}</div><div class="l">Ord</div></div>
            <div class="fstat"><div class="n">${charsPerMin}</div><div class="l">Tegn/min</div></div>
            <div class="fstat"><div class="n">${rank ? '#' + rank : '—'}</div><div class="l">Placering</div></div>
            <div class="fstat"><div class="n">+${xpGain}</div><div class="l">XP optjent</div></div>
          </div>

          <div class="final-ctas">
            <button class="btn btn-primary btn-lg" id="playAgainBtn">SPIL IGEN</button>
            <button class="btn btn-ghost btn-lg" data-nav="leaderboard-wordrush">LEADERBOARD</button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.getElementById('playAgainBtn')!.addEventListener('click', () => {
    Sound.click();
    renderWordRushGame();
  });
}
