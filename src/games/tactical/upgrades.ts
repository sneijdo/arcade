import type { UpgradeDef, BuildStats } from './types';

/** Every upgrade only mutates BuildStats — the weapon/player systems read those multipliers, so adding an upgrade never touches gameplay code. */
export const UPGRADES: UpgradeDef[] = [
  {
    id: 'dmg_up',
    name: 'Skarpere Ammunition',
    icon: '🔺',
    rarity: 'common',
    tag: 'offense',
    desc: '+18% skade',
    maxStacks: 6,
    apply: (b: BuildStats) => {
      b.damageMult *= 1.18;
    },
  },
  {
    id: 'firerate_up',
    name: 'Hurtigere Aftrækker',
    icon: '⚡',
    rarity: 'common',
    tag: 'offense',
    desc: '+15% skudhastighed',
    maxStacks: 6,
    apply: (b: BuildStats) => {
      b.fireRateMult *= 1.15;
    },
  },
  {
    id: 'crit_chance_up',
    name: 'Præcisionstræning',
    icon: '🎯',
    rarity: 'rare',
    tag: 'offense',
    desc: '+12% kritisk chance',
    maxStacks: 5,
    apply: (b: BuildStats) => {
      b.critChance = Math.min(1, b.critChance + 0.12);
    },
  },
  {
    id: 'crit_dmg_up',
    name: 'Dødbringende Præcision',
    icon: '💥',
    rarity: 'rare',
    tag: 'offense',
    desc: '+35% kritisk skade',
    maxStacks: 5,
    apply: (b: BuildStats) => {
      b.critMultiplier += 0.35;
    },
  },
  {
    id: 'multishot',
    name: 'Dobbeltløb',
    icon: '➕',
    rarity: 'epic',
    tag: 'projectile',
    desc: '+1 projektil pr. skud',
    maxStacks: 3,
    apply: (b: BuildStats) => {
      b.projectileCountBonus += 1;
    },
  },
  {
    id: 'penetration_up',
    name: 'Panserbrydende Spidser',
    icon: '🗲',
    rarity: 'rare',
    tag: 'projectile',
    desc: 'Projektiler gennemtrænger 1 fjende mere',
    maxStacks: 3,
    apply: (b: BuildStats) => {
      b.penetrationBonus += 1;
    },
  },
  {
    id: 'ricochet',
    name: 'Ricochet-Runder',
    icon: '↩️',
    rarity: 'epic',
    tag: 'projectile',
    desc: '25% chance for at ramte skud rikochetterer til en ny fjende',
    maxStacks: 3,
    apply: (b: BuildStats) => {
      b.ricochetChance = Math.min(1, b.ricochetChance + 0.25);
    },
  },
  {
    id: 'range_up',
    name: 'Forbedret Sigtekorn',
    icon: '🔭',
    rarity: 'common',
    tag: 'offense',
    desc: '+20% rækkevidde',
    maxStacks: 4,
    apply: (b: BuildStats) => {
      b.rangeMult *= 1.2;
    },
  },
  {
    id: 'move_speed_up',
    name: 'Lette Ben',
    icon: '👟',
    rarity: 'common',
    tag: 'movement',
    desc: '+12% bevægelseshastighed',
    maxStacks: 5,
    apply: (b: BuildStats) => {
      b.moveSpeedMult *= 1.12;
    },
  },
  {
    id: 'max_hp_up',
    name: 'Feltpansér',
    icon: '🛡️',
    rarity: 'common',
    tag: 'survival',
    desc: '+25 max HP',
    maxStacks: 6,
    apply: (b: BuildStats) => {
      b.maxHpBonus += 25;
    },
  },
  {
    id: 'damage_reduction',
    name: 'Kevlarvest',
    icon: '🦺',
    rarity: 'rare',
    tag: 'survival',
    desc: '+8% skadereduktion',
    maxStacks: 4,
    apply: (b: BuildStats) => {
      b.damageReduction = Math.min(0.6, b.damageReduction + 0.08);
    },
  },
  {
    id: 'lifesteal',
    name: 'Feltmedicin',
    icon: '💉',
    rarity: 'epic',
    tag: 'survival',
    desc: 'Heal 3% af skade forvoldt',
    maxStacks: 3,
    apply: (b: BuildStats) => {
      b.lifestealPct += 0.03;
    },
  },
];

export function pickUpgradeChoices(alreadyTaken: Record<string, number>, count = 3): UpgradeDef[] {
  const eligible = UPGRADES.filter((u) => (alreadyTaken[u.id] ?? 0) < u.maxStacks);
  const pool = eligible.length > 0 ? eligible : UPGRADES;
  const weighted: UpgradeDef[] = [];
  for (const u of pool) {
    const weight = u.rarity === 'common' ? 5 : u.rarity === 'rare' ? 3 : 1;
    for (let i = 0; i < weight; i++) weighted.push(u);
  }
  const chosen: UpgradeDef[] = [];
  const usedIds = new Set<string>();
  let guard = 0;
  while (chosen.length < Math.min(count, pool.length) && guard < 200) {
    guard++;
    const pick = weighted[Math.floor(Math.random() * weighted.length)];
    if (!usedIds.has(pick.id)) {
      usedIds.add(pick.id);
      chosen.push(pick);
    }
  }
  return chosen;
}
