import { createProfile, loadProfile } from './state';
import { refreshHeader } from './header';
import { navigate } from './router';
import { signUpWithUsername, signInWithUsername, validateUsername, generateRecoveryCode, setRecoveryCode, redeemRecoveryCode } from './auth';
import { toast } from './toast';
import { useLocalGuestStorage, useSupabaseStorage, clearLocalGuestProfile, isGuestMode } from './storage';
import { Sound } from './sound';

function mountModal(html: string): HTMLElement {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = html;
  document.body.appendChild(backdrop);
  return backdrop;
}

/** Local-dev fallback when Supabase isn't configured — original name-only flow, localStorage-backed. */
export function showOnboarding(): void {
  const backdrop = mountModal(`
    <div class="modal">
      <div class="hero-tag" style="margin-bottom:10px">VELKOMMEN TIL</div>
      <h2>ARCADE</h2>
      <p>Vælg et navn — sådan viser du dig på leaderboards og til venner.</p>
      <input type="text" id="nameInput" maxlength="18" placeholder="Dit navn" autocomplete="off">
      <button class="btn btn-primary btn-block btn-lg" id="enterBtn">GÅ TIL ARCADE</button>
    </div>
  `);
  const input = document.getElementById('nameInput') as HTMLInputElement;
  input.focus();
  const enter = async () => {
    const name = input.value.trim();
    if (!name) {
      input.style.borderColor = 'var(--coral)';
      return;
    }
    await createProfile(name);
    backdrop.remove();
    refreshHeader();
    navigate('home');
  };
  document.getElementById('enterBtn')!.addEventListener('click', enter);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') enter();
  });
}

/**
 * Guest path off the signup wall — plays immediately, no account, using device-local storage
 * (see useLocalGuestStorage in storage.ts). Deliberately its own modal rather than reusing
 * showOnboarding()'s copy: that one's wording assumes local mode is the *only* mode (fine for a
 * dev-only deployment), whereas a guest here specifically needs to know their progress is
 * device-only and that a real account is one tap away later, from their profile.
 */
function enterAsGuest(): void {
  useLocalGuestStorage();
  const backdrop = mountModal(`
    <div class="modal">
      <div class="hero-tag" style="margin-bottom:10px">SPILLER SOM GÆST</div>
      <h2>Vælg et navn</h2>
      <p>Dine resultater gemmes kun på denne enhed, og du er ikke med på det globale leaderboard endnu. Du kan oprette en rigtig konto når som helst fra din profil.</p>
      <input type="text" id="guestNameInput" maxlength="18" placeholder="Dit navn" autocomplete="off">
      <button class="btn btn-primary btn-block btn-lg" id="guestEnterBtn">SPIL</button>
    </div>
  `);
  const input = document.getElementById('guestNameInput') as HTMLInputElement;
  input.focus();
  const enter = async () => {
    const name = input.value.trim();
    if (!name) {
      input.style.borderColor = 'var(--coral)';
      return;
    }
    await createProfile(name);
    backdrop.remove();
    refreshHeader();
    navigate('home');
  };
  document.getElementById('guestEnterBtn')!.addEventListener('click', enter);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') enter();
  });
}

type AuthMode = 'signup' | 'login';

