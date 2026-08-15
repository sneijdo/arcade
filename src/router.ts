import { Sound } from './sound';
import { renderHome } from './pages/home';
import { renderGames } from './pages/games';
import { renderLeaderboard } from './pages/leaderboard';
import { renderFriends } from './pages/friends';
import { renderProfile } from './pages/profile';
import { GAME_RENDERERS } from './games';
import type { Route } from './types';

export let route: Route = 'home';

function setActiveNav(): void {
  document.querySelectorAll<HTMLElement>('.nav-link').forEach((el) => {
    el.classList.toggle('active', el.dataset.nav === route);
  });
}

export async function navigate(r: string): Promise<void> {
  route = r as Route;
  setActiveNav();
  window.scrollTo({ top: 0, behavior: 'instant' });
  if (r === 'home') await renderHome();
  else if (r === 'games') renderGames();
  else if (r === 'leaderboard') await renderLeaderboard();
  else if (r === 'friends') renderFriends();
  else if (r === 'profile') await renderProfile();
  else if (r.startsWith('play-')) GAME_RENDERERS[r.slice(5)]?.();
}

export function initRouter(): void {
  document.addEventListener('click', (e) => {
    const navEl = (e.target as HTMLElement).closest<HTMLElement>('[data-nav]');
    if (navEl) {
      Sound.click();
      navigate(navEl.dataset.nav!);
    }
  });
}
