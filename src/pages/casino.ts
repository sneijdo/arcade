import { profile } from '../state';
import { Sound } from '../sound';
import { Haptics } from '../haptics';
import { toast } from '../toast';
import {
  MIN_BET,
  playCoinFlip,
  playSlots,
  playDice,
  playWheel,
  SLOT_SYMBOLS,
  WHEEL_SEGMENTS,
  WHEEL_TOTAL_WEIGHT,
  type CoinSide,
  type DiceBet,
  type SlotSymbol,
  type SlotResult,
} from '../casino';

/**
 * The XP-casino — a purely-for-fun luck sink alongside the skill games (see casino.ts's
 * module doc for the house-edge/xpBalance-only design). Structured the same way as
 * leaderboard.ts: one module-level `view` switch, each game a self-contained
 * render+wire function that fully replaces #main.
 */

type CasinoView = 'menu' | 'coinflip' | 'slots' | 'dice' | 'wheel';
let view: CasinoView = 'menu';
/** Remembered across games within a casino visit — "how much are you playing with"
 * feels like a property of the session, not of any one game. */
let currentBet = 50;
let spinning = false;

const BET_CHIPS = [10, 50, 100, 500];

function main(): HTMLElement {
  return document.getElementById('main')!;
}

export async function renderCasino(): Promise<void> {
  view = 'menu';
  spinning = false;
  render();
}

function render(): void {
  if (!profile) return;
  if (view === 'menu') renderMenu();
  else if (view === 'coinflip') renderCoinFlip();
  else if (view === 'slots') renderSlots();
  else if (view === 'dice') renderDice();
  else if (view === 'wheel') renderWheel();
}

function goTo(v: CasinoView): void {
  view = v;
  spinning = false;
  render();
}

function clampBet(): number {
  if (!profile) return MIN_BET;
  return Math.max(MIN_BET, Math.min(currentBet, profile.xpBalance));
}

function shellOpen(title: string, icon: string): string {
  return `
    <div class="page">
      <div class="game-shell">
        <div class="game-topbar">
          <button class="btn btn-ghost btn-sm" id="casinoBack">← KASINO</button>
          <span class="mono casino-balance-chip">✦ ${profile!.xpBalance} XP</span>
        </div>
        <div class="section-label">🎰 Kasino</div>
        <h1 class="section-title" style="margin-bottom:2px">${icon} ${title}</h1>
  `;
}
const shellClose = `</div></div>`;

function wireBack(): void {
  document.getElementById('casinoBack')?.addEventListener('click', () => {
    Sound.click();
    goTo('menu');
  });
}

/** Shared bet-chip strip — every game screen renders one with the same id contract
 * (#casinoChips / #casinoBetValue), so wireBetChips() can be reused verbatim. */
function betChipsHtml(): string {
  const bet = clampBet();
  return `
    <div class="casino-bet-panel">
      <div class="casino-bet-display">Indsats: <b id="casinoBetValue">${bet}</b> XP</div>
      <div class="casino-chip-row" id="casinoChips">
        ${BET_CHIPS.map((c) => `<button class="casino-chip ${c === bet ? 'active' : ''}" data-bet="${c}" ${profile!.xpBalance < c ? 'disabled' : ''}>${c}</button>`).join('')}
        <button class="casino-chip casino-chip-max ${bet === profile!.xpBalance && bet !== BET_CHIPS[BET_CHIPS.length - 1] ? 'active' : ''}" data-bet="max" ${profile!.xpBalance < MIN_BET ? 'disabled' : ''}>ALT IND</button>
      </div>
    </div>
  `;
}

function wireBetChips(): void {
  document.querySelectorAll<HTMLButtonElement>('#casinoChips [data-bet]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (spinning) return;
      Sound.click();
      currentBet = btn.dataset.bet === 'max' ? profile!.xpBalance : Number(btn.dataset.bet);
      currentBet = clampBet();
      const valueEl = document.getElementById('casinoBetValue');
      if (valueEl) valueEl.textContent = String(currentBet);
      document.querySelectorAll<HTMLButtonElement>('#casinoChips [data-bet]').forEach((b) => b.classList.toggle('active', b === btn));
    });
  });
}

