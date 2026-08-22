import { Sound } from './sound';
import { profile } from './state';
import { toast } from './toast';
import { canAccessEmberWard } from './games/towerdefense/beta';
import { renderHome } from './pages/home';
import { renderGames } from './pages/games';
import { renderLeaderboard } from './pages/leaderboard';
import { renderActivity } from './pages/activity';
import { renderProfile } from './pages/profile';
import { renderPlayerProfile } from './pages/playerProfile';
import { renderShop } from './pages/shop';
import { renderGuide } from './pages/guide';
import { renderDuelMatch } from './pages/duel';
import { renderCasino } from './pages/casino';
import { GAME_RENDERERS } from './games';
import { GAMES } from './games/registry';
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
  else if (r === 'activity') await renderActivity();
  else if (r === 'profile') await renderProfile();
  else if (r === 'shop') await renderShop();
  else if (r === 'guide') renderGuide();
  else if (r === 'kasino') await renderCasino();
  else if (r.startsWith('play-')) {
    const gameId = r.slice(5);
    // Ember Ward is closed-testing (see games/towerdefense/beta.ts) — block direct URL
    // navigation too, not just hide it from the games grid.
    if (gameId === 'towerdefense' && !canAccessEmberWard(profile?.name)) {
      toast('Dette spil er endnu ikke tilgængeligt.');
      await navigate('home');
      return;
    }
    // Any other game not yet marked implemented (registry.ts) is "coming soon" — block
    // direct URL navigation the same way, not just hide it from the games grid.
    if (GAMES.find((g) => g.id === gameId)?.implemented === false) {
      toast('Dette spil er endnu ikke tilgængeligt.');
      await navigate('home');
      return;
    }
    GAME_RENDERERS[gameId]?.();
  }
  else if (r.startsWith('player-')) await renderPlayerProfile(r.slice('player-'.length));
  else if (r.startsWith('duel-')) await renderDuelMatch(r.slice('duel-'.length));
}

const KNOWN_ROUTES = ['home', 'games', 'leaderboard', 'activity', 'profile', 'shop', 'guide', 'kasino'];

/** What route the current URL points at — used both to restore on app boot and to resolve browser back/forward. Falls back to 'home' for anything unresolvable (e.g. a stale bookmarked/reloaded hash pointing at a game id that no longer exists, or any other unrecognized route string) rather than rendering a blank page. */
export function currentHashRoute(): string {
  const r = location.hash.startsWith('#/') ? location.hash.slice(2) : 'home';
  if (!r) return 'home';
  if (r.startsWith('play-')) return GAME_RENDERERS[r.slice(5)] ? r : 'home';
  if (r.startsWith('leaderboard-')) return r;
  if (r.startsWith('player-')) return r;
  if (r.startsWith('duel-')) return r;
  return KNOWN_ROUTES.includes(r) ? r : 'home';
}

export function initRouter(): void {
  document.addEventListener('click', (e) => {
    const navEl = (e.target as HTMLElement).closest<HTMLElement>('[data-nav]');
    if (navEl) {
      // nav-link/logo/player-chip are real <a href="#/..."> now (for keyboard/screen-reader
      // access) — prevent the native anchor navigation so the JS router stays the single
      // source of truth instead of double-handling the hash change.
      e.preventDefault();
      Sound.click();
      navigate(navEl.dataset.nav!);
    }
  });
  window.addEventListener('popstate', () => {
    void navigate(currentHashRoute());
  });
}
