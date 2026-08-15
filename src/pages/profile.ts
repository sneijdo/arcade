import { profile, getCombinedLeaderboard, avatarContent, clearProfile, bestScoreForGame } from '../state';
import { levelInfo } from '../xp';
import { ACHIEVEMENTS } from '../achievements';
import { authAvailable, signOut, changePassword } from '../auth';
import { showRecoveryCodeReveal } from '../onboarding';
import { GAMES } from '../games/registry';
import { ScoreKinds } from '../scoring';
import { toast } from '../toast';
import { findTitle } from '../shop';

export async function renderProfile(): Promise<void> {
  const main = document.getElementById('main')!;
  if (!profile) return;
  const li = levelInfo(profile.xp);
  const board = await getCombinedLeaderboard('reaction');
  const myEntry = board.find((e) => e.id === profile!.id);
  const rank = myEntry ? board.indexOf(myEntry) + 1 : null;
  const implementedGames = GAMES.filter((g) => g.implemented);
  main.innerHTML = `
    <div class="page">
      <div class="panel">
        <div class="profile-head">
          <div class="avatar-lg">${avatarContent(profile.name, profile.equippedAvatar)}</div>
          <div>
            <div class="profile-name">${profile.name}${(() => { const t = findTitle(profile!.equippedTitle); return t ? ` <span class="profile-title-tag">${t.label}</span>` : ''; })()}</div>
            <div class="xp-bar-track"><div class="xp-bar-fill" style="width:${li.pct}%"></div></div>
            <div class="xp-bar-label">LEVEL ${li.level} · ${li.into} / ${li.need} XP ${rank ? `· PLACERING #${rank} GLOBALT (REACTION)` : ''}</div>
          </div>
        </div>
      </div>

      <div class="shop-balance" style="margin-top:16px">
        <div>
          <div class="shop-balance-label">XP-SALDO TIL BUTIKKEN</div>
          <div class="shop-balance-value">✦ ${profile.xpBalance} XP</div>
        </div>
        <button class="btn btn-primary" data-nav="shop">GÅ TIL BUTIK</button>
      </div>

      <div class="section-title" style="margin-top:32px">Personlige rekorder</div>
      <div class="pb-grid">
        ${implementedGames
          .map((g) => {
            const best = bestScoreForGame(g.id);
            const kind = g.scoreKind ? ScoreKinds[g.scoreKind] : null;
            const val = best != null && kind ? `${kind.format(best)} ${kind.unit}` : '—';
            return `<div class="pb-card"><div class="g">${g.title}</div><div class="v">${val}</div></div>`;
          })
          .join('')}
        <div class="pb-card"><div class="g">Runder spillet</div><div class="v">${profile.sessionsPlayed}</div></div>
        <div class="pb-card"><div class="g">Total XP</div><div class="v">${profile.xp}</div></div>
        <div class="pb-card"><div class="g">Nuværende stime</div><div class="v">🔥 ${profile.currentStreak}</div></div>
        <div class="pb-card"><div class="g">Længste stime</div><div class="v">${profile.longestStreak}</div></div>
      </div>

      <div class="section-title" style="margin-top:32px">Bedrifter</div>
      <div class="ach-grid">
        ${ACHIEVEMENTS.map((a) => {
          const unlocked = profile!.unlockedAchievements.includes(a.id);
          return `<div class="ach-card ${unlocked ? '' : 'locked'}">
            <div class="ach-icon">${a.icon}</div>
            <div><div class="ach-title">${a.title}</div><div class="ach-desc">${a.desc}</div></div>
          </div>`;
        }).join('')}
      </div>

      ${
        authAvailable()
          ? `
      <div class="section-title" style="margin-top:32px">Kontosikkerhed</div>
      <div class="panel settings-panel">
        <div class="settings-block">
          <div class="settings-label">Skift adgangskode</div>
          <input type="password" id="newPasswordInput" placeholder="Ny adgangskode" class="settings-input" autocomplete="new-password">
          <button class="btn btn-ghost" id="changePasswordBtn">SKIFT ADGANGSKODE</button>
          <p id="passwordChangeMsg" class="settings-msg" style="display:none"></p>
        </div>
        <div class="settings-block">
          <div class="settings-label">Gendannelseskode</div>
          <p class="settings-hint">Mistet din kode? Generér en ny — den gamle holder op med at virke.</p>
          <button class="btn btn-ghost" id="regenCodeBtn">GENERÉR NY KODE</button>
        </div>
      </div>
      <button class="btn btn-ghost" id="signOutBtn" style="margin-top:16px">LOG UD</button>
      `
          : ''
      }
    </div>
  `;
  document.getElementById('signOutBtn')?.addEventListener('click', async () => {
    clearProfile();
    await signOut();
  });

  const newPasswordInput = document.getElementById('newPasswordInput') as HTMLInputElement | null;
  const changePasswordBtn = document.getElementById('changePasswordBtn') as HTMLButtonElement | null;
  const passwordChangeMsg = document.getElementById('passwordChangeMsg');
  changePasswordBtn?.addEventListener('click', async () => {
    if (!newPasswordInput || !passwordChangeMsg) return;
    const newPassword = newPasswordInput.value;
    passwordChangeMsg.style.display = 'none';
    if (newPassword.length < 6) {
      passwordChangeMsg.textContent = 'Adgangskoden er for kort — mindst 6 tegn.';
      passwordChangeMsg.style.color = 'var(--coral)';
      passwordChangeMsg.style.display = 'block';
      return;
    }
    changePasswordBtn.disabled = true;
    changePasswordBtn.textContent = 'SKIFTER…';
    const { error } = await changePassword(newPassword);
    changePasswordBtn.disabled = false;
    changePasswordBtn.textContent = 'SKIFT ADGANGSKODE';
    if (error) {
      passwordChangeMsg.textContent = error;
      passwordChangeMsg.style.color = 'var(--coral)';
      passwordChangeMsg.style.display = 'block';
      return;
    }
    newPasswordInput.value = '';
    passwordChangeMsg.textContent = 'Adgangskode skiftet.';
    passwordChangeMsg.style.color = 'var(--lime)';
    passwordChangeMsg.style.display = 'block';
    toast('Adgangskode skiftet');
  });

  document.getElementById('regenCodeBtn')?.addEventListener('click', async () => {
    await showRecoveryCodeReveal();
  });
}
