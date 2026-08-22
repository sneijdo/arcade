import { supabase } from './supabaseClient';
import { isGuestMode } from './storage';
import { profile } from './state';
import { mountModal } from './onboarding';
import { route } from './router';
import { toast } from './toast';

/**
 * The 🐛 header button's target — a plain "send a message to the dev" inbox (see
 * supabase/schema_bug_reports.sql). Requires a real account, same as every other
 * shared/server-backed feature in this app (activity, duels, etc.) — a guest profile
 * has no Supabase session to attach the report to.
 */
export function openBugReportModal(): void {
  if (!supabase || isGuestMode()) {
    toast('Log ind for at indberette fejl.');
    return;
  }
  const backdrop = mountModal(`
    <div class="modal bug-report-modal">
      <h2>🐛 Indberet en fejl</h2>
      <p>Beskriv hvad der gik galt — hvilket spil, hvad du gjorde, og hvad der skete. Jo mere konkret, jo bedre.</p>
      <textarea id="bugReportText" rows="5" maxlength="2000" placeholder="Fx: Trajectory — når jeg trækker skyderen tilbage, ryger jeg ud af vinduet og kan ikke sigte."></textarea>
      <div class="bug-report-actions">
        <button class="btn btn-ghost" id="bugReportCancel">ANNULLER</button>
        <button class="btn btn-primary" id="bugReportSubmit">SEND</button>
      </div>
    </div>
  `);
  const textEl = document.getElementById('bugReportText') as HTMLTextAreaElement;
  textEl.focus();
  document.getElementById('bugReportCancel')!.addEventListener('click', () => backdrop.remove());
  document.getElementById('bugReportSubmit')!.addEventListener('click', async () => {
    const message = textEl.value.trim();
    if (!message) {
      textEl.style.borderColor = 'var(--coral)';
      return;
    }
    const { error } = await supabase!.from('bug_reports').insert({ name: profile?.name ?? 'Ukendt', message, page: route });
    backdrop.remove();
    toast(error ? 'Kunne ikke sende — prøv igen senere.' : '<span class="toast-icon">🐛</span> Tak! Fejlen er sendt videre.');
  });
}
