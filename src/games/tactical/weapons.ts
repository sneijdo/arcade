import type { WeaponStats } from './types';

/** Base weapon data — all runtime values are derived from these * the player's BuildStats multipliers. Phase 1 ships one weapon; the table exists so adding more is pure data. */
export const WEAPONS: Record<string, WeaponStats> = {
  viper_ar: {
    id: 'viper_ar',
    name: 'Viper AR',
    fireRate: 3.2,
    damage: 9,
    projectileSpeed: 640,
    projectileCount: 1,
    spreadDeg: 3,
    critChance: 0.05,
    critMultiplier: 1.5,
    range: 480,
    penetration: 0,
  },
};

export const STARTING_WEAPON_ID = 'viper_ar';
