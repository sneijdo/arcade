import type { UpgradeDef, BuildStats } from './types';

/**
 * Every upgrade only mutates BuildStats — the weapon/player systems read
 * those multipliers, so adding an upgrade never touches gameplay code.
 *
 * Rebalance pass: merged the old separate crit-chance/crit-damage cards
 * into one (they were always taken together anyway), added a card for
 * `healOnKillChance` (a BuildStats field the runtime already reads in
 * tactical.ts but that no upgrade had ever granted — a dead mechanic
 * until now), and added one real risk/reward build-definer
 * (Adrenalinstød) so the pool isn't just flat stat sticks with a few
 * projectile-behavior cards on top.
 */
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
    id: 'crit_master',
    name: 'Snigskytteøje',
    icon: '🎯',
    rarity: 'rare',
    tag: 'offense',
    desc: '+10% kritisk chance og +25% kritisk skade',
    maxStacks: 5,
    apply: (b: BuildStats) => {
      b.critChance = Math.min(1, b.critChance + 0.1);
      b.critMultiplier += 0.25;
    },
  },
  {
    id: 'multishot',
    name: 'Dobbeltløb',
    icon: '➕',
    rarity: 'epic',
    tag: 'projectile',
    desc: '+1 projektil pr. skud, hvert ekstra projektil kan selv ramme kritisk og rikochettere',
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
    desc: 'Gennemtrænger 1 fjende mere, før et projektil kan rikochettere videre',
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
    desc: '25% chance for at et projektil rikochetterer til en ny fjende, når det er færdig med at gennemtrænge',
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
    maxStacks: 3,
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
  {
    id: 'heal_on_kill',
    name: 'Feltkirurgi',
    icon: '💊',
    rarity: 'common',
    tag: 'survival',
    desc: '20% chance for at heale 8 HP, når du nedkæmper en fjende',
    maxStacks: 3,
    apply: (b: BuildStats) => {
      b.healOnKillChance = Math.min(1, b.healOnKillChance + 0.2);
    },
  },
  {
    id: 'adrenaline',
    name: 'Adrenalinstød',
    icon: '🩸',
    rarity: 'epic',
    tag: 'offense',
    desc: '-20 max HP, men +35% skade og +10% skudhastighed, alt-ind-build for dem der tør',
    maxStacks: 2,
    apply: (b: BuildStats) => {
      b.maxHpBonus -= 20;
      b.damageMult *= 1.35;
      b.fireRateMult *= 1.1;
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
