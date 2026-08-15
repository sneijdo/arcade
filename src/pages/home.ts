import { profile, getCombinedLeaderboard } from '../state';
import { renderGameGrid } from './gameGrid';

export async function renderHome(): Promise<void> {
  const main = document.getElementById('main')!;
  if (!profile) return;
  const board = await getCombinedLeaderboard('reaction');
  const globalBest = board.length ? Math.round(board[0].score) : null;
  main.innerHTML = `
    <div class="page">
      <section class="hero">
        <div class="hero-tag">SPIL · KONKURRER · DOMINÉR</div>
        <div class="hero-word">ARCADE</div>
        <p class="hero-sub">Hurtige spil. Rigtige leaderboards. Ét forsøg mere er altid ét klik væk.</p>
        <div class="hero-ctas">
          <button class="btn btn-primary btn-lg" data-nav="play-reaction">▶ SPIL NU</button>
          <button class="btn btn-ghost btn-lg" data-nav="leaderboard">SE LEADERBOARD</button>
        </div>
      </section>

      <div class="section-label">I fokus</div>
      <div class="featured">
        <div class="featured-body">
          <span class="badge">Live nu</span>
          <div class="featured-title">Reaction</div>
          <p class="featured-desc">Fem runder. Skærmen bliver mørk, så lyser den op — klik i samme øjeblik du ser det. Millisekunder afgør alt.</p>
          <div class="featured-stats">
            <div class="stat-block you"><div class="stat-num mono">${profile.bestReaction != null ? Math.round(profile.bestReaction) : '—'}</div><div class="stat-label">Din rekord (ms)</div></div>
            <div class="stat-block world"><div class="stat-num mono">${globalBest != null ? globalBest : '—'}</div><div class="stat-label">Global rekord (ms)</div></div>
          </div>
          <button class="btn btn-primary" data-nav="play-reaction" style="align-self:flex-start">SPIL REACTION</button>
        </div>
        <div class="featured-visual">
          <div class="pulse-orb">
            <div class="pulse-ring"></div><div class="pulse-ring"></div><div class="pulse-ring"></div>
            <div class="pulse-core"></div>
          </div>
        </div>
      </div>

      <div class="section-label" style="margin-top:44px">Hurtigt i gang</div>
      <div class="section-title">Spil</div>
      <div class="game-grid" id="homeGameGrid"></div>

      <div class="footer-note">ARCADE · BYGGET TIL ÉT FORSØG MERE</div>
    </div>
  `;
  renderGameGrid(document.getElementById('homeGameGrid')!);
}