function updateBalanceChip(): void {
  const el = document.querySelector<HTMLElement>('.casino-balance-chip');
  if (el && profile) el.textContent = `✦ ${profile.xpBalance} XP`;
}

function resultHtml(delta: number, label: string): string {
  const cls = delta > 0 ? 'win' : delta < 0 ? 'lose' : 'push';
  const sign = delta > 0 ? '+' : '';
  return `<div class="casino-result ${cls}">${label}<span class="casino-result-delta">${sign}${delta} XP</span></div>`;
}

function playFeedback(delta: number): void {
  if (delta > 0) {
    Sound.bank();
    Haptics.personalBest();
  } else if (delta < 0) {
    Sound.overload();
    Haptics.miss();
  } else {
    Sound.click();
  }
}

// ------------------------------------------------------------------- Menu
function renderMenu(): void {
  main().innerHTML = `
    <div class="page">
      <a href="#/profile" data-nav="profile" class="btn btn-ghost" style="margin-bottom:16px">← TILBAGE TIL PROFIL</a>
      <div class="section-label">🎰 Kasino</div>
      <h1 class="section-title">Prøv lykken</h1>
      <div class="casino-intro">Gambl din XP-saldo (aldrig dit level) i fire spil. Huset vinder i det lange løb — det er stadig gambling — men en enkelt tur kan gøre godt.</div>
      <div class="shop-balance casino-teaser" style="margin:16px 0">
        <div>
          <div class="shop-balance-label">DIN SALDO</div>
          <div class="shop-balance-value">✦ ${profile!.xpBalance} XP</div>
        </div>
      </div>
      <div class="casino-menu-grid">
        <button class="casino-menu-card" data-game="coinflip"><span class="casino-menu-icon">🪙</span><span class="casino-menu-title">Coin Flip</span><span class="casino-menu-sub">Krone/plat · 1.9×</span></button>
        <button class="casino-menu-card" data-game="slots"><span class="casino-menu-icon">🎰</span><span class="casino-menu-title">Slots</span><span class="casino-menu-sub">3 ens = op til 80×</span></button>
        <button class="casino-menu-card" data-game="dice"><span class="casino-menu-icon">🎲</span><span class="casino-menu-title">Terninger</span><span class="casino-menu-sub">Højt/lavt/7 · op til 5.5×</span></button>
        <button class="casino-menu-card" data-game="wheel"><span class="casino-menu-icon">🎡</span><span class="casino-menu-title">Lykkehjul</span><span class="casino-menu-sub">Op til 10×</span></button>
      </div>
    </div>
  `;
  document.querySelectorAll<HTMLButtonElement>('[data-game]').forEach((btn) => {
    btn.addEventListener('click', () => {
      Sound.click();
      goTo(btn.dataset.game as CasinoView);
    });
  });
}

// --------------------------------------------------------------- Coin Flip
let coinPick: CoinSide | null = null;

function renderCoinFlip(): void {
  coinPick = null;
  main().innerHTML =
    shellOpen('Coin Flip', '🪙') +
    `
        <div class="casino-coin-stage"><div class="casino-coin" id="casinoCoin">🪙</div></div>
        <div class="casino-pick-row">
          <button class="casino-pick-btn" data-pick="krone">KRONE</button>
          <button class="casino-pick-btn" data-pick="plat">PLAT</button>
        </div>
        ${betChipsHtml()}
        <div id="casinoResultSlot"></div>
        <button class="btn btn-casino btn-lg btn-block" id="casinoPlayBtn" disabled>VÆLG KRONE ELLER PLAT</button>
  ` + shellClose;
  wireBack();
  wireBetChips();

  document.querySelectorAll<HTMLButtonElement>('[data-pick]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (spinning) return;
      Sound.click();
      coinPick = btn.dataset.pick as CoinSide;
      document.querySelectorAll<HTMLButtonElement>('[data-pick]').forEach((b) => b.classList.toggle('active', b === btn));
      const playBtn = document.getElementById('casinoPlayBtn') as HTMLButtonElement | null;
      if (playBtn) {
        playBtn.disabled = false;
        playBtn.textContent = 'KAST MØNTEN';
      }
    });
  });

  document.getElementById('casinoPlayBtn')?.addEventListener('click', () => void spinCoin());
}

