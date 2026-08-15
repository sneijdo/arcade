import { profile, initials } from './state';
import { levelInfo } from './xp';
import { Sound } from './sound';

function iconUnmuted(): string {
  return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M3 9v6h4l5 5V4L7 9H3z" fill="currentColor"/><path d="M16 8a5 5 0 010 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/></svg>';
}
function iconMuted(): string {
  return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M3 9v6h4l5 5V4L7 9H3z" fill="currentColor"/><path d="M15 9l6 6M21 9l-6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
}

export function refreshHeader(): void {
  if (!profile) return;
  const li = levelInfo(profile.xp);
  const avatarEl = document.getElementById('avatarInitial');
  const nameEl = document.getElementById('headerName');
  const levelEl = document.getElementById('headerLevel');
  const xpEl = document.getElementById('headerXp');
  const muteBtn = document.getElementById('muteBtn');
  if (avatarEl) avatarEl.textContent = initials(profile.name);
  if (nameEl) nameEl.textContent = profile.name;
  if (levelEl) levelEl.textContent = String(li.level);
  if (xpEl) xpEl.textContent = profile.xp + ' XP';
  if (muteBtn) muteBtn.innerHTML = Sound.isMuted() ? iconMuted() : iconUnmuted();
}
