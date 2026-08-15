import { storage } from '../../storage';
import type { BuildStats, WeaponId, BossId } from './types';

/**
 * Persistent progression, separate from a single run's BuildStats. Stored
 * under a private (non-shared) kv key, same pattern as `profile` — scoped
 * per-user automatically by the storage adapter/RLS, no schema migration
 * needed since the Supabase backing is a generic key-value table.
 */
export interface TacticalMeta {
  currency: number;
  unlockedWeapons: WeaponId[];
  unlockedPerks: string[];
  /** Cross-run cumulative counters, fed into checkAchievements() as extra stats — see finishAndShowResults() in tactical.ts. */
  eliteKills: number;
  vaultsUsed: number;
  bossesDefeated: BossId[];
}

const META_KEY = 'tactical_meta';
export const STARTING_UNLOCKED_WEAPON: WeaponId = 'viper_ar';

function defaultMeta(): TacticalMeta {
  return { currency: 0, unlockedWeapons: [STARTING_UNLOCKED_WEAPON], unlockedPerks: [], eliteKills: 0, vaultsUsed: 0, bossesDefeated: [] };
}

export async function loadMeta(): Promise<TacticalMeta> {
  const stored = await storage.get<TacticalMeta>(META_KEY, false);
  if (!stored) return defaultMeta();
  // guard against a meta blob saved before the starting weapon existed
  if (!stored.unlockedWeapons.includes(STARTING_UNLOCKED_WEAPON)) stored.unlockedWeapons.push(STARTING_UNLOCKED_WEAPON);
  if (!stored.unlockedPerks) stored.unlockedPerks = [];
  // guard against a meta blob saved before achievement-tracking counters existed
  if (stored.eliteKills == null) stored.eliteKills = 0;
  if (stored.vaultsUsed == null) stored.vaultsUsed = 0;
  if (!stored.bossesDefeated) stored.bossesDefeated = [];
  return stored;
}

export async function saveMeta(meta: TacticalMeta): Promise<void> {
  await storage.set(META_KEY, meta, false);
}

export const WEAPON_COSTS: Partial<Record<WeaponId, number>> = {
  sidekick_pistol: 90,
  spectre_smg: 110,
  breach_shotgun: 160,
  talon_burst: 180,
  wraith_dmr: 200,
  longshot_rifle: 240,
  juggernaut_lmg: 240,
  falcon_carbine: 260,
  havoc_launcher: 320,
};

export function isWeaponUnlocked(meta: TacticalMeta, id: WeaponId): boolean {
  return meta.unlockedWeapons.includes(id);
}

/** Returns false if already unlocked or currency was insufficient. */
export function tryUnlockWeapon(meta: TacticalMeta, id: WeaponId): boolean {
  if (isWeaponUnlocked(meta, id)) return false;
  const cost = WEAPON_COSTS[id] ?? 999999;
  if (meta.currency < cost) return false;
  meta.currency -= cost;
  meta.unlockedWeapons.push(id);
  return true;
}

export interface PerkDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  cost: number;
  apply: (build: BuildStats) => void;
}

/** One-time permanent purchases — applied to every future run's build at start, on top of that run's own upgrade picks. Not stackable (buy once, own forever). */
export const PERK_DEFS: PerkDef[] = [
  { id: 'perk_vitality', name: 'Vitalitet', icon: '❤️', desc: '+20 maks. HP i alle fremtidige runs', cost: 140, apply: (b) => { b.maxHpBonus += 20; } },
  { id: 'perk_reflexes', name: 'Reflekser', icon: '⚡', desc: '+10% skudhastighed i alle fremtidige runs', cost: 150, apply: (b) => { b.fireRateMult *= 1.1; } },
  { id: 'perk_marksman', name: 'Skarpskytte', icon: '🎯', desc: '+6% kritisk chance i alle fremtidige runs', cost: 170, apply: (b) => { b.critChance += 0.06; } },
  { id: 'perk_armor', name: 'Panser', icon: '🛡️', desc: '8% skadereduktion i alle fremtidige runs', cost: 200, apply: (b) => { b.damageReduction = Math.min(0.6, b.damageReduction + 0.08); } },
  { id: 'perk_momentum', name: 'Momentum', icon: '🏃', desc: '+8% bevægelseshastighed i alle fremtidige runs', cost: 130, apply: (b) => { b.moveSpeedMult *= 1.08; } },
  { id: 'perk_vampirism', name: 'Vampirisme', icon: '🩸', desc: '+3% livstyveri i alle fremtidige runs', cost: 220, apply: (b) => { b.lifestealPct += 0.03; } },
];

export function isPerkUnlocked(meta: TacticalMeta, id: string): boolean {
  return meta.unlockedPerks.includes(id);
}

export function tryUnlockPerk(meta: TacticalMeta, id: string): boolean {
  if (isPerkUnlocked(meta, id)) return false;
  const def = PERK_DEFS.find((p) => p.id === id);
  if (!def || meta.currency < def.cost) return false;
  meta.currency -= def.cost;
  meta.unlockedPerks.push(id);
  return true;
}

/** Applies every owned perk to a fresh run's build — called once at run start, before any in-run upgrade is picked. */
export function applyPerks(meta: TacticalMeta, build: BuildStats): void {
  for (const perkId of meta.unlockedPerks) {
    const def = PERK_DEFS.find((p) => p.id === perkId);
    def?.apply(build);
  }
}

/** Currency earned at the end of a run — rewards both progress (rooms) and effort (kills), plus a flat completion bonus so finishing the mission always feels like the biggest payout. */
export function computeRunReward(roomsCleared: number, enemiesKilled: number, victory: boolean): number {
  return Math.round(roomsCleared * 14 + enemiesKilled * 2 + (victory ? 120 : 0));
}
