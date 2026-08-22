import { profile, getPlayerMeta, escapeHtml, avatarFrameHtml, finishDuelSession, duelTierForRating, DUEL_RATING_DEFAULT } from '../state';
import { Sound } from '../sound';
import { Haptics } from '../haptics';
import { fetchChallenge, writeDuelResult, getHeadToHead, type DuelResult, type HeadToHead } from '../duel/challenges';
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
let oppRating = DUEL_RATING_DEFAULT;
let h2h: HeadToHead = { wins: 0, losses: 0, draws: 0 };
let myAnswerThisRound: number | null = null;
let emojiOnCooldown = false;

const QUICK_EMOJIS = ['😂', '😮', '🔥', '👏', '😤', '💀'];
const EMOJI_COOLDOWN_MS = 1200;

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
  oppRating = oppMeta?.duelRating ?? DUEL_RATING_DEFAULT;
  h2h = await getHeadToHead(profile.id, oppId);
  if (!document.querySelector('.duel-loading')) return;

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

function h2hLabel(): string {
  if (h2h.wins + h2h.losses + h2h.draws === 0) return 'Første opgør!';
  const record = h2h.draws > 0 ? `${h2h.wins}-${h2h.losses}-${h2h.draws}` : `${h2h.wins}-${h2h.losses}`;
  return `${record} mod ${escapeHtml(oppName)}`;
}

function drawShell(matchId: string): void {
  const myTier = duelTierForRating(profile!.duelRating ?? DUEL_RATING_DEFAULT);
  const oppTier = duelTierForRating(oppRating);
  main().innerHTML = `
    <div class="page">
      <div class="game-shell">
        <div class="game-topbar">
          <span>🧠 QUIZ DUEL</span>
          <span class="mono" id="duelStatus">Venter på modstander…</span>
        </div>
        <div class="duel-players">
          <div class="duel-player-chip me">${avatarFrameHtml(profile!.name, profile!.equippedAvatar, profile!.equippedFrame, 30)}<span>${escapeHtml(profile!.name)}</span><span class="duel-tier-badge" title="${myTier.label} · ${profile!.duelRating} rating">${myTier.icon}</span><span class="duel-streak-badge" id="duelStreakMe"></span></div>
          <span class="duel-vs">VS</span>
          <div class="duel-player-chip">${avatarFrameHtml(oppName, oppAvatar, oppFrame, 30)}<span>${escapeHtml(oppName)}</span><span class="duel-tier-badge" title="${oppTier.label} · ${oppRating} rating">${oppTier.icon}</span><span class="duel-streak-badge" id="duelStreakOpp"></span></div>
        </div>
        <div class="duel-h2h">${h2hLabel()}</div>
        <div class="quiz-score-bar-track"><div class="quiz-score-bar-fill" id="quizScoreBarFill" style="width:50%"></div></div>
        <div class="arena duel-arena" id="duelArena">
          <div class="arena-inner"><div class="arena-title">Venter på modstander…</div></div>
        </div>
        <div class="duel-reactions">
          <button class="duel-emoji-toggle" id="duelEmojiToggle" title="Send en reaktion">😀</button>
          <div class="duel-emoji-tray" id="duelEmojiTray" hidden>
            ${QUICK_EMOJIS.map((e) => `<button class="duel-emoji-btn" data-emoji="${e}">${e}</button>`).join('')}
          </div>
        </div>
      </div>
    </div>
  `;
  emojiOnCooldown = false;
  wireEmojiReactions();
  startEngine(matchId);
}

function wireEmojiReactions(): void {
  const toggle = document.getElementById('duelEmojiToggle') as HTMLButtonElement | null;
  const tray = document.getElementById('duelEmojiTray');
  if (!toggle || !tray) return;
  toggle.addEventListener('click', () => {
    tray.hidden = !tray.hidden;
  });
  tray.querySelectorAll<HTMLButtonElement>('[data-emoji]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (emojiOnCooldown) return;
      const emoji = btn.dataset.emoji!;
      engine?.sendEmoji(emoji);
      tray.hidden = true;
      emojiOnCooldown = true;
      toggle.disabled = true;
      setTimeout(() => {
        emojiOnCooldown = false;
        if (toggle.isConnected) toggle.disabled = false;
      }, EMOJI_COOLDOWN_MS);
    });
  });
}

/** Floats a big reaction bubble over the whole game shell (not the tiny player chip —
 * that read as too subtle to actually notice mid-match) — the same handler for both
 * the local echo (see QuizEngine.sendEmoji) and an incoming opponent message, so
 * sending and receiving look identical. */
