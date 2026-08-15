import { profile, getCombinedLeaderboard, initials, clearProfile } from '../state';
import { levelInfo } from '../xp';
import { ACHIEVEMENTS } from '../achievements';
import { authAvailable, signOut } from '../auth';

export async function renderProfile(): Promise<void> {
  const main = document.getElementById('main')!;
  if (!profile) return;
  const li = levelInfo(profile.xp);
  const board = await getCombinedLeaderboard();
  const myEntry = board.find((e) => e.id === profile!.id);
  const rank = myEntry ? board.indexOf(myEntry) + 1 : null;
  main.innerHTML = `
    <div class="page">
      <div class="panel">
        <div class="profile-head">
          <div class="avatar-lg">${initials(profile.name)}</div>
          <div>
            <div class="profile-name">${profile.name}</div>
            <div class="xp-bar-track"><div class="xp-bar-fill" style="width:${li.pct}%"></div></div>
            <div class="xp-bar-label">LEVEL ${li.level} · ${li.into} / ${li.need} XP ${rank ? `· RANK #${rank} GLOBAL` : ''}</div>
          </div>
        </div>
      </div>

      <div class="section-title" style="margin-top:32px">Personal bests</div>
      <div class="pb-grid">
        <div class="pb-card"><div class="g">Reaction</div><div class="v">${profile.bestReaction != null ? Math.round(profile.bestReaction) + ' ms' : '—'}</div></div>
        <div class="pb-card"><div class="g">Best average</div><div class="v">${profile.bestAvg != null ? Math.round(profile.bestAvg) + ' ms' : '—'}</div></div>
        <div class="pb-card"><div class="g">Sessions played</div><div class="v">${profile.sessionsPlayed}</div></div>
        <div class="pb-card"><div class="g">Total XP</div><div class="v">${profile.xp}</div></div>
      </div>

      <div class="section-title" style="margin-top:32px">Achievements</div>
      <div class="ach-grid">
        ${ACHIEVEMENTS.map((a) => {
          const unlocked = profile!.unlockedAchievements.includes(a.id);
          return `<div class="ach-card ${unlocked ? '' : 'locked'}">
            <div class="ach-icon">${a.icon}</div>
            <div><div class="ach-title">${a.title}</div><div class="ach-desc">${a.desc}</div></div>
          </div>`;
        }).join('')}
      </div>

      ${authAvailable() ? '<button class="btn btn-ghost" id="signOutBtn" style="margin-top:32px">LOG UD</button>' : ''}
    </div>
  `;
  document.getElementById('signOutBtn')?.addEventListener('click', async () => {
    clearProfile();
    await signOut();
  });
}