async function spinCoin(): Promise<void> {
  if (spinning || !coinPick || !profile) return;
  const wager = clampBet();
  const result = await playCoinFlip(coinPick, wager);
  if (!result) {
    toast('Ikke nok XP til den indsats');
    return;
  }
  spinning = true;
  const playBtn = document.getElementById('casinoPlayBtn') as HTMLButtonElement | null;
  if (playBtn) playBtn.disabled = true;
  document.querySelectorAll<HTMLButtonElement>('#casinoChips [data-bet]').forEach((b) => (b.disabled = true));
  Sound.click();
  const coin = document.getElementById('casinoCoin');
  coin?.classList.add('flipping');
  setTimeout(() => {
    spinning = false;
    if (coin) {
      coin.classList.remove('flipping');
      coin.textContent = result.landedOn === 'krone' ? '👑' : '🪙';
    }
    updateBalanceChip();
    const slot = document.getElementById('casinoResultSlot');
    if (slot) {
      slot.innerHTML = resultHtml(result.delta, result.won ? `Det blev ${result.landedOn.toUpperCase()} — du vandt!` : `Det blev ${result.landedOn.toUpperCase()} — tabt.`);
    }
    playFeedback(result.delta);
    if (playBtn) {
      playBtn.disabled = false;
      playBtn.textContent = 'KAST IGEN';
    }
    document.querySelectorAll<HTMLButtonElement>('#casinoChips [data-bet]').forEach((b) => (b.disabled = profile!.xpBalance < Number(b.dataset.bet === 'max' ? MIN_BET : b.dataset.bet)));
  }, 900);
}

// ------------------------------------------------------------------- Slots
function randomSlotSymbol(): SlotSymbol {
  return SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)];
}

function renderSlots(): void {
  main().innerHTML =
    shellOpen('Slots', '🎰') +
    `
        <div class="casino-slots-frame">
          <div class="casino-reel" id="reel0">${SLOT_SYMBOLS[0].icon}</div>
          <div class="casino-reel" id="reel1">${SLOT_SYMBOLS[1].icon}</div>
          <div class="casino-reel" id="reel2">${SLOT_SYMBOLS[2].icon}</div>
        </div>
        <div class="casino-paytable">${SLOT_SYMBOLS.map((s) => `<span>${s.icon}×3 = ${s.payout}×</span>`).join('')}<span>2 ens = pengene tilbage</span></div>
        ${betChipsHtml()}
        <div id="casinoResultSlot"></div>
        <button class="btn btn-casino btn-lg btn-block" id="casinoPlayBtn">SPIN</button>
  ` + shellClose;
  wireBack();
  wireBetChips();
  document.getElementById('casinoPlayBtn')?.addEventListener('click', () => void spinSlots());
}

async function spinSlots(): Promise<void> {
  if (spinning || !profile) return;
  const wager = clampBet();
  const result = await playSlots(wager);
  if (!result) {
    toast('Ikke nok XP til den indsats');
    return;
  }
  spinning = true;
  const playBtn = document.getElementById('casinoPlayBtn') as HTMLButtonElement | null;
  if (playBtn) playBtn.disabled = true;
  document.querySelectorAll<HTMLButtonElement>('#casinoChips [data-bet]').forEach((b) => (b.disabled = true));
  Sound.click();

  const reelEls = [document.getElementById('reel0'), document.getElementById('reel1'), document.getElementById('reel2')];
  const durations = [600, 850, 1100];
  let stopped = 0;
  reelEls.forEach((el, i) => {
    if (!el) return;
    el.classList.add('spinning');
    let elapsed = 0;
    const iv = setInterval(() => {
      el.textContent = randomSlotSymbol().icon;
      elapsed += 55;
      if (elapsed >= durations[i]) {
        clearInterval(iv);
        el.textContent = result.reels[i].icon;
        el.classList.remove('spinning');
        el.classList.add('landed');
        stopped++;
        if (stopped === 3) finishSlots(result);
      }
    }, 55);
  });
}

