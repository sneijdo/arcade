import { profile, avatarFrameHtml, escapeHtml } from '../state';
import { GAMES } from '../games/registry';
import { ScoreKinds, scoreUnitSuffix } from '../scoring';
import { isGuestMode } from '../storage';
import { isSupabaseConfigured } from '../supabaseClient';
import { fetchRecentActivity, subscribeActivity, onPresenceChange, type ActivityEntry, type PresenceUser } from '../activity';

const MAX_FEED_ROWS = 40;

function timeAgo(iso: string): string {
  const sec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (sec < 10) return 'lige nu';
  if (sec < 60) return `${sec}s siden`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min siden`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} t siden`;
  return `${Math.floor(hr / 24)}d siden`;
}

function gameLabel(gameId: string): { icon: string; title: string } {
  const g = GAMES.find((gg) => gg.id === gameId);
  return { icon: g?.icon ?? '🎮', title: g?.title ?? gameId };
}

function scoreText(gameId: string, score: number): string {
  const g = GAMES.find((gg) => gg.id === gameId);
  const kind = g?.scoreKind ? ScoreKinds[g.scoreKind] : null;
  return kind ? `${kind.format(score)}${scoreUnitSuffix(kind)}` : String(Math.round(score));
}

function activityRowHtml(e: ActivityEntry): string {
  const isMe = profile?.id === e.ownerId;
  const { icon, title } = gameLabel(e.gameId);
  return `
    <div class="activity-row ${isMe ? 'me' : ''}">
      ${avatarFrameHtml(e.name, e.avatar, e.frame, 30)}
      <div class="activity-row-body">
        <div class="activity-row-line">
          <span class="activity-name">${escapeHtml(e.name)}${isMe ? '<span class="lb-you-tag">DIG</span>' : ''}</span>
          ${e.kind === 'personal_best' ? '<span class="activity-pb-tag">★ NY REKORD</span>' : ''}
        </div>
        <div class="activity-row-sub">${icon} ${title} · <span class="mono">${scoreText(e.gameId, e.score)}</span></div>
      </div>
      <div class="activity-time" data-ts="${e.createdAt}">${timeAgo(e.createdAt)}</div>
    </div>
  `;
}

function onlineListHtml(users: PresenceUser[]): string {
  if (users.length === 0) return '<div class="activity-empty">Ingen online lige nu.</div>';
  return `<div class="activity-online-list">${users
    .map((u) => `<div class="activity-online-chip">${avatarFrameHtml(u.name, u.avatar, null, 26)}<span>${escapeHtml(u.name)}</span></div>`)
    .join('')}</div>`;
}

export async function renderActivity(): Promise<void> {
  const main = document.getElementById('main')!;
  const live = isSupabaseConfigured && !isGuestMode();

  main.innerHTML = `
    <div class="page">
      <div class="section-label">Live</div>
      <h1 class="section-title">Aktivitet</h1>
      ${
        !live
          ? `<div class="guest-lb-note">${
              isGuestMode()
                ? 'Du spiller som gæst, så du kan ikke se eller optræde i live-aktiviteten — opret en konto fra din profil for at komme med.'
                : 'Live-aktivitet kræver at appen er sat op med en konto-backend.'
            }</div>`
          : ''
      }
      ${
        live
          ? `
      <div class="panel activity-panel">
        <div class="activity-panel-header"><span class="activity-live-dot"></span>ONLINE NU</div>
        <div id="onlineList">${onlineListHtml([])}</div>
      </div>
      <div class="panel activity-panel" style="margin-top:16px">
        <div class="activity-panel-header">SENESTE AKTIVITET</div>
        <div id="activityFeed"><div class="activity-empty">Indlæser…</div></div>
      </div>
      `
          : ''
      }
    </div>
  `;

  if (!live) return;

  // Presence — the listener self-removes the moment #onlineList is no longer in
  // the DOM (i.e. the player navigated away), same DOM-presence-check idiom used
  // for game loop timers elsewhere in this codebase (see snake.ts/reaction.ts).
  const stopPresence = onPresenceChange((users) => {
    const el = document.getElementById('onlineList');
    if (!el) {
      stopPresence();
      return;
    }
    el.innerHTML = onlineListHtml(users);
  });

  const feedEl = () => document.getElementById('activityFeed');
  const entries = await fetchRecentActivity(MAX_FEED_ROWS);
  const initialFeedEl = feedEl();
  if (!initialFeedEl) {
    stopPresence();
    return; // navigated away while the initial fetch was in flight
  }
  initialFeedEl.innerHTML = entries.length ? entries.map(activityRowHtml).join('') : '<div class="activity-empty">Ingen aktivitet endnu.</div>';

  const stopFeed = subscribeActivity((entry) => {
    const el = feedEl();
    if (!el) {
      stopFeed();
      stopPresence();
      return;
    }
    el.querySelector('.activity-empty')?.remove();
    el.insertAdjacentHTML('afterbegin', activityRowHtml(entry));
    while (el.children.length > MAX_FEED_ROWS) el.lastElementChild?.remove();
  });

  // Keeps "lige nu" / "2 min siden" labels honest without re-fetching anything.
  const tick = setInterval(() => {
    const el = feedEl();
    if (!el) {
      clearInterval(tick);
      return;
    }
    el.querySelectorAll<HTMLElement>('.activity-time[data-ts]').forEach((t) => {
      t.textContent = timeAgo(t.dataset.ts!);
    });
  }, 15_000);
}
