import { renderGameGrid } from './gameGrid';

export function renderGames(): void {
  const main = document.getElementById('main')!;
  main.innerHTML = `
    <div class="page">
      <h1 class="section-title">Alle spil</h1>
      <div class="game-grid" id="gamesGrid"></div>
    </div>
  `;
  renderGameGrid(document.getElementById('gamesGrid')!);
}
