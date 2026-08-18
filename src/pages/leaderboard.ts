import { profile, getCombinedLeaderboard, avatarFrameHtml, creditMyHallOfFameWins, getHallOfFame, getDuelLeaderboard, duelTierForRating, getPlayerMeta, getWeeklyLeadStandings, LEGENDARY_WEEK_THRESHOLD, escapeHtml, nameEffectHtml } from '../state';
import { findTitle } from '../shop';
import { playerLinkTarget } from './playerProfile';
import { GAMES } from '../games/registry';
import { ScoreKinds, formatScore, scoreUnitSuffix } from '../scoring';
import { isGuestMode } from '../storage';
import type { LeaderboardEntry, ScoreKind } from '../types';

let lbGameId = 'reaction';
type LbView = 'week' | 'alltime' | 'hof' | 'legendary' | 'duel';
let lbView: LbView = 'week';

export async function renderLeaderboard(gameId?: string): Promise<void> {
  const main = document.getElementById('main')!;
  if (!profile) return;
  const implementedGames = GAMES.filter((g) => g.implemented);
  if (gameId && implementedGames.some((g) => g.id === gameId)) {
    lbGameId = gameId;
    lbView = 'week';
  }
  const activeGame = implementedGames.find((g) => g.id === lbGameId) ?? implementedGames[0];
  main.innerHTML = `
    <div class="page">
      <div class="section-label">Ranglister</div>
      <h1 class="section-title">Leaderboard</h1>
      ${isGuestMode() ? '<div class="guest-lb-note">Du spiller som gæst, så du er ikke med på det globale leaderboard endnu — opret en konto fra din profil for at komme med.</div>' : ''}
      <div class="tabs" id="lbViewTabs">
        <button class="tab-btn ${lbView === 'week' ? 'active' : ''}" data-view="week">DENNE UGE</button>
        <button class="tab-btn ${lbView === 'alltime' ? 'active' : ''}" data-view="alltime">ALL-TIME</button>
        <button class="tab-btn ${lbView === 'legendary' ? 'active' : ''}" data-view="legendary">⭐ MOD LEGENDARY</button>
        <button class="tab-btn ${lbView === 'hof' ? 'active' : ''}" data-view="hof">🏆 HALL OF FAME</button>
        <button class="tab-btn ${lbView === 'duel' ? 'active' : ''}" data-view="duel">🧠 QUIZ DUEL</button>
      </div>
      <div class="tabs" id="lbGameTabs" style="${lbView === 'hof' || lbView === 'legendary' || lbView === 'duel' ? 'display:none' : ''}">
        ${implementedGames
          .map((g) => `<button class="tab-btn ${g.id === activeGame.id ? 'active' : ''}" data-game="${g.id}">${g.title.toUpperCase()}</button>`)
          .join('')}
      </div>
      <div class="panel" id="lbPanel"><div style="color:var(--text-faint);font-family:var(--font-mono);font-size:13px">Indlæser…</div></div>
    </div>
  `;
  document.querySelectorAll<HTMLElement>('#lbViewTabs [data-view]').forEach((b) => {
    b.addEventListener('click', () => {
      lbView = b.dataset.view as LbView;
      renderLeaderboard();
    });
  });
  document.querySelectorAll<HTMLElement>('#lbGameTabs [data-game]').forEach((b) => {
    b.addEventListener('click', () => {
      lbGameId = b.dataset.game!;
      renderLeaderboard();
    });
  });

  if (lbView === 'hof') await renderHallOfFame();
  else if (lbView === 'legendary') await renderLegendaryProgress();
  else if (lbView === 'duel') await renderDuelBoard();
  else await renderGameBoard(activeGame.id, activeGame.scoreKind);
}

async function renderGameBoard(gameId: string, scoreKindId: string | null): Promise<void> {
  const board = await getCombinedLeaderboard(gameId, lbView === 'alltime' ? 'alltime' : 'week');

  // The user may have navigated away while the fetch above was in flight —
  // #lbPanel (and this whole render) no longer applies.
  const panel = document.getElementById('lbPanel');
  if (!panel) return;

  const kind = scoreKindId ? ScoreKinds[scoreKindId] : null;
  if (board.length === 0) {
    panel.innerHTML =
      lbView === 'week'
        ? `<div style="color:var(--text-dim);font-size:13.5px">Ingen rekorder denne uge endnu. Vær den første.</div>`
        : `<div style="color:var(--text-dim);font-size:13.5px">Ingen rekorder endnu. Vær den første.</div>`;
    return;
  }
  const medals = ['🥇', '🥈', '🥉'];
  panel.innerHTML = myRankCardHtml(board, kind) + board
    .map((e, i) => {
      const isMe = e.id === profile!.id;
      const scoreText = kind ? `${kind.format(e.score)}<span style="color:var(--text-faint);font-size:11px">${scoreUnitSuffix(kind)}</span>` : Math.round(e.score);
      const title = findTitle(e.title);
      const target = playerLinkTarget(e.id);
      return `
      <a class="lb-row ${isMe ? 'me' : ''} ${i === 0 ? 'lb-row-first' : ''}" href="#/${target}" data-nav="${target}">
        <div class="lb-rank ${i < 3 ? 'medal' : ''}">${i < 3 ? medals[i] : '#' + (i + 1)}</div>
        <div class="lb-player">
          ${avatarFrameHtml(e.name, e.avatar, e.frame, 28)}
          <div class="lb-name-col">
            <span class="lb-name">${nameEffectHtml(e.name, e.nameEffect)}${isMe ? '<span class="lb-you-tag">DIG</span>' : ''}</span>
            ${title ? `<img src="${title.asset}" alt="${title.label}" class="title-badge-img">` : ''}
          </div>
        </div>
        <div class="lb-score mono">${scoreText}</div>
      </a>
    `;
    })
    .join('');
}

