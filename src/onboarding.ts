import { createProfile } from './state';
import { refreshHeader } from './header';
import { navigate } from './router';
import { sendMagicLink } from './auth';

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
      <div class="hero-tag" style="margin-bottom:10px">WELCOME TO</div>
      <h2>ARCADE</h2>
      <p>Pick a name — this is how you'll show up on leaderboards and to friends.</p>
      <input type="text" id="nameInput" maxlength="18" placeholder="Your name" autocomplete="off">
      <button class="btn btn-primary btn-block btn-lg" id="enterBtn">ENTER ARCADE</button>
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

/** Step 1 of the Supabase flow: no session yet — ask for an email and send a magic link. */
export function showEmailAuthModal(): void {
  if (document.querySelector('.modal-backdrop')) return; // already showing (auth state fired twice)
  const backdrop = mountModal(`
    <div class="modal">
      <div class="hero-tag" style="margin-bottom:10px">WELCOME TO</div>
      <h2>ARCADE</h2>
      <p>Indtast din email — vi sender dig et login-link. Ingen adgangskode nødvendig.</p>
      <input type="email" id="emailInput" placeholder="din@email.dk" autocomplete="email" inputmode="email">
      <button class="btn btn-primary btn-block btn-lg" id="sendLinkBtn">SEND LOGIN-LINK</button>
      <p id="emailError" style="color:var(--coral);font-size:12.5px;margin-top:10px;margin-bottom:0;display:none"></p>
    </div>
  `);
  const input = document.getElementById('emailInput') as HTMLInputElement;
  const errorEl = document.getElementById('emailError')!;
  const btn = document.getElementById('sendLinkBtn') as HTMLButtonElement;
  input.focus();

  const showError = (msg: string) => {
    errorEl.textContent = msg;
    errorEl.style.display = 'block';
    input.style.borderColor = 'var(--coral)';
  };

  const submit = async () => {
    const email = input.value.trim();
    if (!email || !email.includes('@')) {
      showError('Indtast en gyldig email.');
      return;
    }
    btn.disabled = true;
    btn.textContent = 'SENDER…';
    const { error } = await sendMagicLink(email);
    if (error) {
      btn.disabled = false;
      btn.textContent = 'SEND LOGIN-LINK';
      showError(error);
      return;
    }
    backdrop.remove();
    showCheckEmailModal(email);
  };
  btn.addEventListener('click', submit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submit();
  });
}

function showCheckEmailModal(email: string): void {
  const backdrop = mountModal(`
    <div class="modal">
      <div class="hero-tag" style="margin-bottom:10px">TJEK DIN INDBAKKE</div>
      <h2>Login-link sendt</h2>
      <p>Vi har sendt et login-link til <b style="color:var(--text)">${email}</b>. Åbn det på denne enhed for at logge ind.</p>
      <button class="btn btn-ghost btn-block" id="backBtn">BRUG EN ANDEN EMAIL</button>
    </div>
  `);
  document.getElementById('backBtn')!.addEventListener('click', () => {
    backdrop.remove();
    showEmailAuthModal();
  });
}

/** Step 2 of the Supabase flow: session exists (magic link confirmed) but no profile row yet. */
export function showNameModal(userId: string): void {
  if (document.querySelector('.modal-backdrop')) return;
  const backdrop = mountModal(`
    <div class="modal">
      <div class="hero-tag" style="margin-bottom:10px">DU ER LOGGET IND</div>
      <h2>Vælg et navn</h2>
      <p>Sådan viser du dig på leaderboards og til venner.</p>
      <input type="text" id="nameInput" maxlength="18" placeholder="Dit navn" autocomplete="off">
      <button class="btn btn-primary btn-block btn-lg" id="enterBtn">ENTER ARCADE</button>
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
    await createProfile(name, userId);
    backdrop.remove();
    refreshHeader();
    navigate('home');
  };
  document.getElementById('enterBtn')!.addEventListener('click', enter);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') enter();
  });
}

export function closeAnyModal(): void {
  document.querySelector('.modal-backdrop')?.remove();
}
