import type { TowerDef, TowerId } from './types';

/**
 * Data-driven tower table — each tower is 3 deterministic, gold-cost tiers (spend to upgrade, not
 * a random draft) so tower investment is planned rather than roguelite-random, which fits a
 * defense-building genre better. tiers[0].cost is the placement cost; tiers[1]/[2].cost are
 * upgrade costs from the previous tier.
 */
export const TOWER_DEFS: Record<TowerId, TowerDef> = {
  firemage: {
    id: 'firemage',
    name: 'Ildmagiker',
    icon: '🔥',
    tagline: 'Billig og hurtig, den solide startvalg',
    color: '#ff8a3d',
    tiers: [
      { tier: 1, cost: 40, damage: 8, fireRate: 1.4, range: 130, projectileSpeed: 520, projectileRadius: 4 },
      { tier: 2, cost: 55, damage: 14, fireRate: 1.6, range: 140, projectileSpeed: 540, projectileRadius: 4.5 },
      { tier: 3, cost: 90, damage: 24, fireRate: 1.8, range: 150, projectileSpeed: 560, projectileRadius: 5 },
    ],
  },
  frosttower: {
    id: 'frosttower',
    name: 'Frosttårn',
    icon: '❄️',
    tagline: 'Lav skade, men sænker farten, synergi-valget',
    color: '#5cc9ff',
    tiers: [
      { tier: 1, cost: 50, damage: 3, fireRate: 1.0, range: 110, projectileSpeed: 420, projectileRadius: 4, slowPct: 0.32, slowDurationS: 1.1 },
      { tier: 2, cost: 70, damage: 5, fireRate: 1.1, range: 120, projectileSpeed: 440, projectileRadius: 4.5, slowPct: 0.42, slowDurationS: 1.3 },
      { tier: 3, cost: 110, damage: 8, fireRate: 1.2, range: 130, projectileSpeed: 460, projectileRadius: 5, slowPct: 0.55, slowDurationS: 1.6 },
    ],
  },
  lightning: {
    id: 'lightning',
    name: 'Lynbue',
    icon: '⚡',
    tagline: 'Kæder mellem mål, svaret på sværme',
    color: '#c9a6ff',
    tiers: [
      { tier: 1, cost: 70, damage: 6, fireRate: 1.2, range: 140, projectileSpeed: 650, projectileRadius: 3.5, chainCount: 2, chainFalloff: 0.7 },
      { tier: 2, cost: 95, damage: 10, fireRate: 1.3, range: 150, projectileSpeed: 680, projectileRadius: 4, chainCount: 3, chainFalloff: 0.72 },
      { tier: 3, cost: 150, damage: 16, fireRate: 1.4, range: 160, projectileSpeed: 710, projectileRadius: 4.5, chainCount: 4, chainFalloff: 0.75 },
    ],
  },
  catapult: {
    id: 'catapult',
    name: 'Belejringskatapult',
    icon: '💥',
    tagline: 'Langsom og dyr, men splash rydder grupper',
    color: '#e05a5a',
    tiers: [
      { tier: 1, cost: 90, damage: 22, fireRate: 0.5, range: 160, projectileSpeed: 260, projectileRadius: 7, splashRadius: 42 },
      { tier: 2, cost: 130, damage: 36, fireRate: 0.55, range: 175, projectileSpeed: 270, projectileRadius: 8, splashRadius: 50 },
      { tier: 3, cost: 210, damage: 58, fireRate: 0.6, range: 190, projectileSpeed: 280, projectileRadius: 9, splashRadius: 60 },
    ],
  },
  obelisk: {
    id: 'obelisk',
    name: 'Runeobelisk',
    icon: '🔮',
    tagline: 'Angriber ikke selv, booster tårne i nærheden',
    color: '#ffd23f',
    tiers: [
      { tier: 1, cost: 60, damage: 0, fireRate: 0, range: 0, projectileSpeed: 0, projectileRadius: 0, auraRadius: 120, auraDamageBonusPct: 0.15 },
      { tier: 2, cost: 85, damage: 0, fireRate: 0, range: 0, projectileSpeed: 0, projectileRadius: 0, auraRadius: 140, auraDamageBonusPct: 0.24 },
      { tier: 3, cost: 140, damage: 0, fireRate: 0, range: 0, projectileSpeed: 0, projectileRadius: 0, auraRadius: 160, auraDamageBonusPct: 0.35 },
    ],
  },
};

export function listTowers(): TowerDef[] {
  return Object.values(TOWER_DEFS);
}
