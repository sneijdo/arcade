import { profile, todayLocalDateString } from '../state';
import { renderGameGrid } from './gameGrid';
import { getTodayChallenge } from '../dailyChallenge';
import { GAMES } from '../games/registry';
import { ScoreKinds } from '../scoring';
import { levelInfo } from '../xp';

/** Level/XP progress is otherwise only visible as a tiny header badge — surfaced here so "what am I working toward" has an answer on the one screen everyone lands on. */
function renderProgressCard(): string {
  if (!profile) return '';
  const li = levelInfo(profile.xp);
  const toGo = li.need - li.into;
  return `
    <div class="home-xp-card">
      <div class="home-xp-row">
        <div class="home-xp-level">LEVEL ${li.level}</div>
        <div class="home-xp-amount mono">${li.into} / ${li.need} XP</div>
      </div>
      <div class="home-xp-track"><div class="home-xp-fill" style="width:${li.pct}%"></div></div>
      <div class="home-xp-sub">${toGo} XP til level ${li.level + 1}</div>
    </div>
  `;
}

function renderDailyChallengeCard(): string {
  const challenge = getTodayChallenge(todayLocalDateString());
  if (!challenge || !profile) return '';
  const game = GAMES.find((g) => g.id === challenge.gameId);
  const kind = game?.scoreKind ? ScoreKinds[game.scoreKind] : null;
  const completed = profile.dailyChallengeDate === todayLocalDateString();
  const targetText = kind ? `${kind.format(challenge.target)}${kind.unit}` : challenge.target;
  return `
    <div class="daily-challenge ${completed ? 'completed' : ''}">
      <div class="daily-challenge-icon">${completed ? '✅' : game?.icon ?? '🎯'}</div>
      <div class="daily-challenge-body">
        <div class="daily-challenge-label">DAGENS UDFORDRING</div>
        <div class="daily-challenge-title">${completed ? 'Gennemført!' : `${challenge.gameTitle} — nå ${targetText}`}</div>
        <div class="daily-challenge-reward">${completed ? `+${challenge.xpReward} XP optjent` : `Belønning: +${challenge.xpReward} XP`}</div>
      </div>
      ${completed ? '' : `<button class="btn btn-primary" data-nav="play-${challenge.gameId}">SPIL</button>`}
    </div>
  `;
}

export async function renderHome(): Promise<void> {
  const main = document.getElementById('main')!;
  if (!profile) return;
  main.innerHTML = `
    <div class="page">
      <section class="hero">
        <div class="hero-tag">SPIL · KONKURRER · DOMINÉR</div>
        <div class="hero-word">ARCADE</div>
        <p class="hero-sub">Hurtige spil. Rigtige leaderboards. Ét forsøg mere er altid ét klik væk.</p>
        <div class="hero-ctas">
          <button class="btn btn-primary btn-lg" data-nav="games">▶ SPIL NU</button>
          <button class="btn btn-ghost btn-lg" data-nav="leaderboard">SE LEADERBOARD</button>
        </div>
      </section>

      ${renderProgressCard()}
      ${renderDailyChallengeCard()}

      <div class="section-label" style="margin-top:44px">Hurtigt i gang</div>
      <div class="section-title">Spil</div>
      <div class="game-grid" id="homeGameGrid"></div>

      <div class="footer-note">ARCADE · BYGGET TIL ÉT FORSØG MERE</div>
    </div>
  `;
  renderGameGrid(document.getElementById('homeGameGrid')!);
}