function showEmojiPop(slot: Slot, emoji: string): void {
  const shell = document.querySelector<HTMLElement>('.game-shell');
  if (!shell) return;
  const pop = document.createElement('span');
  pop.className = 'duel-emoji-pop ' + (slot === mySlot ? 'mine' : 'theirs');
  pop.textContent = emoji;
  shell.appendChild(pop);
  pop.addEventListener('animationend', () => pop.remove(), { once: true });
  if (slot === mySlot) Sound.click();
  else Haptics.tap();
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
    onLocked: (optionIndex) => {
      if (!stillHere()) return;
      renderAnswerLocked(optionIndex);
    },
    onReveal: (state) => {
      if (!stillHere()) return;
      renderReveal(state);
    },
    onEnd: (outcome) => {
      if (!stillHere()) return;
      void handleEnd(outcome);
    },
    onEmoji: (slot, emoji) => {
      if (!stillHere()) return;
      showEmojiPop(slot, emoji);
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

function roundHeaderHtml(round: RoundState): string {
  const cat = QUIZ_CATEGORIES.find((c) => c.id === round.categoryId);
  if (round.sudden) return `⚡ SUDDEN DEATH · ${cat?.icon ?? ''} ${(cat?.label ?? '').toUpperCase()}`;
  return `SPØRGSMÅL ${round.index + 1}/${round.total} · ${cat?.icon ?? ''} ${(cat?.label ?? '').toUpperCase()}`;
}

function questionCardHtml(round: RoundState): string {
  const optionsHtml = round.question.options.map((opt, i) => `<button class="quiz-answer-btn" data-option="${i}">${escapeHtml(opt)}</button>`).join('');
  return `
    <div class="quiz-round ${round.sudden ? 'sudden' : ''}">
      <div class="quiz-round-header">${roundHeaderHtml(round)}</div>
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
  Sound.click();
  engine?.submitAnswer(idx);
}

/** The single place the round's answer buttons get locked — fired by the engine's
 * onLocked callback for BOTH a real click and an auto-timeout, so a click that loses
 * the race against the engine's own question timer (see quizEngine.ts's submitAnswer)
 * can never show a false "your answer was accepted" state: this only ever reflects
 * what the engine actually locked in. */
function renderAnswerLocked(optionIndex: number | null): void {
  myAnswerThisRound = optionIndex;
  document.querySelectorAll<HTMLButtonElement>('.quiz-answer-btn').forEach((btn, i) => {
    btn.disabled = true;
    if (optionIndex != null && i === optionIndex) btn.classList.add('selected');
  });
  const status = document.getElementById('quizStatus');
  if (status) status.textContent = optionIndex == null ? 'Tiden er udløbet, venter på modstanderens svar…' : 'Venter på modstanderens svar…';
}

/** The score bar and streak badges live outside the arena (see drawShell) and persist
 * across rounds — unlike the arena's contents (rebuilt from scratch every round), so
 * their CSS transitions animate smoothly from the previous round's values instead of
 * snapping in at the new value. */
function updateScoreBar(myTotal: number, oppTotal: number): void {
  const fill = document.getElementById('quizScoreBarFill');
  if (!fill) return;
  const total = myTotal + oppTotal;
  const pct = total > 0 ? Math.round((myTotal / total) * 100) : 50;
  fill.style.width = pct + '%';
}

function updateStreakBadges(myStreak: number, oppStreak: number): void {
  const me = document.getElementById('duelStreakMe');
  const opp = document.getElementById('duelStreakOpp');
  if (me) me.textContent = myStreak >= 2 ? `🔥${myStreak}` : '';
  if (opp) opp.textContent = oppStreak >= 2 ? `🔥${oppStreak}` : '';
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
  const suddenLabel = state.sudden ? `⚡ SUDDEN DEATH · ${cat?.icon ?? ''} ${(cat?.label ?? '').toUpperCase()}` : `SPØRGSMÅL ${state.index + 1}/${state.total} · ${cat?.icon ?? ''} ${(cat?.label ?? '').toUpperCase()}`;
  arena.innerHTML = `
    <div class="quiz-round ${state.sudden ? 'sudden' : ''}">
      <div class="quiz-round-header">${suddenLabel}</div>
      <div class="quiz-question">${escapeHtml(state.question.q)}</div>
      <div class="quiz-answer-grid">${optionsHtml}</div>
      <div class="quiz-score-header">
        DIG <b>${state.myTotal}</b>${state.myGain ? `<span class="quiz-gain">+${state.myGain}</span>` : ''}
        <span class="quiz-score-sep">—</span>
        <b>${state.oppTotal}</b>${state.oppGain ? `<span class="quiz-gain opp">+${state.oppGain}</span>` : ''} MODSTANDER
      </div>
    </div>
  `;
  updateScoreBar(state.myTotal, state.oppTotal);
  updateStreakBadges(state.myStreak, state.oppStreak);
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
  const { xpGain, ratingChange, newRating } = await finishDuelSession(outcomeLabel, oppName, oppId);
  await writeDuelResult(currentMatchId, dbResult);
  if (stillHere()) drawResult(outcomeLabel, xpGain, outcome, ratingChange, newRating);
}

function drawResult(outcome: 'win' | 'loss' | 'draw', xpGain: number, matchOutcome: MatchOutcome, ratingChange: number, newRating: number): void {
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
  const tier = duelTierForRating(newRating);
  const ratingSign = ratingChange > 0 ? '+' : '';
  const ratingColor = ratingChange > 0 ? 'var(--lime)' : ratingChange < 0 ? 'var(--coral)' : 'var(--text-dim)';

  main().innerHTML = `
    <div class="page">
      <div class="game-shell">
        <div class="final-wrap">
          <div class="final-label">Resultat</div>
          <div class="final-score duel-result" style="color:${color};font-size:clamp(40px,10vw,64px)">${label}</div>
          <div class="final-rating" style="color:${color}">${reasonLabel}</div>
          <div class="xp-toast">✦ +${xpGain} XP optjent</div>
          <div class="duel-rating-toast" style="color:${ratingColor}">${ratingSign}${ratingChange} rating → ${newRating} <span class="duel-tier-badge">${tier.icon} ${tier.label}</span></div>

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
