import { profile, getPlayerMeta, escapeHtml, avatarFrameHtml, finishDuelSession } from '../state';
import { Sound } from '../sound';
import { Haptics } from '../haptics';
import { fetchChallenge, writeDuelResult, type DuelResult } from '../duel/challenges';
import { challengePlayer } from '../duel/inviteBanner';
import { onPresenceChange } from '../activity';
import { QuizEngine, QUESTION_TIME_MS, type Slot, type QuizPhase, type RoundState, type RevealState, type MatchOutcome } from '../duel/quizEngine';
import { QUIZ_CATEGORIES } from '../duel/questionBank';

let engine: QuizEngine | null = null;
let currentMatchId = '';
let mySlot: Slot = 'sender';
let oppId = '';
let oppName = '';
let oppAvatar: string | null = null;
let oppFrame: string | null = null;
let myAnswerThisRound: number | null = null;

function main(): HTMLElement {
  return document.getElementById('main')!;
}
function arenaEl(): HTMLElement | null {
  return document.getElementById('duelArena');
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
  if (!document.querySelector('.duel-loading')) return; // navigated away while the fetch was in flight

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
          <span>🧠 QUIZ DUEL</span>
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

function startEngine(matchId: string): void {
  if (!profile) return;
  engine = new QuizEngine({
    matchId,
    myId: profile.id,
    mySlot,
    oppId,
    onPhaseChange: (phase) => {
      if (!stillHere()) return;
      handlePhaseChange(phase);
    },
    onCategoryState: (mine, theirs) => {
      if (!stillHere()) return;
      renderCategoryPicker(mine, theirs);
    },
    onRound: (state) => {
      if (!stillHere()) return;
      renderQuestion(state);
    },
    onReveal: (state) => {
      if (!stillHere()) return;
      renderReveal(state);
    },
    onEnd: (outcome) => {
      if (!stillHere()) return;
      void handleEnd(outcome);
    },
  });
}

function handlePhaseChange(phase: QuizPhase): void {
  const statusEl = document.getElementById('duelStatus');
  if (phase === 'category') {
    if (statusEl) statusEl.textContent = 'VÆLG KATEGORI';
  } else if (phase === 'leadin') {
    if (statusEl) statusEl.textContent = 'KLAR…';
    renderLeadin();
    Sound.countdown();
  } else if (phase === 'question') {
    if (statusEl) statusEl.textContent = 'QUIZ I GANG';
  }
}

function renderCategoryPicker(mine: string | null, theirs: string | null): void {
  const arena = arenaEl();
  if (!arena) return;
  if (mine) {
    const cat = QUIZ_CATEGORIES.find((c) => c.id === mine);
    arena.innerHTML = `
      <div class="arena-inner">
        <div class="arena-title">${cat?.icon ?? ''} Du valgte ${escapeHtml(cat?.label ?? '')}</div>
        <div class="arena-sub">Venter på modstanderens valg…</div>
      </div>
    `;
    return;
  }
  arena.innerHTML = `
    <div class="quiz-category-picker">
      <div class="arena-title" style="margin-bottom:6px">Vælg din kategori</div>
      ${theirs ? '<div class="arena-sub" style="margin-bottom:14px">Modstanderen har valgt sin kategori</div>' : '<div class="arena-sub" style="margin-bottom:14px">5 spørgsmål fra din kategori, 5 fra modstanderens</div>'}
      <div class="quiz-category-grid">
        ${QUIZ_CATEGORIES.map((c) => `<button class="quiz-category-chip" data-category="${c.id}"><span class="quiz-category-icon">${c.icon}</span><span>${c.label}</span></button>`).join('')}
      </div>
    </div>
  `;
  arena.querySelectorAll<HTMLButtonElement>('[data-category]').forEach((btn) => {
    btn.addEventListener('click', () => {
      Sound.click();
      engine?.chooseCategory(btn.dataset.category!);
    });
  });
}

function renderLeadin(): void {
  const arena = arenaEl();
  if (!arena) return;
  arena.innerHTML = `<div class="arena-inner"><div class="quiz-leadin-number" id="quizLeadinNumber">3</div></div>`;
  let n = 3;
  const tick = () => {
    const el = document.getElementById('quizLeadinNumber');
    if (!el) return;
    n--;
    el.textContent = n > 0 ? String(n) : '';
    if (n > 0) setTimeout(tick, 1000);
  };
  setTimeout(tick, 1000);
}

function questionCardHtml(round: RoundState): string {
  const cat = QUIZ_CATEGORIES.find((c) => c.id === round.categoryId);
  const optionsHtml = round.question.options.map((opt, i) => `<button class="quiz-answer-btn" data-option="${i}">${escapeHtml(opt)}</button>`).join('');
  return `
    <div class="quiz-round">
      <div class="quiz-round-header">SPØRGSMÅL ${round.index + 1}/${round.total} · ${cat?.icon ?? ''} ${(cat?.label ?? '').toUpperCase()}</div>
      <div class="quiz-question">${escapeHtml(round.question.q)}</div>
      <div class="quiz-answer-grid">${optionsHtml}</div>
      <div class="quiz-timer-track"><div class="quiz-timer-bar" id="quizTimerBar"></div></div>
      <div class="quiz-status" id="quizStatus"></div>
    </div>
  `;
}

function renderQuestion(round: RoundState): void {
  const arena = arenaEl();
  if (!arena) return;
  myAnswerThisRound = null;
  arena.innerHTML = questionCardHtml(round);
  arena.querySelectorAll<HTMLButtonElement>('.quiz-answer-btn[data-option]').forEach((btn) => {
    btn.addEventListener('click', () => handleAnswerClick(Number(btn.dataset.option)));
  });
  const bar = document.getElementById('quizTimerBar');
  if (bar) {
    bar.style.transition = 'none';
    bar.style.width = '100%';
    void bar.offsetWidth; // force reflow so the transition below actually animates from 100%
    bar.style.transition = `width ${QUESTION_TIME_MS}ms linear`;
    bar.style.width = '0%';
  }
}

function handleAnswerClick(idx: number): void {
  if (myAnswerThisRound != null) return;
  myAnswerThisRound = idx;
  Sound.click();
  engine?.submitAnswer(idx);
  document.querySelectorAll<HTMLButtonElement>('.quiz-answer-btn').forEach((btn, i) => {
    btn.disabled = true;
    if (i === idx) btn.classList.add('selected');
  });
  const status = document.getElementById('quizStatus');
  if (status) status.textContent = 'Venter på modstanderens svar…';
}

function renderReveal(state: RevealState): void {
  const arena = arenaEl();
  if (!arena) return;
  const cat = QUIZ_CATEGORIES.find((c) => c.id === state.categoryId);
  const optionsHtml = state.question.options
    .map((opt, i) => {
      let cls = 'quiz-answer-btn disabled';
      if (i === state.correctIndex) cls += ' correct';
      else if (i === state.myAnswer) cls += ' wrong';
      return `<button class="${cls}" disabled>${escapeHtml(opt)}</button>`;
    })
    .join('');
  arena.innerHTML = `
    <div class="quiz-round">
      <div class="quiz-round-header">SPØRGSMÅL ${state.index + 1}/${state.total} · ${cat?.icon ?? ''} ${(cat?.label ?? '').toUpperCase()}</div>
      <div class="quiz-question">${escapeHtml(state.question.q)}</div>
      <div class="quiz-answer-grid">${optionsHtml}</div>
      <div class="quiz-score-header">
        DIG <b>${state.myTotal}</b>${state.myGain ? `<span class="quiz-gain">+${state.myGain}</span>` : ''}
        <span class="quiz-score-sep">—</span>
        <b>${state.oppTotal}</b>${state.oppGain ? `<span class="quiz-gain opp">+${state.oppGain}</span>` : ''} MODSTANDER
      </div>
    </div>
  `;
  if (state.myAnswer === state.correctIndex) Sound.hit();
  else if (state.myAnswer != null) Sound.mistake();
}

async function handleEnd(outcome: MatchOutcome): Promise<void> {
  // The match itself is decided — release the per-match Realtime channel now rather than
  // leaving it subscribed until the player happens to navigate elsewhere.
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
  if (stillHere()) drawResult(outcomeLabel, xpGain, outcome);
}

function drawResult(outcome: 'win' | 'loss' | 'draw', xpGain: number, matchOutcome: MatchOutcome): void {
  const label = outcome === 'win' ? 'SEJR' : outcome === 'loss' ? 'NEDERLAG' : 'UAFGJORT';
  const color = outcome === 'win' ? 'var(--lime)' : outcome === 'loss' ? 'var(--coral)' : 'var(--text-dim)';
  const reasonLabel =
    matchOutcome.reason === 'forfeit'
      ? outcome === 'win'
        ? 'Modstanderen forlod duellen'
        : 'Du forlod duellen'
      : `${matchOutcome.myTotal} – ${matchOutcome.oppTotal} point`;
  const w = profile?.duelWins ?? 0;
  const l = profile?.duelLosses ?? 0;
  const d = profile?.duelDraws ?? 0;

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
