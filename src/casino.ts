import { profile, saveProfile } from './state';
import { refreshHeader } from './header';

/**
 * Quiz Duel gambles skill; this gambles luck — a purely-for-fun XP sink/faucet the
 * player's friends asked for. Every game here risks `profile.xpBalance` (the
 * spendable shop currency) and NEVER `profile.xp` (the lifetime total that drives
 * level) — so a bad night at the tables can't cost you your level or rank, only
 * your wallet, exactly like a shop purchase already does.
 *
 * Every game is tuned to a ~90-95% long-run payback (5-10% house edge, see each
 * game's comment for the math) — never break-even or positive, since a positive-EV
 * game would make gambling strictly better than actually playing the skill games,
 * which would undermine the entire rest of the app.
 */

export const MIN_BET = 10;

function canAfford(wager: number): boolean {
  return !!profile && Number.isInteger(wager) && wager >= MIN_BET && wager <= profile.xpBalance;
}

/** The one place any casino game touches xpBalance — multiplier is the TOTAL payout
 * multiplier on the wager (0 = lose it all, 1 = push/wager back, >1 = win), so the
 * net change is wager * (multiplier - 1). Floored at 0 purely as a defensive
 * invariant (no game here can actually produce a payout below 0). */
async function settle(wager: number, multiplier: number): Promise<number> {
  if (!profile) return 0;
  const payout = Math.round(wager * multiplier);
  const delta = payout - wager;
  profile.xpBalance = Math.max(0, profile.xpBalance + delta);
  await saveProfile();
  refreshHeader();
  return delta;
}

// ---------------------------------------------------------------- Coin Flip
// 50/50 real coin, win pays 1.9x (i.e. +0.9x profit) instead of a fair 2x.
// EV = 0.5 * 1.9 = 0.95 -> 95% payback, 5% house edge.
export type CoinSide = 'krone' | 'plat';
export interface CoinFlipResult {
  won: boolean;
  landedOn: CoinSide;
  delta: number;
}
export async function playCoinFlip(pick: CoinSide, wager: number): Promise<CoinFlipResult | null> {
  if (!canAfford(wager)) return null;
  const landedOn: CoinSide = Math.random() < 0.5 ? 'krone' : 'plat';
  const won = landedOn === pick;
  const delta = await settle(wager, won ? 1.9 : 0);
  return { won, landedOn, delta };
}

// ------------------------------------------------------------------- Slots
// 3 independent reels. Any two matching symbols = push (wager back); all three
// matching = win at that symbol's payout; no match at all = total loss.
// Verified EV ≈ 0.912 (91.2% payback) by brute-force enumeration over all 125
// reel combinations, weighted — see the design notes this shipped with.
export interface SlotSymbol {
  id: string;
  icon: string;
  weight: number;
  payout: number;
}
export const SLOT_SYMBOLS: SlotSymbol[] = [
  { id: 'cherry', icon: '🍒', weight: 35, payout: 3 },
  { id: 'lemon', icon: '🍋', weight: 28, payout: 5 },
  { id: 'orange', icon: '🍊', weight: 20, payout: 10 },
  { id: 'bell', icon: '🔔', weight: 12, payout: 20 },
  { id: 'diamond', icon: '💎', weight: 5, payout: 80 },
];
const SLOT_TOTAL_WEIGHT = SLOT_SYMBOLS.reduce((a, s) => a + s.weight, 0);

function spinReel(): SlotSymbol {
  let r = Math.random() * SLOT_TOTAL_WEIGHT;
  for (const s of SLOT_SYMBOLS) {
    if (r < s.weight) return s;
    r -= s.weight;
  }
  return SLOT_SYMBOLS[0];
}

export interface SlotResult {
  reels: [SlotSymbol, SlotSymbol, SlotSymbol];
  multiplier: number;
  delta: number;
}
export async function playSlots(wager: number): Promise<SlotResult | null> {
  if (!canAfford(wager)) return null;
  const reels: [SlotSymbol, SlotSymbol, SlotSymbol] = [spinReel(), spinReel(), spinReel()];
  const [a, b, c] = reels;
  let multiplier = 0;
  if (a.id === b.id && b.id === c.id) multiplier = a.payout;
  else if (a.id === b.id || b.id === c.id || a.id === c.id) multiplier = 1;
  const delta = await settle(wager, multiplier);
  return { reels, multiplier, delta };
}

// -------------------------------------------------------------------- Dice
// Two six-sided dice, sum 2-12. Three symmetric bets, each independently tuned to
// the same ~91.7% payback: Lower (sum 2-6, p=15/36, pays 2.2x), Higher (sum 8-12,
// same), Exactly 7 (p=6/36, pays 5.5x). 15/36*2.2 = 6/36*5.5 = 11/12 ≈ 0.9167.
export type DiceBet = 'lower' | 'higher' | 'seven';
export interface DiceResult {
  d1: number;
  d2: number;
  sum: number;
  won: boolean;
  delta: number;
}
export async function playDice(bet: DiceBet, wager: number): Promise<DiceResult | null> {
  if (!canAfford(wager)) return null;
  const d1 = 1 + Math.floor(Math.random() * 6);
  const d2 = 1 + Math.floor(Math.random() * 6);
  const sum = d1 + d2;
  let multiplier = 0;
  let won = false;
  if (bet === 'lower' && sum <= 6) {
    won = true;
    multiplier = 2.2;
  } else if (bet === 'higher' && sum >= 8) {
    won = true;
    multiplier = 2.2;
  } else if (bet === 'seven' && sum === 7) {
    won = true;
    multiplier = 5.5;
  }
  const delta = await settle(wager, multiplier);
  return { d1, d2, sum, won, delta };
}

// ------------------------------------------------------------------- Wheel
// A weighted wheel, most segments a loss or partial refund, escalating to a rare
// 10x. EV ≈ 0.945 (94.5% payback, ~5.5% house edge) — see design notes.
export interface WheelSegment {
  multiplier: number;
  weight: number;
  label: string;
}
export const WHEEL_SEGMENTS: WheelSegment[] = [
  { multiplier: 0, weight: 26, label: '0×' },
  { multiplier: 0.5, weight: 25, label: '0.5×' },
  { multiplier: 1, weight: 22, label: '1×' },
  { multiplier: 1.5, weight: 13, label: '1.5×' },
  { multiplier: 2, weight: 8, label: '2×' },
  { multiplier: 3, weight: 4, label: '3×' },
  { multiplier: 5, weight: 1.5, label: '5×' },
  { multiplier: 10, weight: 0.5, label: '10×' },
];
export const WHEEL_TOTAL_WEIGHT = WHEEL_SEGMENTS.reduce((a, s) => a + s.weight, 0);

export interface WheelResult {
  segmentIndex: number;
  multiplier: number;
  delta: number;
}
export async function playWheel(wager: number): Promise<WheelResult | null> {
  if (!canAfford(wager)) return null;
  let r = Math.random() * WHEEL_TOTAL_WEIGHT;
  let segmentIndex = WHEEL_SEGMENTS.length - 1;
  for (let i = 0; i < WHEEL_SEGMENTS.length; i++) {
    if (r < WHEEL_SEGMENTS[i].weight) {
      segmentIndex = i;
      break;
    }
    r -= WHEEL_SEGMENTS[i].weight;
  }
  const multiplier = WHEEL_SEGMENTS[segmentIndex].multiplier;
  const delta = await settle(wager, multiplier);
  return { segmentIndex, multiplier, delta };
}
