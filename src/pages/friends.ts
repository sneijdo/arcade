import { profile, getCombinedLeaderboard, initials } from '../state';
import { socialAvailable, searchProfiles, sendFriendRequest, acceptFriendRequest, removeFriendship, listFriendsAndRequests } from '../social';
import type { FriendEntry, PublicProfileHit } from '../social';
import { toast } from '../toast';

let searchResults: PublicProfileHit[] = [];
let searchQuery = '';

export async function renderFriends(): Promise<void> {
  const main = document.getElementById('main')!;
  if (!profile) return;

  if (!socialAvailable()) {
    main.innerHTML = comingSoonHtml();
    return;
  }

  main.innerHTML = `
    <div class="page">
      <div class="section-label">Din kreds</div>
      <div class="section-title">Venner</div>

      <div class="panel" style="margin-bottom:24px">
        <div class="section-label" style="margin-bottom:10px">Find spillere</div>
        <div style="display:flex;gap:10px">
          <input type="text" id="friendSearchInput" placeholder="Søg på brugernavn…" value="${escapeAttr(searchQuery)}"
            style="flex:1;padding:12px 14px;border-radius:10px;border:1px solid var(--border-2);background:var(--void-2);color:var(--text);font-family:var(--font-body);font-size:14px">
          <button class="btn btn-primary" id="friendSearchBtn">SØG</button>
        </div>
        <div id="friendSearchResults" style="margin-top:14px"></div>
      </div>

      <div id="friendRequestsSection"></div>
      <div id="friendsListSection"></div>
    </div>
  `;

  wireSearch();
  await renderRequestsAndFriends();
}

function comingSoonHtml(): string {
  return `
    <div class="page">
      <div class="section-label">Din kreds</div>
      <div class="section-title">Venner</div>
      <div class="panel" style="text-align:center;padding:48px 24px;display:flex;flex-direction:column;align-items:center;gap:10px">
        <div style="font-size:32px">🤝</div>
        <div class="featured-title" style="font-size:20px">Venner kommer snart</div>
        <p style="color:var(--text-dim);font-size:13.5px;max-width:340px">Følg venner, se hvem der lige har slået din rekord, og udfordr dem direkte. Under udvikling.</p>
      </div>
    </div>
  `;
}

function escapeAttr(s: string): string {
  return s.replace(/"/g, '&quot;');
}

function wireSearch(): void {
  const input = document.getElementById('friendSearchInput') as HTMLInputElement;
  const btn = document.getElementById('friendSearchBtn') as HTMLButtonElement;
  const runSearch = async () => {
    searchQuery = input.value.trim();
    if (!searchQuery) {
      searchResults = [];
      renderSearchResults();
      return;
    }
    searchResults = await searchProfiles(searchQuery, profile!.id);
    renderSearchResults();
  };
  btn.addEventListener('click', runSearch);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') runSearch();
  });
}

function renderSearchResults(): void {
  const el = document.getElementById('friendSearchResults');
  if (!el) return;
  if (!searchQuery) {
    el.innerHTML = '';
    return;
  }
  if (searchResults.length === 0) {
    el.innerHTML = `<p style="color:var(--text-faint);font-size:12.5px">Ingen spillere fundet.</p>`;
    return;
  }
  el.innerHTML = searchResults
    .map(
      (r) => `
    <div class="friend-row" style="padding:10px 4px">
      <div class="avatar" style="width:34px;height:34px;font-size:12.5px">${initials(r.name)}</div>
      <div class="friend-info"><div style="font-weight:600;font-size:14px">${r.name}</div></div>
      <button class="btn btn-ghost" style="padding:8px 14px;font-size:11.5px" data-add="${r.id}">TILFØJ</button>
    </div>
  `,
    )
    .join('');
  el.querySelectorAll<HTMLButtonElement>('[data-add]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.textContent = '…';
      const { error } = await sendFriendRequest(btn.dataset.add!);
      if (error) {
        toast(`<span style="color:var(--coral)">${error}</span>`);
        btn.disabled = false;
        btn.textContent = 'TILFØJ';
      } else {
        toast('✦ Venneanmodning sendt');
        btn.textContent = 'SENDT';
      }
    });
  });
}