/** Supabase flow: username + password, no email round-trip at all. */
export function showAuthModal(mode: AuthMode = 'signup'): void {
  document.querySelector('.modal-backdrop')?.remove();
  const isSignup = mode === 'signup';
  const backdrop = mountModal(`
    <div class="modal">
      <div class="hero-tag" style="margin-bottom:10px">${isSignup ? 'NY HER?' : 'VELKOMMEN TILBAGE'}</div>
      <h2>${isSignup ? 'Opret konto' : 'Log ind'}</h2>
      <p>${isSignup ? 'Vælg et brugernavn og en adgangskode — det er hele processen.' : 'Log ind med dit brugernavn og din adgangskode.'}${isSignup && isGuestMode() ? ' Din nuværende gæsteprofil på denne enhed bliver ikke overført til den nye konto.' : ''}</p>
      <input type="text" id="usernameInput" maxlength="18" placeholder="Brugernavn" autocomplete="username">
      <input type="password" id="passwordInput" placeholder="Adgangskode" autocomplete="${isSignup ? 'new-password' : 'current-password'}" style="margin-top:-4px">
      ${isSignup ? '<p style="color:var(--text-faint);font-size:11.5px;text-align:left;line-height:1.5;margin-top:-6px">Brug ikke en adgangskode du bruger til andre/vigtige ting.</p>' : ''}
      <button class="btn btn-primary btn-block btn-lg" id="submitBtn" style="margin-top:10px">${isSignup ? 'OPRET KONTO' : 'LOG IND'}</button>
      <p id="authError" style="color:var(--coral);font-size:12.5px;margin-top:10px;margin-bottom:0;display:none"></p>
      ${!isSignup ? '<button class="btn btn-ghost btn-block" id="forgotPasswordBtn" style="margin-top:10px">Glemt adgangskode?</button>' : ''}
      <button class="btn btn-ghost btn-block" id="toggleModeBtn" style="margin-top:${isSignup ? '10px' : '6px'}">${isSignup ? 'Har du allerede en konto? Log ind' : 'Ny her? Opret konto'}</button>
      ${isSignup ? '<button class="btn btn-ghost btn-block" id="guestBtn" style="margin-top:6px;color:var(--text-dim)">Spil som gæst</button>' : ''}
    </div>
  `);
  const usernameInput = document.getElementById('usernameInput') as HTMLInputElement;
  const passwordInput = document.getElementById('passwordInput') as HTMLInputElement;
  const errorEl = document.getElementById('authError')!;
  const submitBtn = document.getElementById('submitBtn') as HTMLButtonElement;
  usernameInput.focus();

  const showError = (msg: string) => {
    errorEl.textContent = msg;
    errorEl.style.display = 'block';
  };

  document.getElementById('toggleModeBtn')!.addEventListener('click', () => {
    backdrop.remove();
    showAuthModal(isSignup ? 'login' : 'signup');
  });

  document.getElementById('forgotPasswordBtn')?.addEventListener('click', () => {
    backdrop.remove();
    showForgotPasswordModal();
  });

  document.getElementById('guestBtn')?.addEventListener('click', () => {
    backdrop.remove();
    enterAsGuest();
  });

  const submit = async () => {
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    errorEl.style.display = 'none';
    usernameInput.style.borderColor = '';
    passwordInput.style.borderColor = '';

    if (isSignup) {
      const v = validateUsername(username);
      if (!v.valid) {
        usernameInput.style.borderColor = 'var(--coral)';
        showError(v.error!);
        return;
      }
    } else if (!username) {
      usernameInput.style.borderColor = 'var(--coral)';
      showError('Indtast dit brugernavn.');
      return;
    }
    if (!password) {
      passwordInput.style.borderColor = 'var(--coral)';
      showError('Indtast en adgangskode.');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = isSignup ? 'OPRETTER…' : 'LOGGER IND…';

    if (isSignup) {
      const { error, userId } = await signUpWithUsername(username, password);
      if (error || !userId) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'OPRET KONTO';
        showError(error ?? 'Der gik noget galt.');
        return;
      }
      // Undoes guest mode if this signup came from a guest's "create account" flow (see
      // profile.ts) — harmless no-op otherwise, since a first-time signup is already on the
      // Supabase adapter. The stale local guest profile is cleared so a future reload doesn't
      // keep detecting it and resuming guest mode instead of this new account.
      useSupabaseStorage();
      clearLocalGuestProfile();
      await createProfile(username, userId);
      backdrop.remove();
      refreshHeader();
      await showRecoveryCodeReveal();
      navigate('home');
    } else {
      // Captured before signing in: a guest session never registered main.ts's auth-state
      // listener in the first place (it only runs when init() took the Supabase path), so
      // logging into an existing real account from inside a guest session needs to be
      // completed manually below instead of assuming that listener will pick it up.
      const wasGuest = isGuestMode();
      const { error } = await signInWithUsername(username, password);
      if (error) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'LOG IND';
        showError(error);
        return;
      }
      backdrop.remove();
      if (wasGuest) {
        useSupabaseStorage();
        clearLocalGuestProfile();
        const p = await loadProfile();
        if (p) {
          Sound.setMuted(!!p.muted);
          refreshHeader();
        }
        navigate('home');
      }
      // Otherwise: session established — main.ts's auth-state listener (already running in
      // this case) loads the profile and navigates home; nothing further to do here.
    }
  };
  submitBtn.addEventListener('click', submit);
  passwordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submit();
  });
}

/**
 * Shown once, right after signup (and again after a successful password
 * recovery, since redeeming a code burns it). Generates a fresh code,
 * saves it server-side, and blocks progress until the user explicitly
 * confirms they've saved it — this is the ONLY way back into the account
 * if the password is ever forgotten, since accounts use a synthetic email
 * with nowhere real to send a reset link.
 */
