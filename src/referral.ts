import { supabase } from './supabaseClient';
import { profile, saveProfile, addXp } from './state';
import { refreshHeader } from './header';
import { toast } from './toast';

const REFERRAL_PARAM = 'ref';
const PENDING_KEY = 'arcade:pendingReferralId';
const REFERRAL_GOAL_SESSIONS = 4;
export const REFERRAL_REWARD_XP = 500;

/**
 * Called once at boot (main.ts), before auth resolves. Captures ?ref=<referrerId> from the
 * URL into sessionStorage — it has to survive the "show signup modal → fill in username/
 * password → submit" flow, which doesn't reload the page — then strips it from the visible
 * URL so it doesn't linger in the address bar. Harmless if the visitor already has an
 * account: the stash is only ever read by consumePendingReferralId(), which onboarding.ts
 * calls solely on the real-signup path.
 */
export function captureReferralFromUrl(): void {
  const params = new URLSearchParams(location.search);
  const ref = params.get(REFERRAL_PARAM);
  if (!ref) return;
  try {
    sessionStorage.setItem(PENDING_KEY, ref);
  } catch {
    // best-effort — worst case this visit just doesn't attribute to a referrer
  }
  params.delete(REFERRAL_PARAM);
  const rest = params.toString();
  history.replaceState(null, '', location.pathname + (rest ? `?${rest}` : '') + location.hash);
}

/** Consumed exactly once, at the moment a brand-new real account is actually created (see
 * onboarding.ts's signup path) — never on login, never on the guest/local-mode flows. Clears
 * the stash either way, so a second signup later in the same tab session doesn't inherit a
 * stale referral. */
export function consumePendingReferralId(): string | null {
  try {
    const id = sessionStorage.getItem(PENDING_KEY);
    sessionStorage.removeItem(PENDING_KEY);
    return id;
  } catch {
    return null;
  }
}

/** Shown on the Profile page's "invite a friend" panel — opening it in a fresh tab/device
 * lands on this same app with ?ref=<id> attached, captured above. */
export function referralLink(): string {
  if (!profile) return '';
  return `${location.origin}${location.pathname}?ref=${profile.id}`;
}

interface ReferredAccount {
  id: string;
  sessionsPlayed: number;
}

/**
 * Every account that was created through this player's referral link — each one set
 * `referredBy` to this player's id at signup (see createProfile in state.ts). That field
 * lives on the *referred* friend's private profile row, which this player can't read
 * directly (RLS), so this reads the public `playerMeta:<id>` mirror instead — anyone can
 * read any shared row, and saveProfile() already mirrors sessionsPlayed there too.
 */
async function fetchReferredAccounts(): Promise<ReferredAccount[]> {
  if (!supabase || !profile) return [];
  const { data, error } = await supabase.from('kv').select('key,value').eq('shared', true).like('key', 'playerMeta:%').eq('value->>referredBy', profile.id);
  if (error) {
    console.error('referral lookup failed', error);
    return [];
  }
  return (data ?? []).map((row) => ({
    id: (row.key as string).slice('playerMeta:'.length),
    sessionsPlayed: (row.value as { sessionsPlayed?: number }).sessionsPlayed ?? 0,
  }));
}

export interface ReferralStats {
  /** Referred friends who haven't reached the session goal (or reward wasn't granted) yet. */
  pendingCount: number;
  /** Referred friends already paid out. */
  rewardedCount: number;
  /** XP granted by *this* call, if any — lets the Profile page show a fresh "+500 XP!" moment
   * instead of a silent balance change. */
  xpGrantedThisSync: number;
}

/**
 * Checks every friend this player referred against the 4-session goal and grants the 500 XP
 * reward for any that just crossed it, once per friend (tracked in
 * profile.referralRewardsClaimed so repeat calls are safe/idempotent). Called both at boot
 * (fire-and-forget, so a reward lands even if the player never opens their Profile page) and
 * from the Profile page itself (awaited, so its stats are current and any just-earned reward
 * shows immediately).
 */
export async function syncReferrals(): Promise<ReferralStats> {
  if (!supabase || !profile) return { pendingCount: 0, rewardedCount: 0, xpGrantedThisSync: 0 };
  const referred = await fetchReferredAccounts();
  const newlyRewarded = referred.filter((r) => r.sessionsPlayed >= REFERRAL_GOAL_SESSIONS && !profile!.referralRewardsClaimed.includes(r.id));

  let xpGrantedThisSync = 0;
  if (newlyRewarded.length > 0) {
    for (const r of newlyRewarded) profile.referralRewardsClaimed.push(r.id);
    xpGrantedThisSync = REFERRAL_REWARD_XP * newlyRewarded.length;
    addXp(xpGrantedThisSync);
    await saveProfile();
    refreshHeader();
    const who = newlyRewarded.length === 1 ? 'en ven du inviterede er' : `${newlyRewarded.length} venner du inviterede er`;
    toast(`<span class="toast-icon">🤝</span> +${xpGrantedThisSync} XP — ${who} nu i gang!`);
  }

  const rewardedCount = referred.filter((r) => profile!.referralRewardsClaimed.includes(r.id)).length;
  return { pendingCount: referred.length - rewardedCount, rewardedCount, xpGrantedThisSync };
}
