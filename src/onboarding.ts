import { createProfile } from './state';
import { refreshHeader } from './header';
import { navigate } from './router';
import { signUpWithUsername, signInWithUsername, validateUsername } from './auth';

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

type AuthMode = 'signup' | 'login';

/** Supabase flow: username + password, no email round-trip at all. */
export function showAuthModal(mode: AuthMode = 'signup'): void {
  document.querySelector('.modal-backdrop')?.remove();
  const isSignup = mode === 'signup';
  const backdrop = mountModal(`
    <div class="modal">
      <div class="hero-tag" style="margin-bottom:10px">${isSignup ? 'NY HER?' : 'VELKOMMEN TILBAGE'}</div>
      <h2>${isSignup ? 'Opret konto' : 'Log ind'}</h2>
      <p>${isSignup ? 'Vælg et brugernavn og en adgangskode — det er hele processen.' : 'Log ind med dit brugernavn og din adgangskode.'}</p>
      <input type="text" id="usernameInput" maxlength="18" placeholder="Brugernavn" autocomplete="username">
      <input type="password" id="passwordInput" placeholder="Adgangskode" autocomplete="${isSignup ? 'new-password' : 'current-password'}" style="margin-top:-4px">
      ${isSignup ? '<p style="color:var(--text-faint);font-size:11.5px;text-align:left;line-height:1.5;margin-top:-6px">Brug ikke en adgangskode du bruger til andre/vigtige ting.</p>' : ''}
      <button class="btn btn-primary btn-block btn-lg" id="submitBtn" style="margin-top:10px">${isSignup ? 'OPRET KONTO' : 'LOG IND'}</button>
      <p id="authError" style="color:var(--coral);font-size:12.5px;margin-top:10px;margin-bottom:0;display:none"></p>
      <button class="btn btn-ghost btn-block" id="toggleModeBtn" style="margin-top:10px">${isSignup ? 'Har du allerede en konto? Log ind' : 'Ny her? Opret konto'}</button>
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
      await createProfile(username, userId);
      backdrop.remove();
      refreshHeader();
      navigate('home');
    } else {
      const { error } = await signInWithUsername(username, password);
      if (error) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'LOG IND';
        showError(error);
        return;
      }
      // Session established — main.ts's auth-state listener loads the
      // profile and navigates home; nothing further to do here.
      backdrop.remove();
    }
  };
  submitBtn.addEventListener('click', submit);
  passwordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submit();
  });
}

export function closeAnyModal(): void {
  document.querySelector('.modal-backdrop')?.remove();
}
