import { profile, getCombinedLeaderboard, initials } from '../state';
import { MOCK_FRIENDS } from '../mockSocial';
import type { LeaderboardEntry } from '../types';

let lbTab: 'global' | 'friends' = 'global';

function buildFriendsBoard(): LeaderboardEntry[] {
  const board: LeaderboardEntry[] = MOCK_FRIENDS.map((f) => ({ id: 'f-' + f.name, name: f.name, score: f.best }));
  if (profile && profile.bestReaction != null) board.push({ id: profile.id, name: profile.name, score: profile.bestReaction });
  board.sort((a, b) => a.score - b.score);
  return board;
}

export async function renderLeaderboard(): Promise<void> {
  const main = document.getElementById('main')!;
  if (!profile) return;
  main.innerHTML = `
    <div class="page">
      <div class="section-label">Rankings</div>
      <div class="section-title">Leaderboard — Reaction</div>
      <div class="tabs">
        <button class="tab-btn ${lbTab === 'global' ? 'active' : ''}" data-tab="global">GLOBAL</button>
        <button class="tab-btn ${lbTab === 'friends' ? 'active' : ''}" data-tab="friends">FRIENDS</button>
      </div>
      <div class="panel" id="lbPanel"><div style="color:var(--text-faint);font-family:var(--font-mono);font-size:13px">Loading…</div></div>
    </div>
  `;
  document.querySelectorAll<HTMLElement>('.tab-btn').forEach((b) => {
    b.addEventListener('click', () => {
      lbTab = b.dataset.tab as 'global' | 'friends';
      renderLeaderboard();
    });
  });
  const board = lbTab === 'global' ? await getCombinedLeaderboard() : buildFriendsBoard();
  const panel = document.getElementById('lbPanel')!;
  if (board.length === 0) {
    panel.innerHTML = `<div style="color:var(--text-dim);font-size:13.5px">No scores yet. Be the first.</div>`;
    return;
  }
  const medals = ['🥇', '🥈', '🥉'];
  panel.innerHTML = board
    .map((e, i) => {
      const isMe = e.id === profile!.id;
      return `
      <div class="lb-row ${isMe ? 'me' : ''}">
        <div class="lb-rank ${i < 3 ? 'medal' : ''}">${i < 3 ? medals[i] : '#' + (i + 1)}</div>
        <div class="lb-player">
          <div class="avatar" style="width:28px;height:28px;font-size:11px">${initials(e.name)}</div>
          <span class="lb-name">${e.name}${isMe ? '<span class="lb-you-tag">YOU</span>' : ''}</span>
        </div>
        <div class="lb-score mono">${Math.round(e.score)}<span style="color:var(--text-faint);font-size:11px"> ms</span></div>
      </div>
    `;
    })
    .join('');
}
