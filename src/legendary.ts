import { getWeeklyLeadStandings, getLastWeekLegendaryWinners, LEGENDARY_WEEK_THRESHOLD, weekKey, avatarFrameHtml, escapeHtml } from './state';
import { mountModal } from './onboarding';
import type { WeeklyLeadStanding } from './state';

/** Everything about the weekly legendary race that's presentation, not data —
 * the actual standings/winners are read straight off already-public leaderboard
 * data in state.ts (getWeeklyLeadStandings / getLastWeekLegendaryWinners); this
 * module just turns that into a countdown, a race widget, and a one-time
 * "who won" reveal. */

/** Next Sunday 00:00 local time — the weekly leaderboard reset boundary (see
 * weekKey() in state.ts). Always 1-7 days out, never 0, even at the instant a
 * new week just started. */
export function msUntilNextWeekReset(): number {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysUntilSunday = (7 - next.getDay()) % 7;
  next.setDate(next.getDate() + (daysUntilSunday === 0 ? 7 : daysUntilSunday));
  return next.getTime() - now.getTime();
}

export function formatCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  if (days > 0) return `${days}d ${String(hours).padStart(2, '0')}t ${String(minutes).padStart(2, '0')}m`;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/** Ticks `el`'s text every second. Returns a stop function — callers don't strictly
 * need to call it (a detached element's interval is harmless, just wasted ticks),
 * but pages that get re-rendered a lot should still stop their old ticker. */
export function startCountdownTicker(el: HTMLElement): () => void {
  const tick = () => {
    el.textContent = formatCountdown(msUntilNextWeekReset());
  };
  tick();
  const id = setInterval(tick, 1000);
  return () => clearInterval(id);
}

/** The live "who's closest to legendary right now" card — same underlying data as
 * the Leaderboard page's "MOD LEGENDARY" tab, condensed to top 3 for a widget. Caller
 * must call startCountdownTicker() on #legendaryCountdown after mounting this HTML. */
export async function renderLegendaryRaceWidget(): Promise<string> {
  const standings = await getWeeklyLeadStandings();
  const top = standings.slice(0, 3);
  const initialCountdown = formatCountdown(msUntilNextWeekReset());
  return `
    <div class="legendary-card">
      <div class="legendary-card-top">
        <div class="legendary-card-label">👑 KAMPEN OM LEGENDARY</div>
        <div class="legendary-countdown mono" id="legendaryCountdown">${initialCountdown}</div>
      </div>
      <div class="legendary-card-sub">Til ugens nulstilling. Vær #1 i ${LEGENDARY_WEEK_THRESHOLD}+ spil for at vinde et legendary-slot.</div>
      ${
        top.length
          ? `<div class="legendary-contenders">
              ${top
                .map(
                  (s, i) => `
                <div class="legendary-contender">
                  <span class="legendary-contender-rank">${i + 1}</span>
                  ${avatarFrameHtml(s.name, s.avatar, s.frame, 26)}
                  <span class="legendary-contender-name">${escapeHtml(s.name)}</span>
                  <span class="legendary-contender-count">${s.gameIds.length}/${LEGENDARY_WEEK_THRESHOLD}</span>
                </div>
              `,
                )
                .join('')}
            </div>`
          : `<div class="legendary-empty">Ingen har taget føringen endnu denne uge, bliv den første.</div>`
      }
      <a class="btn btn-ghost btn-block" href="#/leaderboard" data-nav="leaderboard">SE HELE KAPLØBET</a>
    </div>
  `;
}

const REVEAL_SEEN_PREFIX = 'arcade:legendaryRevealSeen:';

function hasSeenReveal(week: string): boolean {
  try {
    return localStorage.getItem(REVEAL_SEEN_PREFIX + week) === '1';
  } catch {
    return false;
  }
}
function markRevealSeen(week: string): void {
  try {
    localStorage.setItem(REVEAL_SEEN_PREFIX + week, '1');
  } catch {
    // best-effort — worst case the reveal shows again next visit, harmless
  }
}

/** Shows a big celebratory reveal of *last* week's legendary winner(s), once per
 * device per week (a local "have I seen this week's reveal" flag — deliberately
 * not a synced profile field, since missing/repeating this once in a blue moon on
 * a second device is a low-stakes cosmetic gap, not worth a schema change for).
 * Call from the Activity page on mount. No-ops quietly if nothing to show. */
export async function maybeShowLegendaryReveal(): Promise<void> {
  const currentWeek = weekKey(new Date());
  if (hasSeenReveal(currentWeek)) return;
  const winners = await getLastWeekLegendaryWinners();
  markRevealSeen(currentWeek); // don't re-prompt every visit even when no one won
  if (winners.length === 0) return;
  showRevealModal(winners);
}

function showRevealModal(winners: WeeklyLeadStanding[]): void {
  const backdrop = mountModal(`
    <div class="modal legendary-reveal-modal">
      <div class="legendary-reveal-confetti">🎉 ✨ 🏆 ✨ 🎉</div>
      <h2>LEGENDARY-VINDER${winners.length > 1 ? 'E' : ''} KÅRET</h2>
      <p>Sidste uge var ${winners.length > 1 ? 'disse spillere' : 'denne spiller'} suverænt bedst: #1 i mindst ${LEGENDARY_WEEK_THRESHOLD} forskellige spil.</p>
      <div class="legendary-reveal-winners">
        ${winners
          .map(
            (w) => `
          <div class="legendary-reveal-winner">
            ${avatarFrameHtml(w.name, w.avatar, w.frame, 56)}
            <div class="legendary-reveal-name">${escapeHtml(w.name)}</div>
            <div class="legendary-reveal-count">#1 i ${w.gameIds.length} spil</div>
          </div>
        `,
          )
          .join('')}
      </div>
      <button class="btn btn-primary btn-block btn-lg" id="legendaryRevealCloseBtn">DENNE UGE ER DIN CHANCE</button>
    </div>
  `);
  document.getElementById('legendaryRevealCloseBtn')!.addEventListener('click', () => backdrop.remove());
}
