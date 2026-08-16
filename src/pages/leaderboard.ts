import { profile, getCombinedLeaderboard, avatarContent, creditMyHallOfFameWins, getHallOfFame, getPlayerMeta } from '../state';
import { findTitle } from '../shop';
import { GAMES } from '../games/registry';
import { ScoreKinds } from '../scoring';

let lbGameId = 'reaction';
type LbView = 'week' | 'alltime' | 'hof';
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
      <div class="section-title">Leaderboard</div>
      <div class="tabs" id="lbViewTabs">
        <button class="tab-btn ${lbView === 'week' ? 'active' : ''}" data-view="week">DENNE UGE</button>
        <button class="tab-btn ${lbView === 'alltime' ? 'active' : ''}" data-view="alltime">ALL-TIME</button>
        <button class="tab-btn ${lbView === 'hof' ? 'active' : ''}" data-view="hof">🏆 HALL OF FAME</button>
      </div>
      <div class="tabs" id="lbGameTabs" style="${lbView === 'hof' ? 'display:none' : ''}">
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
  panel.innerHTML = board
    .map((e, i) => {
      const isMe = e.id === profile!.id;
      const scoreText = kind ? `${kind.format(e.score)}<span style="color:var(--text-faint);font-size:11px"> ${kind.unit}</span>` : Math.round(e.score);
      const title = findTitle(e.title);
      return `
      <div class="lb-row ${isMe ? 'me' : ''}">
        <div class="lb-rank ${i < 3 ? 'medal' : ''}">${i < 3 ? medals[i] : '#' + (i + 1)}</div>
        <div class="lb-player">
          <div class="avatar" style="width:28px;height:28px;font-size:14px">${avatarContent(e.name, e.avatar)}</div>
          <div class="lb-name-col">
            <span class="lb-name">${e.name}${isMe ? '<span class="lb-you-tag">DIG</span>' : ''}</span>
            ${title ? `<span class="lb-title-tag">${title.label}</span>` : ''}
          </div>
        </div>
        <div class="lb-score mono">${scoreText}</div>
      </div>
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
      return `
      <div class="lb-row ${isMe ? 'me' : ''}">
        <div class="lb-rank ${i < 3 ? 'medal' : ''}">${i < 3 ? medals[i] : '#' + (i + 1)}</div>
        <div class="lb-player">
          <div class="avatar" style="width:28px;height:28px;font-size:14px">${avatarContent(name, meta?.avatar)}</div>
          <div class="lb-name-col">
            <span class="lb-name">${name}${isMe ? '<span class="lb-you-tag">DIG</span>' : ''}</span>
            ${title ? `<span class="lb-title-tag">${title.label}</span>` : ''}
            <span class="hof-badges">${gameBadges}</span>
          </div>
        </div>
        <div class="lb-score mono">${e.totalWins}<span style="color:var(--text-faint);font-size:11px"> #1'ere</span></div>
      </div>
    `;
    }),
  );
  panel.innerHTML = rows.join('');
}
