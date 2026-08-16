import { renderGameGrid } from './gameGrid';

export function renderGames(): void {
  const main = document.getElementById('main')!;
  main.innerHTML = `
    <div class="page">
      <div class="section-label">Alle spil</div>
      <h1 class="section-title">Spil</h1>
      <div class="game-grid" id="gamesGrid"></div>
    </div>
  `;
  renderGameGrid(document.getElementById('gamesGrid')!);
}
