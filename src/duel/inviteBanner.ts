import { profile, avatarFrameHtml, escapeHtml } from '../state';
import { toast } from '../toast';
import { Sound } from '../sound';
import { navigate } from '../router';
import type { PresenceUser } from '../activity';
import { sendChallenge, respondToChallenge, cancelChallenge, expireChallenge, onIncomingInvite, onOutgoingInviteUpdate, type DuelChallenge } from './challenges';

/**
 * Non-blocking "you've been challenged to a duel" UI — fixed-corner cards in
 * #duel-invite-container (see index.html), which uses the exact same
 * position:fixed + pointer-events isolation trick as #toast-container (see
 * styles/modal.css) so it can never block or steal input meant for whatever
 * page/game is underneath. Deliberately has NO document-level keydown
 * listener anywhere in this file — several solo games (Snake, Swerve, ...)
 * already own document keydown for arrow-key controls, and a banner that
 * could intercept those would violate the whole point of this being
 * non-interruptive.
 */

const INVITE_WINDOW_MS = 20_000;
const READY_AUTOJOIN_MS = 5_000;

let incoming: DuelChallenge | null = null;
let outgoing: DuelChallenge | null = null;
/** sendChallenge()'s recipient carries name/avatar the DB row itself doesn't (it only stores recipient_id) — cached locally so the outgoing card can render who it was sent to. */
const outgoingRecipients = new Map<string, PresenceUser>();
/** Matches already navigated into — suppresses re-showing a stale "ready" card if this module's listeners fire again after the player already left for the duel page. */
const navigatedMatchIds = new Set<string>();
let tickerId: ReturnType<typeof setInterval> | null = null;
let mounted = false;

function containerEl(): HTMLElement | null {
  return document.getElementById('duel-invite-container');
}

function ensureTicker(): void {
  if (tickerId != null) return;
  tickerId = setInterval(tick, 1000);
}
function stopTickerIfIdle(): void {
  if (tickerId == null) return;
  if (incoming?.status === 'pending' || outgoing?.status === 'pending') return;
  clearInterval(tickerId);
  tickerId = null;
}

function tick(): void {
  if (incoming?.status === 'pending' && Date.now() - new Date(incoming.createdAt).getTime() >= INVITE_WINDOW_MS) {
    const id = incoming.id;
    incoming = null;
    void respondToChallenge(id, 'declined');
  }
  if (outgoing?.status === 'pending' && Date.now() - new Date(outgoing.createdAt).getTime() >= INVITE_WINDOW_MS) {
    // The sender's own tab is guaranteed to be open for its own outgoing invite, which is
    // what makes this the authoritative expiry — see challenges.ts's expireChallenge().
    void expireChallenge(outgoing.id);
  }
  render();
  stopTickerIfIdle();
}

function secondsLeft(createdAt: string): number {
  return Math.max(0, Math.ceil((INVITE_WINDOW_MS - (Date.now() - new Date(createdAt).getTime())) / 1000));
}

function incomingCardHtml(c: DuelChallenge): string {
  return `
    <div class="duel-invite-card" data-role="incoming">
      ${avatarFrameHtml(c.senderName, c.senderAvatar, c.senderFrame, 40)}
      <div class="duel-invite-body">
        <div class="duel-invite-title">${escapeHtml(c.senderName)} udfordrer dig</div>
        <div class="duel-invite-sub">🧠 Quiz Duel · <span class="mono">${secondsLeft(c.createdAt)}s</span></div>
        <div class="duel-invite-actions">
          <button class="btn btn-primary btn-sm" data-duel-accept="${c.id}">ACCEPTÉR</button>
          <button class="btn btn-ghost btn-sm" data-duel-decline="${c.id}">AFVIS</button>
        </div>
      </div>
    </div>
  `;
}

function outgoingCardHtml(c: DuelChallenge, recipient: PresenceUser | undefined): string {
  return `
    <div class="duel-invite-card" data-role="outgoing">
      ${avatarFrameHtml(recipient?.name ?? '?', recipient?.avatar ?? null, null, 40)}
      <div class="duel-invite-body">
        <div class="duel-invite-title">Venter på ${escapeHtml(recipient?.name ?? 'svar')}…</div>
        <div class="duel-invite-sub">🧠 Quiz Duel · <span class="mono">${secondsLeft(c.createdAt)}s</span></div>
        <div class="duel-invite-actions">
          <button class="btn btn-ghost btn-sm" data-duel-cancel="${c.id}">FORTRYD</button>
        </div>
      </div>
    </div>
  `;
}

