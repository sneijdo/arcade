import './styles/index.css';
import { inject } from '@vercel/analytics';
import { Sound } from './sound';
import { loadProfile, saveProfile, profile } from './state';
import { refreshHeader } from './header';
import { initRouter, navigate, currentHashRoute } from './router';
import { showOnboarding, showAuthModal, closeAnyModal } from './onboarding';
import { authAvailable, onAuthStateChange } from './auth';
import { hasLocalGuestProfile, useLocalGuestStorage } from './storage';
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
  if (nameEl) nameEl.textContent = 'Gæst';
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
  navigate(currentHashRoute());
}

/** Supabase configured — username/password session gates everything. */
async function initSupabaseMode(): Promise<void> {
  const handleSession = async (session: Session | null) => {
    if (!session) {
      markGuest();
      showAuthModal('signup');
      return;
    }
    closeAnyModal();
    let p = await loadProfile();
    if (!p) {
      // Signup just created the session; its own createProfile() call may
      // not have landed yet — give it one short retry before treating this
      // as a genuinely missing profile.
      await new Promise((r) => setTimeout(r, 400));
      p = await loadProfile();
    }
    if (!p) {
      markGuest();
      showAuthModal('signup');
      return;
    }
    Sound.setMuted(!!p.muted);
    refreshHeader();
    navigate(currentHashRoute());
  };

  onAuthStateChange((event, session) => {
    if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
      handleSession(session);
    }
  });
}

function wireAudioUnlock(): void {
  const unlock = () => Sound.unlock();
  document.addEventListener('pointerdown', unlock, { once: true });
}

async function init(): Promise<void> {
  inject();
  initRouter();
  wireMuteButton();
  wireAudioUnlock();
  if (authAvailable() && hasLocalGuestProfile()) {
    // A previous visit chose "play as guest" — resume that local profile straight away instead
    // of forcing the signup wall again on every reload (see onboarding.ts's enterAsGuest()).
    useLocalGuestStorage();
    await initLocalMode();
  } else if (authAvailable()) {
    await initSupabaseMode();
  } else {
    await initLocalMode();
  }
}

init();

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // registration failure shouldn't block the app
    });
  });
}