/**
 * "Your rank" summary above the full list — the raw board answers "who's winning" but not "can I
 * actually move up," which is what makes a leaderboard worth coming back to. Shows the gap to
 * whoever's directly above you (a natural rival) instead of just your position in a crowd.
 */
function myRankCardHtml(board: LeaderboardEntry[], kind: ScoreKind | null): string {
  if (!profile) return '';
  const myIdx = board.findIndex((e) => e.id === profile!.id);
  const fmt = (v: number) => (kind ? formatScore(kind, v) : `${Math.round(v)}`);

  if (myIdx === -1) {
    return `
      <div class="my-rank-card">
        <div class="my-rank-label">DIN PLACERING</div>
        <div class="my-rank-empty">Du er ikke med på ranglisten endnu — spil en runde for at komme med.</div>
      </div>
    `;
  }

  const me = board[myIdx];
  if (myIdx === 0) {
    const marginText = board.length > 1 ? `${fmt(Math.abs(board[1].score - me.score))} foran #2` : 'Ingen andre på listen endnu';
    return `
      <div class="my-rank-card leading">
        <div class="my-rank-label">DIN PLACERING</div>
        <div class="my-rank-row">
          <div class="my-rank-num">🥇 #1</div>
          <div class="my-rank-score mono">${fmt(me.score)}</div>
        </div>
        <div class="my-rank-gap">🔥 Du fører — ${marginText}</div>
      </div>
    `;
  }

  const above = board[myIdx - 1];
  const gap = kind?.direction === 'asc' ? me.score - above.score : above.score - me.score;
  return `
    <div class="my-rank-card">
      <div class="my-rank-label">DIN PLACERING</div>
      <div class="my-rank-row">
        <div class="my-rank-num">#${myIdx + 1}</div>
        <div class="my-rank-score mono">${fmt(me.score)}</div>
      </div>
      <div class="my-rank-gap">${fmt(Math.abs(gap))} fra ${escapeHtml(above.name)} (#${myIdx})</div>
    </div>
  `;
}

/** Live progress toward this week's legendary slot — who's currently #1 in how many different
 * games right now, so players can see exactly how close they (or a rival) are before the week
 * ends, instead of only finding out after the fact via the Hall of Fame tab. */
async function renderLegendaryProgress(): Promise<void> {
  const standings = await getWeeklyLeadStandings();
  const panel = document.getElementById('lbPanel');
  if (!panel) return;

  if (standings.length === 0) {
    panel.innerHTML = `<div style="color:var(--text-dim);font-size:13.5px">Ingen har sat en rekord denne uge endnu — vær den første #1.</div>`;
    return;
  }
  panel.innerHTML =
    `<div style="color:var(--text-dim);font-size:13px;margin-bottom:12px">Slut ugen som #1 i mindst ${LEGENDARY_WEEK_THRESHOLD} forskellige spil for at optjene et legendary-slot.</div>` +
    standings
      .map((s) => {
        const isMe = s.id === profile!.id;
        const qualifies = s.gameIds.length >= LEGENDARY_WEEK_THRESHOLD;
        const gameBadges = s.gameIds
          .map((gameId) => {
            const g = GAMES.find((gg) => gg.id === gameId);
            return `<span class="hof-badge">${g?.icon ?? '🎮'} ${g?.title ?? gameId}</span>`;
          })
          .join('');
        const target = playerLinkTarget(s.id);
        return `
        <a class="lb-row ${isMe ? 'me' : ''}" href="#/${target}" data-nav="${target}">
          <div class="lb-rank ${qualifies ? 'medal' : ''}">${qualifies ? '⭐' : s.gameIds.length + '/' + LEGENDARY_WEEK_THRESHOLD}</div>
          <div class="lb-player">
            ${avatarFrameHtml(s.name, s.avatar, s.frame, 28)}
            <div class="lb-name-col">
              <span class="lb-name">${nameEffectHtml(s.name, s.nameEffect)}${isMe ? '<span class="lb-you-tag">DIG</span>' : ''}</span>
              <span class="hof-badges">${gameBadges}</span>
            </div>
          </div>
          <div class="lb-score mono">${s.gameIds.length}<span style="color:var(--text-faint);font-size:11px"> #1'ere</span></div>
        </a>
      `;
      })
      .join('');
}

