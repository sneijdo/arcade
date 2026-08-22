import { profile, getCombinedLeaderboard, escapeHtml } from './state';
import { GAMES } from './games/registry';
import { ScoreKinds, formatScore } from './scoring';
import { Sound } from './sound';

/**
 * Shared "utility bar" every game inserts right after its own .game-topbar (see game.css) — a
 * live record display on the left and a restart button on the right. One shared component
 * instead of 18 bespoke ones so every game gets both at once and future tweaks land in one place.
 * Built once per session (same lifecycle as .game-topbar itself — most games only redraw their
 * arena, not the whole shell, between rounds), wired via wireGameChrome() right after.
 */
export function gameUtilBarHtml(): string {
  return `
    <div class="game-util-bar">
      <span class="game-record" id="gameRecordDisplay">🏆 …</span>
      <button class="game-restart-btn" id="gameRestartBtn" type="button">↺ FORFRA</button>
    </div>
  `;
}

/** Fetches the live all-time #1 for gameId and fills in the record display. Fire-and-forget —
 * called right after the shell is drawn so the record appears a beat later instead of blocking
 * the game from being playable while the leaderboard read is in flight. */
async function fillLiveRecord(gameId: string): Promise<void> {
  const el = document.getElementById('gameRecordDisplay');
  if (!el) return;
  const game = GAMES.find((g) => g.id === gameId);
  const kind = game?.scoreKind ? ScoreKinds[game.scoreKind] : null;
  const board = await getCombinedLeaderboard(gameId, 'alltime');
  // The player may have navigated away (or restarted, redrawing the shell) while this was in
  // flight — re-check rather than trusting the reference captured above.
  const stillThere = document.getElementById('gameRecordDisplay');
  if (!stillThere) return;
  const leader = board[0];
  if (!leader) {
    stillThere.textContent = '🏆 Ingen rekord endnu, vær den første';
    return;
  }
  const scoreText = kind ? formatScore(kind, leader.score) : `${Math.round(leader.score)}`;
  const isMe = profile?.id === leader.id;
  stillThere.innerHTML = `🏆 ${scoreText}<span class="game-record-holder"> · ${isMe ? 'dig' : escapeHtml(leader.name)}</span>`;
}

/** Call once, right after building the shell (not on every arena redraw) — wires the restart
 * button to `onRestart` (almost always the game's own render<Name>Game() entry point, so
 * restarting mid-session is identical to how the "SPIL IGEN" result-screen button already works)
 * and kicks off the live record fetch. */
export function wireGameChrome(gameId: string, onRestart: () => void): void {
  document.getElementById('gameRestartBtn')?.addEventListener('click', () => {
    Sound.click();
    onRestart();
  });
  void fillLiveRecord(gameId);
}
