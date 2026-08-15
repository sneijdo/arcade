import { storage } from './storage';
import { ACHIEVEMENTS } from './achievements';
import { MOCK_LEADERBOARD } from './mockSocial';
import { toast } from './toast';
import { Sound } from './sound';
import { refreshHeader } from './header';
import type { AchievementStats, LeaderboardEntry, Profile } from './types';

export let profile: Profile | null = null;

export function initials(name: string): string {
  return (
    (name || '?')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase() || '?'
  );
}

export async function loadProfile(): Promise<Profile | null> {
  const p = await storage.get<Profile>('profile', false);
  if (p) profile = p;
  return p;
}

export async function saveProfile(): Promise<void> {
  if (!profile) return;
  await storage.set('profile', profile, false);
}

export function clearProfile(): void {
  profile = null;
}

export async function createProfile(name: string, id?: string): Promise<void> {
  profile = {
    id: id ?? (crypto.randomUUID ? crypto.randomUUID() : 'p-' + Date.now() + '-' + Math.random().toString(36).slice(2)),
    name: name.slice(0, 18),
    xp: 0,
    bestReaction: null,
    bestAvg: null,
    sessionsPlayed: 0,
    history: [],
    unlockedAchievements: [],
    muted: false,
  };
  await saveProfile();
}

export async function pushLeaderboardEntry(score: number): Promise<void> {
  if (!profile) return;
  await storage.set('lb:reaction:' + profile.id, { name: profile.name, score, id: profile.id }, true);
}

export async function getCombinedLeaderboard(): Promise<LeaderboardEntry[]> {
  const keys = await storage.list('lb:reaction:', true);
  const entries: LeaderboardEntry[] = [];
  for (const k of keys) {
    const r = await storage.get<LeaderboardEntry>(k, true);
    if (r) entries.push(r);
  }
  // dedupe by id keeping best (lowest) score
  const byId: Record<string, LeaderboardEntry> = {};
  for (const e of entries) {
    if (!byId[e.id] || e.score < byId[e.id].score) byId[e.id] = e;
  }
  const real = Object.values(byId);
  const combined = [...MOCK_LEADERBOARD, ...real];
  combined.sort((a, b) => a.score - b.score);
  return combined;
}

export async function awardXP(amount: number, reasonLabel?: string): Promise<void> {
  if (!profile) return;
  profile.xp += amount;
  await saveProfile();
  refreshHeader();
  if (reasonLabel) {
    toast(`<span class="xp-icon">✦</span> +${amount} XP <span style="color:var(--text-dim)">— ${reasonLabel}</span>`);
  }
}

export async function checkAchievements(extra: Partial<AchievementStats> = {}): Promise<void> {
  if (!profile) return;
  const board = await getCombinedLeaderboard();
  const myEntry = board.find((e) => e.id === profile!.id);
  const rank = myEntry ? board.indexOf(myEntry) + 1 : null;
  const statObj: AchievementStats = {
    bestReaction: profile.bestReaction,
    bestAvg: profile.bestAvg,
    sessionsPlayed: profile.sessionsPlayed,
    rank,
    ...extra,
  };
  let changed = false;
  for (const a of ACHIEVEMENTS) {
    if (!profile.unlockedAchievements.includes(a.id) && a.check(statObj)) {
      profile.unlockedAchievements.push(a.id);
      changed = true;
      Sound.achievement();
      toast(
        `<span class="toast-icon">${a.icon}</span><div><b>${a.title}</b><br><span style="color:var(--text-dim);font-size:11.5px">${a.desc}</span></div>`,
        'achievement',
      );
    }
  }
  if (changed) await saveProfile();
}
