import { GAMES } from './games/registry';
import { ScoreKinds, formatScore } from './scoring';
import { Sound } from './sound';
import { Haptics } from './haptics';

/**
 * The biggest celebratory moment in the app — a player has just taken the ALL-TIME #1 spot on a
 * game's leaderboard (see the isNewAllTimeRecord check in finishGameSession, state.ts, and the
 * mirrored check in reaction.ts's bespoke finish flow). Appended straight to <body>, independent
 * of whatever result screen the calling game then renders underneath, so this one integration
 * point covers every game without touching each one's own drawFinalScreen().
 */
export function showTotalRecordReveal(gameId: string, score: number): void {
  const game = GAMES.find((g) => g.id === gameId);
  if (!game) return;
  const kind = game.scoreKind ? ScoreKinds[game.scoreKind] : null;
  const scoreText = kind ? formatScore(kind, score) : `${Math.round(score)}`;

  // Only one at a time — see the equivalent guard in showPurchaseReveal (pages/shop.ts).
  document.querySelector('.record-reveal')?.remove();

  const particleCount = 60;
  const particles = Array.from({ length: particleCount }, (_, i) => {
    const angle = (i / particleCount) * 360 + (Math.random() * 10 - 5);
    const dist = 110 + Math.random() * 190;
    const rad = (angle * Math.PI) / 180;
    const tx = Math.cos(rad) * dist;
    const ty = Math.sin(rad) * dist;
    const size = 5 + Math.random() * 7;
    const rot = 180 + Math.random() * 720;
    const delay = Math.random() * 0.16;
    const palette = ['var(--gold)', 'var(--lime)', 'var(--text)'];
    const color = palette[i % palette.length];
    return `<div class="record-particle" style="--tx:${tx.toFixed(1)}px;--ty:${ty.toFixed(1)}px;--size:${size.toFixed(1)}px;--rot:${rot.toFixed(0)}deg;--delay:${delay.toFixed(2)}s;--pcolor:${color}"></div>`;
  }).join('');

  const el = document.createElement('div');
  el.className = 'record-reveal';
  el.innerHTML = `
    <div class="record-flash"></div>
    <div class="record-stage">
      <div class="record-rays"></div>
      <div class="record-burst-ring"></div>
      <div class="record-particles">${particles}</div>
      <div class="record-icon">${game.icon}</div>
      <div class="record-kicker">🏆 NY TOTALREKORD</div>
      <div class="record-game">${game.title}</div>
      <div class="record-score">${scoreText}</div>
      <div class="record-sub">Du er nu #1 nogensinde</div>
    </div>
    <div class="record-hint">TRYK FOR AT FORTSÆTTE</div>
  `;
  document.body.appendChild(el);

  Sound.totalRecord();
  Haptics.legendary();

  let dismissed = false;
  const dismiss = (): void => {
    if (dismissed) return;
    dismissed = true;
    el.classList.remove('in');
    el.classList.add('closing');
    setTimeout(() => el.remove(), 300);
  };
  el.addEventListener('click', dismiss);
  const autoTimer = setTimeout(dismiss, 3200);
  el.addEventListener('click', () => clearTimeout(autoTimer), { once: true });

  // Two rAFs so the pre-transition state paints before .in flips every transition/animation
  // on — see the identical comment in showPurchaseReveal (pages/shop.ts) for why one isn't enough.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      el.classList.add('in');
      el.classList.add('shake');
    });
  });
}