function readyCardHtml(c: DuelChallenge, opponentName: string, opponentAvatar: string | null, opponentFrame: string | null): string {
  return `
    <div class="duel-invite-card duel-ready" data-role="ready">
      ${avatarFrameHtml(opponentName, opponentAvatar, opponentFrame, 40)}
      <div class="duel-invite-body">
        <div class="duel-invite-title">Duel klar! ⚔ ${escapeHtml(opponentName)} er klar</div>
        <div class="duel-invite-sub">Starter automatisk om få sekunder</div>
        <div class="duel-invite-actions">
          <button class="btn btn-primary btn-sm" data-duel-join="${c.id}">DELTAG NU</button>
        </div>
      </div>
    </div>
  `;
}

function render(): void {
  const el = containerEl();
  if (!el) return;
  const cards: string[] = [];

  if (incoming && !navigatedMatchIds.has(incoming.id)) {
    if (incoming.status === 'pending') cards.push(incomingCardHtml(incoming));
    else if (incoming.status === 'accepted') cards.push(readyCardHtml(incoming, incoming.senderName, incoming.senderAvatar, incoming.senderFrame));
  }
  if (outgoing && !navigatedMatchIds.has(outgoing.id)) {
    const recipient = outgoingRecipients.get(outgoing.id);
    if (outgoing.status === 'pending') cards.push(outgoingCardHtml(outgoing, recipient));
    else if (outgoing.status === 'accepted') cards.push(readyCardHtml(outgoing, recipient?.name ?? 'Modstanderen', recipient?.avatar ?? null, null));
  }

  el.innerHTML = cards.join('');
  wireEvents();
}

function scheduleAutoJoin(matchId: string): void {
  setTimeout(() => {
    if (navigatedMatchIds.has(matchId)) return;
    goToMatch(matchId);
  }, READY_AUTOJOIN_MS);
}

function goToMatch(matchId: string): void {
  navigatedMatchIds.add(matchId);
  if (incoming?.id === matchId) incoming = null;
  if (outgoing?.id === matchId) outgoing = null;
  render();
  void navigate('duel-' + matchId);
}

function wireEvents(): void {
  const el = containerEl();
  if (!el) return;
  el.querySelectorAll<HTMLButtonElement>('[data-duel-accept]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const id = btn.dataset.duelAccept!;
      Sound.click();
      void respondToChallenge(id, 'accepted');
    }),
  );
  el.querySelectorAll<HTMLButtonElement>('[data-duel-decline]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const id = btn.dataset.duelDecline!;
      Sound.click();
      if (incoming?.id === id) incoming = null;
      render();
      void respondToChallenge(id, 'declined');
    }),
  );
  el.querySelectorAll<HTMLButtonElement>('[data-duel-cancel]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const id = btn.dataset.duelCancel!;
      Sound.click();
      if (outgoing?.id === id) outgoing = null;
      render();
      void cancelChallenge(id);
    }),
  );
  el.querySelectorAll<HTMLButtonElement>('[data-duel-join]').forEach((btn) =>
    btn.addEventListener('click', () => {
      Sound.click();
      goToMatch(btn.dataset.duelJoin!);
    }),
  );
}

/** Called once at boot (main.ts), right after startInviteListener(). */
export function mountInviteBanner(): void {
  if (mounted) return;
  mounted = true;

  onIncomingInvite((c) => {
    if (c.status === 'pending') {
      incoming = c;
      ensureTicker();
    } else if (c.status === 'accepted') {
      incoming = c;
      scheduleAutoJoin(c.id);
    } else {
      if (incoming?.id === c.id) incoming = null;
    }
    render();
    stopTickerIfIdle();
  });

  onOutgoingInviteUpdate((c) => {
    if (c.status === 'pending') {
      outgoing = c;
      ensureTicker();
    } else if (c.status === 'accepted') {
      outgoing = c;
      scheduleAutoJoin(c.id);
    } else {
      const recipient = outgoingRecipients.get(c.id);
      if (c.status === 'declined' && recipient) toast(`<span class="toast-icon">🧠</span> ${escapeHtml(recipient.name)} afviste din udfordring`);
      else if (c.status === 'expired' && recipient) toast(`<span class="toast-icon">🧠</span> Udfordringen til ${escapeHtml(recipient.name)} udløb`);
      if (outgoing?.id === c.id) outgoing = null;
      outgoingRecipients.delete(c.id);
    }
    render();
    stopTickerIfIdle();
  });
}

/** Called from the Activity page's DUEL button (see pages/activity.ts). */
export async function challengePlayer(recipient: PresenceUser): Promise<void> {
  if (!profile) return;
  const challenge = await sendChallenge(profile.name, profile.equippedAvatar, profile.equippedFrame, recipient);
  if (!challenge) {
    toast('Kunne ikke sende udfordringen, prøv igen.');
    return;
  }
  outgoingRecipients.set(challenge.id, recipient);
  outgoing = challenge;
  ensureTicker();
  render();
  toast(`<span class="toast-icon">🧠</span> Udfordring sendt til ${escapeHtml(recipient.name)}`);
}
