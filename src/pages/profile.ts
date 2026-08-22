import { profile, getCombinedLeaderboard, avatarFrameHtml, clearProfile, bestScoreForGame, nameEffectHtml, duelTierForRating, DUEL_RATING_DEFAULT } from '../state';
import { levelInfo } from '../xp';
import { ACHIEVEMENTS } from '../achievements';
import { BADGES } from '../badges';
import { authAvailable, signOut, changePassword } from '../auth';
import { showRecoveryCodeReveal, showAuthModal } from '../onboarding';
import { isGuestMode } from '../storage';
import { GAMES } from '../games/registry';
import { ScoreKinds, formatScore } from '../scoring';
import { toast } from '../toast';
import { findTitle, findAvatar, AVATARS, FRAMES, TITLES, SECRET_TITLES } from '../shop';
import { canAccessEmberWard } from '../games/towerdefense/beta';
import { referralLink, syncReferrals, REFERRAL_REWARD_XP, type ReferralStats } from '../referral';

export async function renderProfile(): Promise<void> {
  const main = document.getElementById('main')!;
  if (!profile) return;
  const li = levelInfo(profile.xp);
  const board = await getCombinedLeaderboard('reaction');
  const myEntry = board.find((e) => e.id === profile!.id);
  const rank = myEntry ? board.indexOf(myEntry) + 1 : null;
  const implementedGames = GAMES.filter((g) => g.implemented && (g.id !== 'towerdefense' || canAccessEmberWard(profile!.name)));
  // Only a real, logged-in account has a meaningful referral link (a device-local guest
  // profile's id isn't attached to anything another browser could ever look up) — also
  // opportunistically grants any reward that came due since this player was last online.
  const referralStats: ReferralStats | null = authAvailable() && !isGuestMode() ? await syncReferrals() : null;
  if (!document.getElementById('main') || !profile) return; // navigated away during that await
  main.innerHTML = `
    <div class="page">
      <div class="panel">
        <div class="profile-head">
          ${avatarFrameHtml(profile.name, profile.equippedAvatar, profile.equippedFrame, 74)}
          <div class="profile-head-info">
            <h1 class="profile-name">${nameEffectHtml(profile.name, profile.equippedNameEffect)}${(() => { const t = findTitle(profile!.equippedTitle); return t ? ` <img src="${t.asset}" alt="${t.label}" class="title-badge-img profile-title-badge">` : ''; })()}</h1>
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

      <div class="shop-balance casino-teaser" style="margin-top:10px">
        <div>
          <div class="shop-balance-label">🎰 PRØV LYKKEN</div>
          <div class="shop-balance-value casino-teaser-value">Gambl din XP-saldo</div>
        </div>
        <button class="btn btn-casino" data-nav="kasino">KASINO</button>
      </div>

      <button class="btn btn-ghost" style="margin-top:10px;width:100%" data-nav="guide">ⓘ SÅDAN VIRKER DET</button>

      <div class="shop-collection-row" style="margin-top:12px">
        <span>🎭 ${profile.unlockedAvatars.filter((id) => findAvatar(id)).length} / ${AVATARS.length} avatarer</span>
        <span>🖼️ ${profile.unlockedFrames.length} / ${FRAMES.length} rammer</span>
        <span>🏷️ ${profile.unlockedTitles.filter((id) => findTitle(id)).length} / ${TITLES.length + SECRET_TITLES.length} titler</span>
      </div>

      <h2 class="section-title" style="margin-top:32px">Personlige rekorder</h2>
      <div class="pb-grid">
        ${implementedGames
          .map((g) => {
            const best = bestScoreForGame(g.id);
            const kind = g.scoreKind ? ScoreKinds[g.scoreKind] : null;
            const val = best != null && kind ? formatScore(kind, best) : '—';
            return `<div class="pb-card"><div class="g">${g.title}</div><div class="v">${val}</div></div>`;
          })
          .join('')}
        <div class="pb-card"><div class="g">Runder spillet</div><div class="v">${profile.sessionsPlayed}</div></div>
        <div class="pb-card"><div class="g">Total XP</div><div class="v">${profile.xp}</div></div>
        <div class="pb-card"><div class="g">Nuværende stime</div><div class="v">🔥 ${profile.currentStreak}</div></div>
        <div class="pb-card"><div class="g">Længste stime</div><div class="v">${profile.longestStreak}</div></div>
        <div class="pb-card"><div class="g">🧠 Quiz Duel</div><div class="v">${profile.duelWins}-${profile.duelLosses}-${profile.duelDraws}</div></div>
        <div class="pb-card"><div class="g">Duel-rang</div><div class="v">${duelTierForRating(profile.duelRating ?? DUEL_RATING_DEFAULT).icon} ${profile.duelRating ?? DUEL_RATING_DEFAULT}</div></div>
      </div>

      <h2 class="section-title" style="margin-top:32px">Bedrifter</h2>
      <div class="ach-grid">
        ${ACHIEVEMENTS.map((a) => {
          const unlocked = profile!.unlockedAchievements.includes(a.id);
          return `<div class="ach-card ${unlocked ? '' : 'locked'}">
            <div class="ach-icon">${a.icon}</div>
            <div><div class="ach-title">${a.title}</div><div class="ach-desc">${a.desc}</div></div>
          </div>`;
        }).join('')}
      </div>

      <h2 class="section-title" style="margin-top:32px">Badges (${profile.unlockedBadges.length} / ${BADGES.length})</h2>
      <div class="badge-grid">
        ${BADGES.map((b) => {
          const unlocked = profile!.unlockedBadges.includes(b.id);
          return `<div class="badge-card rarity-${b.rarity} ${unlocked ? '' : 'locked'}">
            <img src="${b.asset}" alt="${b.name}" class="badge-icon">
            <div class="badge-name">${unlocked ? b.name : '???'}</div>
            <div class="badge-desc">${b.desc}</div>
          </div>`;
        }).join('')}
      </div>

      ${
        referralStats
          ? `
      <h2 class="section-title" style="margin-top:32px">Promover en ven</h2>
      <div class="panel referral-panel">
        <p>Inviter en ven. Når de opretter en rigtig konto via dit link og spiller 4 spil, får du ${REFERRAL_REWARD_XP} XP. Ingen grænse for hvor mange venner du kan invitere.</p>
        <div class="referral-link-row">
          <input type="text" id="referralLinkInput" class="settings-input" readonly value="${referralLink()}">
          <button class="btn btn-primary" id="copyReferralBtn">KOPIÉR LINK</button>
        </div>
        <div class="referral-stats-row">
          <span>🤝 ${referralStats.rewardedCount} ${referralStats.rewardedCount === 1 ? 'ven belønnet' : 'venner belønnet'}</span>
          <span>⏳ ${referralStats.pendingCount} afventer stadig 4 spil</span>
        </div>
      </div>
      `
          : ''
      }

      ${
        authAvailable() && isGuestMode()
          ? `
      <h2 class="section-title" style="margin-top:32px">Gem din fremgang</h2>
      <div class="panel guest-upsell-panel">
        <p>Du spiller som gæst, din fremgang findes kun på denne enhed. Opret en konto for at gemme den på tværs af enheder og komme på det globale leaderboard.</p>
        <button class="btn btn-primary btn-block" id="createAccountBtn">OPRET KONTO</button>
      </div>
      `
          : authAvailable()
            ? `
      <h2 class="section-title" style="margin-top:32px">Kontosikkerhed</h2>
      <div class="panel settings-panel">
        <div class="settings-block">
          <div class="settings-label">Skift adgangskode</div>
          <input type="password" id="newPasswordInput" placeholder="Ny adgangskode" class="settings-input" autocomplete="new-password">
          <button class="btn btn-ghost" id="changePasswordBtn">SKIFT ADGANGSKODE</button>
          <p id="passwordChangeMsg" class="settings-msg" style="display:none"></p>
        </div>
        <div class="settings-block">
          <div class="settings-label">Gendannelseskode</div>
          <p class="settings-hint">Mistet din kode? Generér en ny, den gamle holder op med at virke.</p>
          <button class="btn btn-ghost" id="regenCodeBtn">GENERÉR NY KODE</button>
        </div>
      </div>
      <button class="btn btn-ghost" id="signOutBtn" style="margin-top:16px">LOG UD</button>
      `
            : ''
      }
    </div>
  `;
  document.getElementById('copyReferralBtn')?.addEventListener('click', () => {
    const input = document.getElementById('referralLinkInput') as HTMLInputElement | null;
    if (!input) return;
    input.select();
    navigator.clipboard?.writeText(input.value).then(() => toast('Link kopieret'));
  });
  document.getElementById('createAccountBtn')?.addEventListener('click', () => showAuthModal('signup'));
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
    if (!newPassword) {
      passwordChangeMsg.textContent = 'Indtast en ny adgangskode.';
      passwordChangeMsg.style.color = 'var(--coral)';
      passwordChangeMsg.style.display = 'block';
      return;
    }
    if (newPassword.length < 6) {
      passwordChangeMsg.textContent = 'Adgangskoden er for kort, mindst 6 tegn.';
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