function finishSlots(result: SlotResult): void {
  spinning = false;
  updateBalanceChip();
  const slot = document.getElementById('casinoResultSlot');
  if (slot) {
    const label = result.multiplier > 1 ? `Tre ens! ${result.multiplier}×` : result.multiplier === 1 ? 'To ens — pengene tilbage.' : 'Ingen match — tabt.';
    slot.innerHTML = resultHtml(result.delta, label);
  }
  playFeedback(result.delta);
  const playBtn = document.getElementById('casinoPlayBtn') as HTMLButtonElement | null;
  if (playBtn) playBtn.disabled = false;
  document.querySelectorAll<HTMLButtonElement>('#casinoChips [data-bet]').forEach((b) => (b.disabled = profile!.xpBalance < Number(b.dataset.bet === 'max' ? MIN_BET : b.dataset.bet)));
  setTimeout(() => document.querySelectorAll('.casino-reel').forEach((el) => el.classList.remove('landed')), 700);
}

// -------------------------------------------------------------------- Dice
const DICE_FACES = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
let dicePick: DiceBet | null = null;

function renderDice(): void {
  dicePick = null;
  main().innerHTML =
    shellOpen('Terninger', '🎲') +
    `
        <div class="casino-dice-stage"><div class="casino-die" id="die1">⚀</div><div class="casino-die" id="die2">⚀</div></div>
        <div class="casino-pick-row casino-pick-row-3">
          <button class="casino-pick-btn" data-pick="lower">LAVERE<br><span>2–6 · 2.2×</span></button>
          <button class="casino-pick-btn" data-pick="seven">PRÆCIS 7<br><span>5.5×</span></button>
          <button class="casino-pick-btn" data-pick="higher">HØJERE<br><span>8–12 · 2.2×</span></button>
        </div>
        ${betChipsHtml()}
        <div id="casinoResultSlot"></div>
        <button class="btn btn-casino btn-lg btn-block" id="casinoPlayBtn" disabled>VÆLG ET VÆDDEMÅL</button>
  ` + shellClose;
  wireBack();
  wireBetChips();

  document.querySelectorAll<HTMLButtonElement>('[data-pick]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (spinning) return;
      Sound.click();
      dicePick = btn.dataset.pick as DiceBet;
      document.querySelectorAll<HTMLButtonElement>('[data-pick]').forEach((b) => b.classList.toggle('active', b === btn));
      const playBtn = document.getElementById('casinoPlayBtn') as HTMLButtonElement | null;
      if (playBtn) {
        playBtn.disabled = false;
        playBtn.textContent = 'KAST TERNINGERNE';
      }
    });
  });

  document.getElementById('casinoPlayBtn')?.addEventListener('click', () => void spinDice());
}

async function spinDice(): Promise<void> {
  if (spinning || !dicePick || !profile) return;
  const wager = clampBet();
  const result = await playDice(dicePick, wager);
  if (!result) {
    toast('Ikke nok XP til den indsats');
    return;
  }
  spinning = true;
  const playBtn = document.getElementById('casinoPlayBtn') as HTMLButtonElement | null;
  if (playBtn) playBtn.disabled = true;
  document.querySelectorAll<HTMLButtonElement>('#casinoChips [data-bet]').forEach((b) => (b.disabled = true));
  Sound.click();
  const die1 = document.getElementById('die1');
  const die2 = document.getElementById('die2');
  [die1, die2].forEach((d) => d?.classList.add('rolling'));
  let elapsed = 0;
  const iv = setInterval(() => {
    if (die1) die1.textContent = DICE_FACES[1 + Math.floor(Math.random() * 6)];
    if (die2) die2.textContent = DICE_FACES[1 + Math.floor(Math.random() * 6)];
    elapsed += 60;
    if (elapsed >= 750) {
      clearInterval(iv);
      spinning = false;
      [die1, die2].forEach((d) => d?.classList.remove('rolling'));
      if (die1) die1.textContent = DICE_FACES[result.d1];
      if (die2) die2.textContent = DICE_FACES[result.d2];
      updateBalanceChip();
      const slot = document.getElementById('casinoResultSlot');
      if (slot) slot.innerHTML = resultHtml(result.delta, `Sum ${result.sum} — ${result.won ? 'ramt!' : 'tabt.'}`);
      playFeedback(result.delta);
      if (playBtn) playBtn.disabled = false;
      document.querySelectorAll<HTMLButtonElement>('#casinoChips [data-bet]').forEach((b) => (b.disabled = profile!.xpBalance < Number(b.dataset.bet === 'max' ? MIN_BET : b.dataset.bet)));
    }
  }, 60);
}