async function renderRequestsAndFriends(): Promise<void> {
  const { friends, incoming, outgoing } = await listFriendsAndRequests(profile!.id);

  const requestsEl = document.getElementById('friendRequestsSection')!;
  if (incoming.length === 0 && outgoing.length === 0) {
    requestsEl.innerHTML = '';
  } else {
    requestsEl.innerHTML = `
      <div class="section-title" style="margin-top:8px">Anmodninger</div>
      <div class="panel" style="padding:8px 0;margin-bottom:24px">
        ${incoming
          .map(
            (r) => `
          <div class="friend-row">
            <div class="avatar" style="width:38px;height:38px;font-size:14px">${initials(r.name)}</div>
            <div class="friend-info"><div style="font-weight:600;font-size:14px">${r.name}</div><div class="friend-status">Vil være venner</div></div>
            <div style="display:flex;gap:8px">
              <button class="btn btn-primary" style="padding:8px 12px;font-size:11px" data-accept="${r.friendshipId}">ACCEPTÉR</button>
              <button class="btn btn-ghost" style="padding:8px 12px;font-size:11px" data-decline="${r.friendshipId}">AFVIS</button>
            </div>
          </div>
        `,
          )
          .join('')}
        ${outgoing
          .map(
            (r) => `
          <div class="friend-row">
            <div class="avatar" style="width:38px;height:38px;font-size:14px">${initials(r.name)}</div>
            <div class="friend-info"><div style="font-weight:600;font-size:14px">${r.name}</div><div class="friend-status">Afventer svar</div></div>
            <button class="btn btn-ghost" style="padding:8px 12px;font-size:11px" data-decline="${r.friendshipId}">FORTRYD</button>
          </div>
        `,
          )
          .join('')}
      </div>
    `;
    requestsEl.querySelectorAll<HTMLButtonElement>('[data-accept]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await acceptFriendRequest(btn.dataset.accept!);
        toast('✦ I er nu venner');
        await renderRequestsAndFriends();
      });
    });
    requestsEl.querySelectorAll<HTMLButtonElement>('[data-decline]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await removeFriendship(btn.dataset.decline!);
        await renderRequestsAndFriends();
      });
    });
  }

  const listEl = document.getElementById('friendsListSection')!;
  listEl.innerHTML = `<div class="section-title" style="margin-top:8px">Dine venner</div>`;
  if (friends.length === 0) {
    listEl.innerHTML += `<p style="color:var(--text-faint);font-size:12.5px">Ingen venner endnu — søg efter nogen ovenfor.</p>`;
    return;
  }
  const reactionBoard = await getCombinedLeaderboard('reaction');
  const bestById: Record<string, number> = {};
  reactionBoard.forEach((e) => {
    bestById[e.id] = e.score;
  });
  listEl.innerHTML += `
    <div class="panel" style="padding:8px 0">
      ${friends
        .map((f: FriendEntry) => {
          const best = bestById[f.userId];
          return `
        <div class="friend-row">
          <div class="avatar" style="width:38px;height:38px;font-size:14px">${initials(f.name)}</div>
          <div class="friend-info"><div style="font-weight:600;font-size:14px">${f.name}</div></div>
          <div>
            <div class="friend-best">${best != null ? Math.round(best) + ' ms' : '—'}</div>
            <button class="btn btn-ghost" style="padding:6px 12px;font-size:11px;margin-top:4px" data-remove="${f.friendshipId}">FJERN</button>
          </div>
        </div>
      `;
        })
        .join('')}
    </div>
  `;
  listEl.querySelectorAll<HTMLButtonElement>('[data-remove]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await removeFriendship(btn.dataset.remove!);
      await renderRequestsAndFriends();
    });
  });
}
