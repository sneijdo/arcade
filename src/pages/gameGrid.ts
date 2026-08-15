import { GAMES } from '../games/registry';
import { profile } from '../state';

export function renderGameGrid(container: HTMLElement): void {
  if (!profile) return;
  container.innerHTML = GAMES.map((g) => {
    const bestHtml =
      g.id === 'reaction'
        ? profile!.bestReaction != null
          ? `Best: <b>${Math.round(profile!.bestReaction)}ms</b>`
          : 'Not played yet'
        : 'Coming soon';
    return `
      <div class="game-card ${g.implemented ? '' : 'soon'}" ${g.implemented ? `data-nav="play-${g.id}"` : ''}>
        ${!g.implemented ? '<span class="soon-tag">COMING SOON</span>' : ''}
        <div class="game-icon">${g.icon}</div>
        <div>
          <div class="game-name">${g.title}</div>
          <div class="game-cat">${g.category}</div>
        </div>
        <div class="game-best">${bestHtml}</div>
        ${
          g.implemented
            ? `<button class="btn btn-ghost btn-block" data-nav="play-${g.id}">PLAY</button>`
            : `<button class="btn btn-ghost btn-block" disabled style="opacity:.5;cursor:not-allowed">LOCKED</button>`
        }
      </div>
    `;
  }).join('');
}