/** Quiz Duel standings — ranked by Elo-style rating (see getDuelLeaderboard/
 * duelTierForRating in state.ts), same list-then-sort shape as renderHallOfFame()
 * below but reading playerMeta rows directly since duel records aren't a per-game
 * score board. */
async function renderDuelBoard(): Promise<void> {
  const entries = await getDuelLeaderboard();
  const panel = document.getElementById('lbPanel');
  if (!panel) return;

  if (entries.length === 0) {
    panel.innerHTML = `<div style="color:var(--text-dim);font-size:13.5px">Ingen har spillet Quiz Duel endnu — <a href="#/activity" data-nav="activity" style="color:var(--violet)">udfordr en modstander</a> for at komme først på listen.</div>`;
    return;
  }
  const medals = ['🥇', '🥈', '🥉'];
  panel.innerHTML = entries
    .map((e, i) => {
      const isMe = e.id === profile!.id;
      const title = findTitle(e.title);
      const target = playerLinkTarget(e.id);
      const played = e.wins + e.losses + e.draws;
      const winRate = played > 0 ? Math.round((e.wins / played) * 100) : 0;
      const tier = duelTierForRating(e.rating);
      return `
      <a class="lb-row ${isMe ? 'me' : ''}" href="#/${target}" data-nav="${target}">
        <div class="lb-rank ${i < 3 ? 'medal' : ''}">${i < 3 ? medals[i] : '#' + (i + 1)}</div>
        <div class="lb-player">
          ${avatarFrameHtml(e.name, e.avatar, e.frame, 28)}
          <div class="lb-name-col">
            <span class="lb-name">${nameEffectHtml(e.name, e.nameEffect)}${isMe ? '<span class="lb-you-tag">DIG</span>' : ''}</span>
            ${title ? `<img src="${title.asset}" alt="${title.label}" class="title-badge-img">` : ''}
            <span class="hof-badges"><span class="hof-badge">${tier.icon} ${tier.label}</span><span class="hof-badge">${e.wins}-${e.losses}-${e.draws} · ${winRate}% sejrsrate</span></span>
          </div>
        </div>
        <div class="lb-score mono">${e.rating}</div>
      </a>
    `;
    })
    .join('');
}

async function renderHallOfFame(): Promise<void> {
  await creditMyHallOfFameWins();
  const entries = await getHallOfFame();

  const panel = document.getElementById('lbPanel');
  if (!panel) return; // navigated away while finalizing/fetching

  if (entries.length === 0) {
    panel.innerHTML = `<div style="color:var(--text-dim);font-size:13.5px">Ingen ugevindere endnu — kom tilbage når den første uge er omme.</div>`;
    return;
  }
  const medals = ['🥇', '🥈', '🥉'];
  const rows = await Promise.all(
    entries.map(async (e, i) => {
      const isMe = e.id === profile!.id;
      const meta = await getPlayerMeta(e.id);
      const name = meta?.name ?? 'Ukendt spiller';
      const title = findTitle(meta?.title);
      const gameBadges = Object.entries(e.wins)
        .sort((a, b) => b[1] - a[1])
        .map(([gameId, count]) => {
          const g = GAMES.find((gg) => gg.id === gameId);
          return `<span class="hof-badge">${g?.icon ?? '🎮'} ${g?.title ?? gameId} ×${count}</span>`;
        })
        .join('');
      const target = playerLinkTarget(e.id);
      return `
      <a class="lb-row ${isMe ? 'me' : ''}" href="#/${target}" data-nav="${target}">
        <div class="lb-rank ${i < 3 ? 'medal' : ''}">${i < 3 ? medals[i] : '#' + (i + 1)}</div>
        <div class="lb-player">
          ${avatarFrameHtml(name, meta?.avatar, meta?.frame, 28)}
          <div class="lb-name-col">
            <span class="lb-name">${nameEffectHtml(name, meta?.nameEffect)}${isMe ? '<span class="lb-you-tag">DIG</span>' : ''}</span>
            ${title ? `<img src="${title.asset}" alt="${title.label}" class="title-badge-img">` : ''}
            <span class="hof-badges">${gameBadges}</span>
          </div>
        </div>
        <div class="lb-score mono">${e.totalWins}<span style="color:var(--text-faint);font-size:11px"> #1'ere</span></div>
      </a>
    `;
    }),
  );
  panel.innerHTML = rows.join('');
}
