import { GAMES } from '../games/registry';
import { profile, bestScoreForGame } from '../state';
import { ScoreKinds } from '../scoring';

export function renderGameGrid(container: HTMLElement): void {
  if (!profile) return;
  container.innerHTML = GAMES.map((g) => {
    let bestHtml = 'Kommer snart';
    if (g.implemented) {
      const best = bestScoreForGame(g.id);
      if (best != null && g.scoreKind) {
        const kind = ScoreKinds[g.scoreKind];
        bestHtml = `Rekord: <b>${kind.format(best)}${kind.unit}</b>`;
      } else {
        bestHtml = 'Ikke spillet endnu';
      }
    }
    return `
      <div class="game-card ${g.implemented ? '' : 'soon'}" ${g.implemented ? `data-nav="play-${g.id}"` : ''}>
        ${!g.implemented ? '<span class="soon-tag">KOMMER SNART</span>' : ''}
        <div class="game-icon"><img src="${g.iconAsset}" alt="" class="game-icon-img"></div>
        <div>
          <div class="game-name">${g.title}</div>
          <div class="game-cat">${g.category}</div>
        </div>
        <div class="game-best">${bestHtml}</div>
        ${
          g.implemented
            ? `<button class="btn btn-ghost btn-block" data-nav="play-${g.id}">SPIL</button>`
            : `<button class="btn btn-ghost btn-block" disabled style="opacity:.5;cursor:not-allowed">LÅST</button>`
        }
      </div>
    `;
  }).join('');
}
