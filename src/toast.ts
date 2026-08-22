export function toast(html: string, cls = ''): void {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = 'toast ' + cls;
  el.innerHTML = html;
  container.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity .3s, transform .3s';
    el.style.opacity = '0';
    el.style.transform = 'translateX(20px)';
    setTimeout(() => el.remove(), 320);
  }, 3200);
}

let lastNetworkErrorToastAt = 0;

/** A failed read used to just log to the console and quietly render as empty/zero — an
 * empty leaderboard or Activity feed then looks identical to "nobody's played yet" instead
 * of "something's actually broken." This gives failed reads a visible signal instead,
 * without needing every call site to build its own message. Debounced to one toast per 4s
 * so a genuine outage (several parallel reads failing at once, e.g. loading the leaderboard
 * grid) doesn't stack a toast per failed call. */
export function toastNetworkError(): void {
  const now = Date.now();
  if (now - lastNetworkErrorToastAt < 4000) return;
  lastNetworkErrorToastAt = now;
  toast(`<span class="toast-icon">⚠️</span> Kunne ikke hente data, tjek din forbindelse`);
}

let lastSaveErrorToastAt = 0;

/** A failed profile write used to just log to the console and be silently discarded — the UI
 * kept showing whatever the in-memory optimistic change was (new XP, a "purchased" item, a new
 * personal best) even though none of it actually persisted, so the player only found out on
 * their next reload, if ever. Same debounce shape as toastNetworkError() so a run of saves
 * failing back-to-back (finishGameSession alone calls saveProfile twice) doesn't stack toasts. */
export function toastSaveError(): void {
  const now = Date.now();
  if (now - lastSaveErrorToastAt < 4000) return;
  lastSaveErrorToastAt = now;
  toast(`<span class="toast-icon">⚠️</span> Kunne ikke gemme dine ændringer, prøv igen`);
}
