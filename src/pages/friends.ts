import { initials } from '../state';
import { MOCK_FRIENDS } from '../mockSocial';

export function renderFriends(): void {
  const main = document.getElementById('main')!;
  main.innerHTML = `
    <div class="page">
      <div class="section-label">Your circle</div>
      <div class="section-title">Friends</div>
      <div class="panel" style="padding:8px 0">
        ${MOCK_FRIENDS.map(
          (f) => `
          <div class="friend-row">
            <div class="avatar" style="width:38px;height:38px;font-size:14px">${initials(f.name)}</div>
            <div class="friend-info">
              <div style="font-weight:600;font-size:14px">${f.name}</div>
              <div class="friend-status ${f.online ? 'online' : ''}">${f.online ? 'Online now' : 'Offline'}</div>
            </div>
            <div>
              <div class="friend-best">${f.best} ms</div>
              <button class="btn btn-ghost" style="padding:6px 12px;font-size:11px;margin-top:4px" disabled>CHALLENGE</button>
            </div>
          </div>
        `,
        ).join('')}
      </div>
      <p style="color:var(--text-faint);font-size:12px;margin-top:14px;font-family:var(--font-mono)">Friend requests & real invites arrive in a later milestone.</p>
    </div>
  `;
}
