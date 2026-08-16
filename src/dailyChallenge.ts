import { GAMES } from './games/registry';
import { ScoreKinds } from './scoring';

/**
 * Score target per game for "today's challenge" — deliberately reuses each
 * ScoreKind's own "GODT" (good) tier threshold as a real but achievable bar,
 * rather than inventing separate numbers to keep in sync. Only games with
 * an entry here are eligible to be picked as the daily challenge.
 */
const DAILY_TARGETS: Record<string, number> = {
  reaction: 250,
  aim: 12,
  memory: 6,
  numberrush: 12,
  snake: 8,
  tactical: 3,
  stack: 12,
  color: 70,
  dash: 100,
  merge: 256,
  overclock: 1200,
  glitchgrid: 35,
  pulse: 5000,
  dropzone: 800,
  ruleswitch: 12,
  wordrush: 11,
  swerve: 18000,
  pairs: 110,
  oddoneout: 7,
};

/** Halved along with every other XP source in the app (was 60). */
const XP_REWARD = 30;

function dateSeed(dateStr: string): number {
  let h = 0;
  for (let i = 0; i < dateStr.length; i++) h = (h * 31 + dateStr.charCodeAt(i)) >>> 0;
  return h;
}

export interface DailyChallenge {
  gameId: string;
  gameTitle: string;
  target: number;
  xpReward: number;
}

/** Same challenge for every player on a given calendar day — a deterministic pick, not stored anywhere. Takes today's date string as a param (see state.ts's todayLocalDateString()) rather than importing state.ts, to avoid a circular dependency with the module that calls this. */
export function getTodayChallenge(todayStr: string): DailyChallenge | null {
  const eligible = GAMES.filter((g) => g.implemented && DAILY_TARGETS[g.id] != null);
  if (eligible.length === 0) return null;
  const idx = dateSeed(todayStr) % eligible.length;
  const game = eligible[idx];
  return { gameId: game.id, gameTitle: game.title, target: DAILY_TARGETS[game.id], xpReward: XP_REWARD };
}

/** Direction-aware "did this score meet the target" check, using the same ScoreKind every game's own rating already relies on. */
export function meetsChallengeTarget(challenge: DailyChallenge, score: number): boolean {
  const game = GAMES.find((g) => g.id === challenge.gameId);
  const kind = game?.scoreKind ? ScoreKinds[game.scoreKind] : null;
  if (!kind) return false;
  return kind.direction === 'asc' ? score <= challenge.target : score >= challenge.target;
}
