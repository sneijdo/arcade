import { storage } from './storage';
import { escapeHtml } from './state';

interface ServiceNotice {
  id: string;
  text: string;
  publishedAt: number;
}

const SHARED_KEY = 'service_notice';
const DISMISSED_KEY = 'dismissedServiceNoticeId';

function containerEl(): HTMLElement | null {
  return document.getElementById('service-notice-container');
}

function noticeHtml(notice: ServiceNotice): string {
  const body = escapeHtml(notice.text).replace(/\n/g, '<br>');
  return `
    <div class="service-notice">
      <span class="service-notice-icon">🛠️</span>
      <div class="service-notice-text">${body}</div>
      <button class="service-notice-close" id="serviceNoticeClose" aria-label="Luk besked" title="Luk">✕</button>
    </div>
  `;
}

/**
 * Called once at boot (main.ts), right after a real session/profile is confirmed — same
 * placement as mountInviteBanner(). Fetches the one shared "current notice" row (see
 * supabase/publish_service_notice.sql for how it's published/updated — no redeploy needed
 * for a new message, just a SQL update) and shows it unless this player has already
 * dismissed this exact notice. Dismissal is keyed by the notice's own id rather than a
 * plain boolean, so publishing a *new* notice later reaches everyone again even if they
 * already closed an older one.
 */
export async function mountServiceNotice(): Promise<void> {
  const container = containerEl();
  if (!container) return;
  const notice = await storage.get<ServiceNotice>(SHARED_KEY, true);
  if (!notice || !notice.text) return;
  const dismissedId = await storage.get<string>(DISMISSED_KEY, false);
  if (dismissedId === notice.id) return;

  container.innerHTML = noticeHtml(notice);
  document.getElementById('serviceNoticeClose')?.addEventListener('click', () => {
    container.innerHTML = '';
    void storage.set(DISMISSED_KEY, notice.id, false);
  });
}
