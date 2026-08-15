import { profile, getCombinedLeaderboard, initials } from '../state';
import { GAMES } from '../games/registry';
import { ScoreKinds } from '../scoring';

let lbGameId = 'reaction';

export async function renderLeaderboard(): Promise<void> {
  const main = document.getElementById('main')!;
  if (!profile) return;
  const implementedGames = GAMES.filter((g) => g.implemented);
  const activeGame = implementedGames.find((g) => g.id === lbGameId) ?? implementedGames[0];
  main.innerHTML = `
    <div class="page">
      <div class="section-label">Ranglister</div>
      <div class="section-title">Leaderboard</div>
      <div class="tabs">
        ${implementedGames
          .map((g) => `<button class="tab-btn ${g.id === activeGame.id ? 'active' : ''}" data-game="${g.id}">${g.title.toUpperCase()}</button>`)
          .join('')}
      </div>
      <div class="panel" id="lbPanel"><div style="color:var(--text-faint);font-family:var(--font-mono);font-size:13px">Indlæser…</div></div>
    </div>
  `;
  document.querySelectorAll<HTMLElement>('.tab-btn').forEach((b) => {
    b.addEventListener('click', () => {
      lbGameId = b.dataset.game!;
      renderLeaderboard();
    });
  });

  const board = await getCombinedLeaderboard(activeGame.id);
  const kind = activeGame.scoreKind ? ScoreKinds[activeGame.scoreKind] : null;
  const panel = document.getElementById('lbPanel')!;
  if (board.length === 0) {
    panel.innerHTML = `<div style="color:var(--text-dim);font-size:13.5px">Ingen rekorder endnu. Vær den første.</div>`;
    return;
  }
  const medals = ['🥇', '🥈', '🥉'];
  panel.innerHTML = board
    .map((e, i) => {
      const isMe = e.id === profile!.id;
      const scoreText = kind ? `${kind.format(e.score)}<span style="color:var(--text-faint);font-size:11px"> ${kind.unit}</span>` : Math.round(e.score);
      return `
      <div class="lb-row ${isMe ? 'me' : ''}">
        <div class="lb-rank ${i < 3 ? 'medal' : ''}">${i < 3 ? medals[i] : '#' + (i + 1)}</div>
        <div class="lb-player">
          <div class="avatar" style="width:28px;height:28px;font-size:11px">${initials(e.name)}</div>
          <span class="lb-name">${e.name}${isMe ? '<span class="lb-you-tag">DIG</span>' : ''}</span>
        </div>
        <div class="lb-score mono">${scoreText}</div>
      </div>
    `;
    })
    .join('');
}
