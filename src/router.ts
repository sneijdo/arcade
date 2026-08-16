import { Sound } from './sound';
import { renderHome } from './pages/home';
import { renderGames } from './pages/games';
import { renderLeaderboard } from './pages/leaderboard';
import { renderProfile } from './pages/profile';
import { renderShop } from './pages/shop';
import { GAME_RENDERERS } from './games';
import type { Route } from './types';

export let route: Route = 'home';

function setActiveNav(): void {
  document.querySelectorAll<HTMLElement>('.nav-link').forEach((el) => {
    el.classList.toggle('active', el.dataset.nav === route);
  });
}

export async function navigate(r: string): Promise<void> {
  // "leaderboard-<gameId>" (from a just-finished game's results screen) opens straight to
  // that game's tab, but is still just the "leaderboard" route for nav-highlighting/type purposes.
  const isLeaderboard = r === 'leaderboard' || r.startsWith('leaderboard-');
  route = (isLeaderboard ? 'leaderboard' : r) as Route;
  setActiveNav();
  window.scrollTo({ top: 0, behavior: 'instant' });
  // Reflect the route in the URL so a reload/relaunch (e.g. mobile OS backgrounding and
  // then reloading the tab) restores here instead of always dropping back to the homepage.
  const hash = '#/' + r;
  if (location.hash !== hash) history.pushState(null, '', hash);
  if (r === 'home') await renderHome();
  else if (r === 'games') renderGames();
  else if (isLeaderboard) await renderLeaderboard(r.startsWith('leaderboard-') ? r.slice('leaderboard-'.length) : undefined);
  else if (r === 'profile') await renderProfile();
  else if (r === 'shop') await renderShop();
  else if (r.startsWith('play-')) GAME_RENDERERS[r.slice(5)]?.();
}

/** What route the current URL points at — used both to restore on app boot and to resolve browser back/forward. Falls back to 'home' for anything unresolvable (e.g. a stale bookmarked/reloaded hash pointing at a game id that no longer exists) rather than rendering a blank page. */
export function currentHashRoute(): string {
  const r = location.hash.startsWith('#/') ? location.hash.slice(2) : 'home';
  if (r.startsWith('play-') && !GAME_RENDERERS[r.slice(5)]) return 'home';
  return r || 'home';
}

export function initRouter(): void {
  document.addEventListener('click', (e) => {
    const navEl = (e.target as HTMLElement).closest<HTMLElement>('[data-nav]');
    if (navEl) {
      Sound.click();
      navigate(navEl.dataset.nav!);
    }
  });
  window.addEventListener('popstate', () => {
    void navigate(currentHashRoute());
  });
}
