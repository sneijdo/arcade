import './styles/index.css';
import { Sound } from './sound';
import { loadProfile, saveProfile, profile } from './state';
import { refreshHeader } from './header';
import { initRouter, navigate, currentHashRoute } from './router';
import { showOnboarding, showAuthModal, closeAnyModal } from './onboarding';
import { authAvailable, onAuthStateChange } from './auth';
import { hasLocalGuestProfile, useLocalGuestStorage } from './storage';
import { startPresence } from './activity';
import { startInviteListener } from './duel/challenges';
import { mountInviteBanner } from './duel/inviteBanner';
import { captureReferralFromUrl, syncReferrals } from './referral';
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
  Sound.setPack(p.equippedSoundPack);
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
  Sound.setPack(p.equippedSoundPack);
    refreshHeader();
    startPresence(p.id, p.name, p.equippedAvatar);
    startInviteListener(p.id);
    mountInviteBanner();
    void syncReferrals();
    // Refreshes this player's public PlayerMeta snapshot (see saveProfile in state.ts)
    // just from opening the app — not only from playing/equipping something. Otherwise
    // a player who's genuinely progressed but hasn't triggered a save since a new
    // PlayerMeta field was added would show stale/zeroed-out data on their public
    // player-profile page until their next game session.
    void saveProfile();
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
  captureReferralFromUrl();
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
