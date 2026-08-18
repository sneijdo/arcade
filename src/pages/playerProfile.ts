import { profile, getPlayerMeta, getCombinedLeaderboard, avatarFrameHtml, escapeHtml, duelTierForRating, DUEL_RATING_DEFAULT } from '../state';
import { levelInfo } from '../xp';
import { ACHIEVEMENTS } from '../achievements';
import { BADGES } from '../badges';
import { GAMES } from '../games/registry';
import { ScoreKinds, formatScore } from '../scoring';
import { findTitle } from '../shop';

/** Read-only view of another player's public progress — reached by clicking a name on the
 * Leaderboard or Activity page. Pulls entirely from PlayerMeta (see saveProfile in state.ts),
 * the same shared/public record those pages already use for name+avatar, so no new data access
 * pattern or privacy surface is introduced — just more fields riding along on it. */
export async function renderPlayerProfile(id: string): Promise<void> {
  const main = document.getElementById('main')!;
  main.innerHTML = `<div class="page"><div style="color:var(--text-faint);font-family:var(--font-mono);font-size:13px">Indlæser…</div></div>`;

  const meta = await getPlayerMeta(id);
  const board = await getCombinedLeaderboard('reaction');

  // The viewer may have navigated away while these fetches were in flight.
  const container = document.getElementById('main');
  if (!container) return;

  if (!meta) {
    container.innerHTML = `
      <div class="page">
        <a href="#/leaderboard" data-nav="leaderboard" class="btn btn-ghost" style="margin-bottom:16px">← TILBAGE</a>
        <div class="section-label">Spiller</div>
        <h1 class="section-title">Ikke fundet</h1>
        <div style="color:var(--text-dim);font-size:13.5px">Denne spiller findes ikke, eller har endnu ikke spillet en runde.</div>
      </div>
    `;
    return;
  }

  const li = levelInfo(meta.xp ?? 0);
  const implementedGames = GAMES.filter((g) => g.implemented);
  const rankIdx = board.findIndex((e) => e.id === id);
  const rank = rankIdx >= 0 ? rankIdx + 1 : null;
  const title = findTitle(meta.title);
  const unlockedAchievements = meta.unlockedAchievements ?? [];
  const unlockedBadges = meta.unlockedBadges ?? [];
  const bestScores = meta.bestScores ?? {};

  const bestForGame = (gameId: string): number | null => (gameId === 'reaction' ? (meta.bestAvg ?? null) : (bestScores[gameId] ?? null));

  container.innerHTML = `
    <div class="page">
      <a href="#/leaderboard" data-nav="leaderboard" class="btn btn-ghost" style="margin-bottom:16px">← TILBAGE TIL LEADERBOARD</a>
      <div class="panel">
        <div class="profile-head">
          ${avatarFrameHtml(meta.name, meta.avatar, meta.frame, 74)}
          <div class="profile-head-info">
            <h1 class="profile-name">${escapeHtml(meta.name)}${title ? ` <img src="${title.asset}" alt="${title.label}" class="title-badge-img profile-title-badge">` : ''}</h1>
            <div class="xp-bar-track"><div class="xp-bar-fill" style="width:${li.pct}%"></div></div>
            <div class="xp-bar-label">LEVEL ${li.level}${rank ? ` · PLACERING #${rank} GLOBALT (REACTION)` : ''}</div>
          </div>
        </div>
      </div>

      <h2 class="section-title" style="margin-top:32px">Personlige rekorder</h2>
      <div class="pb-grid">
        ${implementedGames
          .map((g) => {
            const best = bestForGame(g.id);
            const kind = g.scoreKind ? ScoreKinds[g.scoreKind] : null;
            const val = best != null && kind ? formatScore(kind, best) : '—';
            return `<div class="pb-card"><div class="g">${g.title}</div><div class="v">${val}</div></div>`;
          })
          .join('')}
        <div class="pb-card"><div class="g">Runder spillet</div><div class="v">${meta.sessionsPlayed ?? 0}</div></div>
        <div class="pb-card"><div class="g">Nuværende stime</div><div class="v">🔥 ${meta.currentStreak ?? 0}</div></div>
        <div class="pb-card"><div class="g">Længste stime</div><div class="v">${meta.longestStreak ?? 0}</div></div>
        <div class="pb-card"><div class="g">🧠 Quiz Duel</div><div class="v">${meta.duelWins ?? 0}-${meta.duelLosses ?? 0}-${meta.duelDraws ?? 0}</div></div>
        <div class="pb-card"><div class="g">Duel-rang</div><div class="v">${duelTierForRating(meta.duelRating ?? DUEL_RATING_DEFAULT).icon} ${meta.duelRating ?? DUEL_RATING_DEFAULT}</div></div>
      </div>

      <h2 class="section-title" style="margin-top:32px">Bedrifter</h2>
      <div class="ach-grid">
        ${ACHIEVEMENTS.map((a) => {
          const unlocked = unlockedAchievements.includes(a.id);
          return `<div class="ach-card ${unlocked ? '' : 'locked'}">
            <div class="ach-icon">${a.icon}</div>
            <div><div class="ach-title">${a.title}</div><div class="ach-desc">${a.desc}</div></div>
          </div>`;
        }).join('')}
      </div>

      <h2 class="section-title" style="margin-top:32px">Badges (${unlockedBadges.length} / ${BADGES.length})</h2>
      <div class="badge-grid">
        ${BADGES.map((b) => {
          const unlocked = unlockedBadges.includes(b.id);
          return `<div class="badge-card rarity-${b.rarity} ${unlocked ? '' : 'locked'}">
            <img src="${b.asset}" alt="${b.name}" class="badge-icon">
            <div class="badge-name">${unlocked ? b.name : '???'}</div>
            <div class="badge-desc">${b.desc}</div>
          </div>`;
        }).join('')}
      </div>
    </div>
  `;
}

/** Where a leaderboard/activity row's avatar+name should link — your own row goes to the
 * full editable profile, everyone else's goes to the read-only view above. */
export function playerLinkTarget(id: string): string {
  return profile?.id === id ? 'profile' : `player-${id}`;
}
