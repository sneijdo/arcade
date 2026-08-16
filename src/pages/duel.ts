import { profile, getPlayerMeta, escapeHtml, avatarFrameHtml, finishDuelSession } from '../state';
import { Sound } from '../sound';
import { Haptics } from '../haptics';
import { fetchChallenge, writeDuelResult, type DuelResult } from '../duel/challenges';
import { challengePlayer } from '../duel/inviteBanner';
import { onPresenceChange } from '../activity';
import { DuelEngine, GRID_W, GRID_H, type Slot, type MatchPhase, type MatchSnapshot, type MatchOutcome, type Dir } from '../duel/match';

/** Colors match tokens.css's --lime/--coral — canvas can't read CSS custom properties without a
 * getComputedStyle round-trip, so these are duplicated as plain hex rather than adding that cost
 * to every animation frame. "You" is always lime, "them" is always coral, regardless of which
 * side (sender/recipient) either player actually is in the match record. */
const MY_COLOR = '#c9f73e';
const OPP_COLOR = '#ff5d7a';
const CELL_PX = 20;
const SWIPE_THRESHOLD = 20;

const ARROW_KEY_DIRS: Record<string, Dir> = { ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 }, ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 } };

let engine: DuelEngine | null = null;
let currentMatchId = '';
let mySlot: Slot = 'sender';
let oppId = '';
let oppName = '';
let oppAvatar: string | null = null;
let oppFrame: string | null = null;
let swipeStart: { x: number; y: number } | null = null;
let swipeArmed = false;

function main(): HTMLElement {
  return document.getElementById('main')!;
}
function arenaEl(): HTMLElement | null {
  return document.getElementById('duelArena');
}
function canvasEl(): HTMLCanvasElement | null {
  return document.getElementById('duelCanvas') as HTMLCanvasElement | null;
}

/** The DOM-presence bail-out idiom used throughout this app (see snake.ts's tick(), swerve.ts's
 * loop()) — there's no unmount hook, so every engine callback checks its own page is still on
 * screen before touching it, and tears the engine down for good the first time it isn't. */
function stillHere(): boolean {
  if (arenaEl()) return true;
  if (engine) {
    engine.destroy();
    engine = null;
  }
  return false;
}

export async function renderDuelMatch(matchId: string): Promise<void> {
  if (engine) {
    engine.destroy();
    engine = null;
  }
  main().innerHTML = `<div class="page"><div class="duel-loading">Indlæser duel…</div></div>`;
  if (!profile) return;

  const challenge = await fetchChallenge(matchId);
  const stillOnDuelBoot = document.querySelector('.duel-loading');
  if (!stillOnDuelBoot) return; // navigated away while the fetch was in flight

  const iAmParticipant = challenge && (challenge.senderId === profile.id || challenge.recipientId === profile.id);
  if (!challenge || challenge.status !== 'accepted' || !iAmParticipant) {
    drawInactive();
    return;
  }

  currentMatchId = matchId;
  mySlot = challenge.senderId === profile.id ? 'sender' : 'recipient';
  oppId = mySlot === 'sender' ? challenge.recipientId : challenge.senderId;
  const oppMeta = await getPlayerMeta(oppId);
  if (!document.querySelector('.duel-loading')) return;
  oppName = oppMeta?.name ?? (mySlot === 'recipient' ? challenge.senderName : 'Modstander');
  oppAvatar = oppMeta?.avatar ?? (mySlot === 'recipient' ? challenge.senderAvatar : null);
  oppFrame = oppMeta?.frame ?? (mySlot === 'recipient' ? challenge.senderFrame : null);

  drawShell(matchId);
}

function drawInactive(): void {
  main().innerHTML = `
    <div class="page">
      <a href="#/activity" data-nav="activity" class="btn btn-ghost" style="margin-bottom:16px">← TILBAGE TIL AKTIVITET</a>
      <div class="section-label">Duel</div>
      <h1 class="section-title">Ikke længere aktiv</h1>
      <div style="color:var(--text-dim);font-size:13.5px">Denne duel findes ikke længere, er allerede afgjort, eller du er ikke en del af den.</div>
    </div>
  `;
}

