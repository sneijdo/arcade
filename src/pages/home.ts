import { profile } from '../state';
import { MOCK_FEED } from '../mockSocial';
import { renderGameGrid } from './gameGrid';

export async function renderHome(): Promise<void> {
  const main = document.getElementById('main')!;
  if (!profile) return;
  main.innerHTML = `
    <div class="page">
      <section class="hero">
        <div class="hero-tag">PLAY · COMPETE · DOMINATE</div>
        <div class="hero-word">ARCADE</div>
        <p class="hero-sub">Quick games. Real leaderboards. One more attempt is always one click away.</p>
        <div class="hero-ctas">
          <button class="btn btn-primary btn-lg" data-nav="play-reaction">▶ PLAY NOW</button>
          <button class="btn btn-ghost btn-lg" data-nav="leaderboard">VIEW LEADERBOARD</button>
        </div>
      </section>

      <div class="section-label">Featured</div>
      <div class="featured">
        <div class="featured-body">
          <span class="badge">Live now</span>
          <div class="featured-title">Reaction</div>
          <p class="featured-desc">Five rounds. The screen goes dark, then lights up — click the instant you see it. Milliseconds decide everything.</p>
          <div class="featured-stats">
            <div class="stat-block you"><div class="stat-num mono">${profile.bestReaction != null ? Math.round(profile.bestReaction) : '—'}</div><div class="stat-label">Your best (ms)</div></div>
            <div class="stat-block world"><div class="stat-num mono">142</div><div class="stat-label">Global best (ms)</div></div>
          </div>
          <button class="btn btn-primary" data-nav="play-reaction" style="align-self:flex-start">PLAY REACTION</button>
        </div>
        <div class="featured-visual">
          <div class="pulse-orb">
            <div class="pulse-ring"></div><div class="pulse-ring"></div><div class="pulse-ring"></div>
            <div class="pulse-core"></div>
          </div>
        </div>
      </div>

      <div class="section-label" style="margin-top:44px">Quick play</div>
      <div class="section-title">Games</div>
      <div class="game-grid" id="homeGameGrid"></div>

      <div class="section-label" style="margin-top:44px">Activity</div>
      <div class="section-title">Friends</div>
      <div class="panel feed" id="homeFeed"></div>

      <div class="footer-note">ARCADE · MILESTONE 1 · BUILT FOR ONE MORE ATTEMPT</div>
    </div>
  `;
  renderGameGrid(document.getElementById('homeGameGrid')!);
  const feed = document.getElementById('homeFeed')!;
  feed.innerHTML = MOCK_FEED.map((f) => `<div class="feed-item"><span class="feed-icon">${f.icon}</span><span>${f.html}</span><span class="feed-time">${f.time}</span></div>`).join('');
}