export async function showRecoveryCodeReveal(): Promise<void> {
  const code = generateRecoveryCode();
  const saved = await setRecoveryCode(code);
  return new Promise((resolve) => {
    const backdrop = mountModal(`
      <div class="modal">
        <div class="hero-tag" style="margin-bottom:10px">VIGTIGT</div>
        <h2>Gem din gendannelseskode</h2>
        <p>Hvis du glemmer din adgangskode, er det kun den her kode der kan give dig adgang til kontoen igen. Den vises ikke igen.</p>
        <div class="recovery-code-box" id="recoveryCodeBox">${saved ? code : 'Kunne ikke oprette en kode — prøv igen fra din profil.'}</div>
        ${saved ? '<button class="btn btn-ghost btn-block" id="copyCodeBtn">KOPIÉR KODE</button>' : ''}
        <label style="display:flex;align-items:center;gap:8px;margin-top:14px;font-size:13px;color:var(--text-dim);text-align:left">
          <input type="checkbox" id="savedCheckbox" style="width:18px;height:18px;flex-shrink:0">
          Jeg har gemt koden et sikkert sted
        </label>
        <button class="btn btn-primary btn-block btn-lg" id="continueBtn" style="margin-top:12px" disabled>FORTSÆT</button>
      </div>
    `);
    const checkbox = document.getElementById('savedCheckbox') as HTMLInputElement;
    const continueBtn = document.getElementById('continueBtn') as HTMLButtonElement;
    checkbox.addEventListener('change', () => {
      continueBtn.disabled = !checkbox.checked;
    });
    document.getElementById('copyCodeBtn')?.addEventListener('click', () => {
      navigator.clipboard?.writeText(code).then(() => toast('Kode kopieret'));
    });
    continueBtn.addEventListener('click', () => {
      backdrop.remove();
      resolve();
    });
  });
}

function showForgotPasswordModal(): void {
  document.querySelector('.modal-backdrop')?.remove();
  const backdrop = mountModal(`
    <div class="modal">
      <div class="hero-tag" style="margin-bottom:10px">GENDAN ADGANG</div>
      <h2>Glemt adgangskode?</h2>
      <p>Indtast dit brugernavn, din gendannelseskode, og en ny adgangskode.</p>
      <input type="text" id="recUsernameInput" maxlength="18" placeholder="Brugernavn" autocomplete="username">
      <input type="text" id="recCodeInput" placeholder="Gendannelseskode" autocomplete="off" style="margin-top:-4px;text-transform:uppercase">
      <input type="password" id="recNewPasswordInput" placeholder="Ny adgangskode" autocomplete="new-password" style="margin-top:-4px">
      <button class="btn btn-primary btn-block btn-lg" id="recSubmitBtn" style="margin-top:10px">GENDAN ADGANGSKODE</button>
      <p id="recError" style="color:var(--coral);font-size:12.5px;margin-top:10px;margin-bottom:0;display:none"></p>
      <button class="btn btn-ghost btn-block" id="backToLoginBtn" style="margin-top:10px">Tilbage til log ind</button>
    </div>
  `);
  const usernameInput = document.getElementById('recUsernameInput') as HTMLInputElement;
  const codeInput = document.getElementById('recCodeInput') as HTMLInputElement;
  const newPasswordInput = document.getElementById('recNewPasswordInput') as HTMLInputElement;
  const errorEl = document.getElementById('recError')!;
  const submitBtn = document.getElementById('recSubmitBtn') as HTMLButtonElement;
  usernameInput.focus();

  const showError = (msg: string) => {
    errorEl.textContent = msg;
    errorEl.style.display = 'block';
  };

  document.getElementById('backToLoginBtn')!.addEventListener('click', () => {
    backdrop.remove();
    showAuthModal('login');
  });

  const submit = async () => {
    const username = usernameInput.value.trim();
    const code = codeInput.value.trim();
    const newPassword = newPasswordInput.value;
    errorEl.style.display = 'none';
    if (!username || !code || !newPassword) {
      showError('Udfyld alle felter.');
      return;
    }
    if (newPassword.length < 6) {
      showError('Adgangskoden er for kort — mindst 6 tegn.');
      return;
    }
    submitBtn.disabled = true;
    submitBtn.textContent = 'GENDANNER…';
    const { error } = await redeemRecoveryCode(username, code, newPassword);
    if (error) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'GENDAN ADGANGSKODE';
      showError(error);
      return;
    }
    const { error: loginError } = await signInWithUsername(username, newPassword);
    backdrop.remove();
    if (loginError) {
      // Password reset succeeded server-side even if this particular sign-in call hiccuped — send them to the normal login screen instead of leaving them stuck.
      showAuthModal('login');
      return;
    }
    toast('Adgangskode gendannet');
    await showRecoveryCodeReveal();
  };
  submitBtn.addEventListener('click', submit);
  newPasswordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submit();
  });
}

export function closeAnyModal(): void {
  document.querySelector('.modal-backdrop')?.remove();
}