function drawShell(matchId: string): void {
  main().innerHTML = `
    <div class="page">
      <div class="game-shell">
        <div class="game-topbar">
          <span>🏍 LIGHT CYCLES</span>
          <span class="mono" id="duelStatus">Venter på modstander…</span>
        </div>
        <div class="duel-players">
          <div class="duel-player-chip me">${avatarFrameHtml(profile!.name, profile!.equippedAvatar, profile!.equippedFrame, 30)}<span>${escapeHtml(profile!.name)}</span></div>
          <span class="duel-vs">VS</span>
          <div class="duel-player-chip">${avatarFrameHtml(oppName, oppAvatar, oppFrame, 30)}<span>${escapeHtml(oppName)}</span></div>
        </div>
        <div class="arena duel-arena" id="duelArena">
          <div class="arena-inner"><div class="arena-title">Venter på modstander…</div></div>
        </div>
      </div>
    </div>
  `;
  startEngine(matchId);
}

function drawPlayArea(): void {
  const arena = arenaEl();
  if (!arena) return;
  arena.innerHTML = `
    <div class="duel-field">
      <canvas id="duelCanvas" width="${GRID_W * CELL_PX}" height="${GRID_H * CELL_PX}"></canvas>
      <div class="duel-leadin" id="duelLeadin"></div>
    </div>
  `;
  wireControls();
}

function startEngine(matchId: string): void {
  if (!profile) return;
  engine = new DuelEngine({
    matchId,
    myId: profile.id,
    mySlot,
    oppId,
    onPhaseChange: (phase) => {
      if (!stillHere()) return;
      handlePhaseChange(phase);
    },
    onLeadIn: (msLeft) => {
      if (!stillHere()) return;
      const el = document.getElementById('duelLeadin');
      if (el) el.textContent = msLeft <= 0 ? '' : String(Math.ceil(msLeft / 1000));
    },
    onTick: (snap) => {
      if (!stillHere()) return;
      drawFrame(snap);
    },
    onEnd: (outcome) => {
      if (!stillHere()) return;
      void handleEnd(outcome);
    },
  });
}

function handlePhaseChange(phase: MatchPhase): void {
  const statusEl = document.getElementById('duelStatus');
  if (phase === 'leadin') {
    if (statusEl) statusEl.textContent = 'Klar…';
    drawPlayArea();
    Sound.countdown();
  } else if (phase === 'playing') {
    if (statusEl) statusEl.textContent = 'KAMP I GANG';
    const el = document.getElementById('duelLeadin');
    if (el) el.textContent = '';
  }
}

function wireControls(): void {
  const canvas = canvasEl();
  if (!canvas) return;
  canvas.addEventListener('pointerdown', (e) => {
    if (!e.isPrimary) return;
    e.preventDefault();
    swipeStart = { x: e.clientX, y: e.clientY };
    swipeArmed = true;
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!swipeArmed || !swipeStart || !e.isPrimary) return;
    const dx = e.clientX - swipeStart.x;
    const dy = e.clientY - swipeStart.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_THRESHOLD) return;
    engine?.queueTurn(Math.abs(dx) > Math.abs(dy) ? { x: dx > 0 ? 1 : -1, y: 0 } : { x: 0, y: dy > 0 ? 1 : -1 });
    swipeStart = { x: e.clientX, y: e.clientY };
  });
  const endSwipe = () => {
    swipeArmed = false;
    swipeStart = null;
  };
  canvas.addEventListener('pointerup', endSwipe);
  canvas.addEventListener('pointercancel', endSwipe);

  document.removeEventListener('keydown', handleKeyDown);
  document.addEventListener('keydown', handleKeyDown);
}

function handleKeyDown(e: KeyboardEvent): void {
  if (!canvasEl()) return; // stale listener from a match the player already left — see stillHere()
  const dir = ARROW_KEY_DIRS[e.key];
  if (!dir || !engine) return;
  e.preventDefault();
  engine.queueTurn(dir);
}

function drawTrail(ctx: CanvasRenderingContext2D, trail: { x: number; y: number }[], color: string): void {
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  for (const c of trail) ctx.fillRect(c.x * CELL_PX + 1, c.y * CELL_PX + 1, CELL_PX - 2, CELL_PX - 2);
  const head = trail[trail.length - 1];
  ctx.shadowBlur = 16;
  ctx.fillRect(head.x * CELL_PX, head.y * CELL_PX, CELL_PX, CELL_PX);
  ctx.shadowBlur = 0;
}

