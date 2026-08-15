import './styles/index.css';
import { Sound } from './sound';
import { loadProfile, saveProfile, profile } from './state';
import { refreshHeader } from './header';
import { initRouter, navigate } from './router';
import { showOnboarding, showEmailAuthModal, showNameModal, closeAnyModal } from './onboarding';
import { authAvailable, onAuthStateChange } from './auth';
import type { Session } from '@supabase/supabase-js';

function wireMuteButton(): void {
  document.getElementById('muteBtn')!.addEventListener('click', async () => {
    Sound.setMuted(!Sound.isMuted());
    if (profile) {
      profile.muted = Sound.isMuted();
      await saveProfile();
    }
    refreshHeader();
  });
}

function markGuest(): void {
  const nameEl = document.getElementById('headerName');
  if (nameEl) nameEl.textContent = 'Guest';
}

/** No Supabase configured — original name-only flow, localStorage-backed. */
async function initLocalMode(): Promise<void> {
  const p = await loadProfile();
  if (!p) {
    markGuest();
    showOnboarding();
    return;
  }
  Sound.setMuted(!!p.muted);
  refreshHeader();
  navigate('home');
}

/** Supabase configured — email magic-link session gates everything. */
async function initSupabaseMode(): Promise<void> {
  const handleSession = async (session: Session | null) => {
    if (!session) {
      markGuest();
      showEmailAuthModal();
      return;
    }
    closeAnyModal();
    const p = await loadProfile();
    if (!p) {
      markGuest();
      showNameModal(session.user.id);
      return;
    }
    Sound.setMuted(!!p.muted);
    refreshHeader();
    navigate('home');
  };

  onAuthStateChange((event, session) => {
    if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
      handleSession(session);
    }
  });
}

async function init(): Promise<void> {
  initRouter();
  wireMuteButton();
  if (authAvailable()) await initSupabaseMode();
  else await initLocalMode();
}

init();

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // registration failure shouldn't block the app
    });
  });
}