// ------------------------------------------------------------------- Wheel
const WHEEL_COLORS = ['#1c1a24', '#2a2733', '#403c50', '#5a4a8f', '#8b6bff', '#c9f73e', '#ffc93c', '#ff5d7a'];
let wheelRotation = 0;

function wheelAngles(): { start: number; end: number }[] {
  let acc = 0;
  return WHEEL_SEGMENTS.map((seg) => {
    const start = (acc / WHEEL_TOTAL_WEIGHT) * 360;
    acc += seg.weight;
    const end = (acc / WHEEL_TOTAL_WEIGHT) * 360;
    return { start, end };
  });
}

function wheelGradient(): string {
  const angles = wheelAngles();
  const stops = angles.map((a, i) => `${WHEEL_COLORS[i % WHEEL_COLORS.length]} ${a.start}deg ${a.end}deg`);
  return `conic-gradient(${stops.join(', ')})`;
}

function renderWheel(): void {
  main().innerHTML =
    shellOpen('Lykkehjul', '🎡') +
    `
        <div class="casino-wheel-stage">
          <div class="casino-wheel-pointer">▼</div>
          <div class="casino-wheel" id="casinoWheel" style="background:${wheelGradient()};transform:rotate(${wheelRotation}deg)"></div>
        </div>
        <div class="casino-wheel-legend">
          ${WHEEL_SEGMENTS.map((s, i) => `<span><i style="background:${WHEEL_COLORS[i % WHEEL_COLORS.length]}"></i>${s.label}</span>`).join('')}
        </div>
        ${betChipsHtml()}
        <div id="casinoResultSlot"></div>
        <button class="btn btn-casino btn-lg btn-block" id="casinoPlayBtn">DREJ HJULET</button>
  ` + shellClose;
  wireBack();
  wireBetChips();
  document.getElementById('casinoPlayBtn')?.addEventListener('click', () => void spinWheel());
}

async function spinWheel(): Promise<void> {
  if (spinning || !profile) return;
  const wager = clampBet();
  const result = await playWheel(wager);
  if (!result) {
    toast('Ikke nok XP til den indsats');
    return;
  }
  spinning = true;
  const playBtn = document.getElementById('casinoPlayBtn') as HTMLButtonElement | null;
  if (playBtn) playBtn.disabled = true;
  document.querySelectorAll<HTMLButtonElement>('#casinoChips [data-bet]').forEach((b) => (b.disabled = true));
  Sound.click();

  const angles = wheelAngles();
  const { start, end } = angles[result.segmentIndex];
  const pointAngle = start + Math.random() * (end - start);
  const targetMod = ((360 - pointAngle) % 360 + 360) % 360;
  const currentMod = ((wheelRotation % 360) + 360) % 360;
  let delta = targetMod - currentMod;
  if (delta <= 0) delta += 360;
  wheelRotation += delta + 5 * 360;

  const wheelEl = document.getElementById('casinoWheel');
  if (wheelEl) wheelEl.style.transform = `rotate(${wheelRotation}deg)`;

  setTimeout(() => {
    spinning = false;
    updateBalanceChip();
    const seg = WHEEL_SEGMENTS[result.segmentIndex];
    const slot = document.getElementById('casinoResultSlot');
    if (slot) slot.innerHTML = resultHtml(result.delta, `Hjulet stoppede på ${seg.label}`);
    playFeedback(result.delta);
    if (playBtn) playBtn.disabled = false;
    document.querySelectorAll<HTMLButtonElement>('#casinoChips [data-bet]').forEach((b) => (b.disabled = profile!.xpBalance < Number(b.dataset.bet === 'max' ? MIN_BET : b.dataset.bet)));
  }, 3300);
}
