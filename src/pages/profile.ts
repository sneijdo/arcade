import { profile, getCombinedLeaderboard, initials, clearProfile, bestScoreForGame } from '../state';
import { levelInfo } from '../xp';
import { ACHIEVEMENTS } from '../achievements';
import { authAvailable, signOut } from '../auth';
import { GAMES } from '../games/registry';
import { ScoreKinds } from '../scoring';

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
          <div class="avatar-lg">${initials(profile.name)}</div>
          <div>
            <div class="profile-name">${profile.name}</div>
            <div class="xp-bar-track"><div class="xp-bar-fill" style="width:${li.pct}%"></div></div>
            <div class="xp-bar-label">LEVEL ${li.level} · ${li.into} / ${li.need} XP ${rank ? `· PLACERING #${rank} GLOBALT (REACTION)` : ''}</div>
          </div>
        </div>
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

      ${authAvailable() ? '<button class="btn btn-ghost" id="signOutBtn" style="margin-top:32px">LOG UD</button>' : ''}
    </div>
  `;
  document.getElementById('signOutBtn')?.addEventListener('click', async () => {
    clearProfile();
    await signOut();
  });
}