function drawFrame(snap: MatchSnapshot): void {
  const canvas = canvasEl();
  const ctx = canvas?.getContext('2d');
  if (!canvas || !ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  for (let x = 0; x <= GRID_W; x++) ctx.fillRect(x * CELL_PX - 0.5, 0, 1, canvas.height);
  for (let y = 0; y <= GRID_H; y++) ctx.fillRect(0, y * CELL_PX - 0.5, canvas.width, 1);

  const oppSlot: Slot = mySlot === 'sender' ? 'recipient' : 'sender';
  drawTrail(ctx, snap.trails[oppSlot], OPP_COLOR);
  drawTrail(ctx, snap.trails[mySlot], MY_COLOR);
}

async function handleEnd(outcome: MatchOutcome): Promise<void> {
  document.removeEventListener('keydown', handleKeyDown);
  // The match itself is decided — release the per-match Realtime channel now rather than
  // leaving it subscribed until the player happens to navigate elsewhere (stillHere()'s
  // destroy-on-teardown only fires on the *next* callback, which nothing here still triggers).
  engine?.destroy();
  engine = null;
  const iWon = outcome.winner === mySlot;
  const isDraw = outcome.winner === 'draw' || outcome.winner === null;
  const dbResult: DuelResult = isDraw ? 'draw' : outcome.winner === 'sender' ? 'sender_win' : 'recipient_win';
  const outcomeLabel: 'win' | 'loss' | 'draw' = isDraw ? 'draw' : iWon ? 'win' : 'loss';

  if (isDraw) Sound.mistake();
  else if (iWon) {
    Sound.complete();
    Haptics.personalBest();
  } else {
    Sound.death();
    Haptics.miss();
  }

  // Recorded even if the player has already navigated away mid-resolution (e.g. right
  // after a forfeit win) — this is bookkeeping, not a render, so it doesn't need stillHere().
  const { xpGain } = await finishDuelSession(outcomeLabel, oppName);
  await writeDuelResult(currentMatchId, dbResult);
  if (stillHere()) drawResult(outcomeLabel, xpGain, outcome.reason);
}

function drawResult(outcome: 'win' | 'loss' | 'draw', xpGain: number, reason: MatchOutcome['reason']): void {
  const label = outcome === 'win' ? 'SEJR' : outcome === 'loss' ? 'NEDERLAG' : 'UAFGJORT';
  const color = outcome === 'win' ? 'var(--lime)' : outcome === 'loss' ? 'var(--coral)' : 'var(--text-dim)';
  const reasonLabel = reason === 'forfeit' ? (outcome === 'win' ? 'Modstanderen forlod duellen' : 'Du forlod duellen') : reason === 'desync' ? 'Forbindelsen tabte synkronisering' : outcome === 'draw' ? 'Frontal kollision' : 'Styrt';
  const w = (profile?.duelWins ?? 0);
  const l = (profile?.duelLosses ?? 0);
  const d = (profile?.duelDraws ?? 0);

  main().innerHTML = `
    <div class="page">
      <div class="game-shell">
        <div class="final-wrap">
          <div class="final-label">Resultat</div>
          <div class="final-score duel-result" style="color:${color};font-size:clamp(40px,10vw,64px)">${label}</div>
          <div class="final-rating" style="color:${color}">${reasonLabel}</div>
          <div class="xp-toast">✦ +${xpGain} XP optjent</div>

          <div class="final-stats">
            <div class="fstat"><div class="n">${w}</div><div class="l">Sejre</div></div>
            <div class="fstat"><div class="n">${l}</div><div class="l">Nederlag</div></div>
            <div class="fstat"><div class="n">${d}</div><div class="l">Uafgjort</div></div>
            <div class="fstat"><div class="n">+${xpGain}</div><div class="l">XP optjent</div></div>
          </div>

          <div class="final-ctas">
            <button class="btn btn-ghost btn-lg" data-nav="activity">TILBAGE TIL AKTIVITET</button>
            <button class="btn btn-primary btn-lg" id="duelRematchBtn">UDFORDR IGEN</button>
          </div>
        </div>
      </div>
    </div>
  `;

  const rematchBtn = document.getElementById('duelRematchBtn') as HTMLButtonElement | null;
  if (rematchBtn) {
    const stopPresence = onPresenceChange((users) => {
      if (!document.getElementById('duelRematchBtn')) {
        stopPresence();
        return;
      }
      const stillOnline = users.some((u) => u.id === oppId);
      rematchBtn.disabled = !stillOnline;
      rematchBtn.title = stillOnline ? '' : `${oppName} er ikke online længere`;
    });
    rematchBtn.addEventListener('click', () => {
      Sound.click();
      void challengePlayer({ id: oppId, name: oppName, avatar: oppAvatar });
      rematchBtn.disabled = true;
      rematchBtn.textContent = 'UDFORDRING SENDT';
    });
  }
}
