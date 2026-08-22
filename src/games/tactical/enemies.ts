import type { EnemyStats, EnemyId } from './types';

export const ENEMY_DEFS: Record<EnemyId, EnemyStats> = {
  rifleman: {
    id: 'rifleman',
    name: 'Rifleman',
    hp: 22,
    moveSpeed: 70,
    damage: 9,
    attackCooldown: 1.4,
    attackRange: 320,
    preferredRange: 220,
    xpReward: 8,
    radius: 14,
    color: '#8d8aa3',
    telegraphMs: 260,
    shape: 'circle',
  },
  rusher: {
    id: 'rusher',
    name: 'Rusher',
    hp: 16,
    moveSpeed: 150,
    damage: 15,
    attackCooldown: 0.9,
    attackRange: 34,
    preferredRange: 0,
    xpReward: 7,
    radius: 13,
    color: '#ff5d7a',
    telegraphMs: 180, // a real (if brief) warning ring before the lunge lands — "hit because I made a mistake," not "hit because I couldn't see it"
    shape: 'triangle',
  },
  shotgunner: {
    id: 'shotgunner',
    name: 'Shotgunner',
    hp: 30,
    moveSpeed: 95,
    damage: 8,
    attackCooldown: 1.7,
    attackRange: 150,
    preferredRange: 110,
    xpReward: 10,
    radius: 15,
    color: '#c9f73e',
    telegraphMs: 300,
    shape: 'hex',
  },
  sniper: {
    id: 'sniper',
    name: 'Sniper',
    hp: 18,
    moveSpeed: 55,
    damage: 24,
    attackCooldown: 2.6,
    attackRange: 560,
    preferredRange: 420,
    xpReward: 14,
    radius: 14,
    color: '#5cd0ff',
    telegraphMs: 650,
    shape: 'diamond',
  },
  elite_rifleman: {
    // Display name is "Elite Vanguard" — it's no longer just a rifleman with
    // more HP. See enemyRuntime.ts: any def.isElite enemy strafes
    // perpendicular to its approach/hold vector instead of standing still
    // at preferredRange, so it's a genuinely harder target to land shots on
    // rather than just a bigger health bar. Faster attack cadence too, for
    // sustained pressure instead of one bigger hit.
    id: 'elite_rifleman',
    name: 'Elite Vanguard',
    hp: 90,
    moveSpeed: 95,
    damage: 17,
    attackCooldown: 0.8,
    attackRange: 340,
    preferredRange: 240,
    xpReward: 40,
    radius: 19,
    color: '#8b6bff',
    isElite: true,
    telegraphMs: 230,
    shape: 'hex',
  },
  flanker: {
    // Melee, but doesn't beeline the player like a rusher — it arcs in from
    // the side (see enemyRuntime.ts movement), so a player who's turned to
    // face one threat can get hit from an angle they weren't watching. That's
    // a different decision than a rusher: you have to track your flanks, not
    // just tank-and-spank whatever's closest in front of you.
    id: 'flanker',
    name: 'Flanker',
    hp: 14,
    moveSpeed: 135,
    damage: 14,
    attackCooldown: 1.0,
    attackRange: 32,
    preferredRange: 0,
    xpReward: 9,
    radius: 13,
    color: '#ff9d4d', // distinct from sniper's cyan — must be readable as a different threat at a glance
    telegraphMs: 200,
    shape: 'chevron',
  },
  brute: {
    // Heavy melee tank — the third melee archetype after rusher (fast,
    // fragile) and flanker (arcs in from the side). Brute does neither: it
    // beelines slowly and simply outlasts you if you let it stay close,
    // biggest hitbox in the roster so it reads as "big and dangerous" before
    // the player ever checks its HP bar.
    id: 'brute',
    name: 'Brute',
    hp: 55,
    moveSpeed: 60,
    damage: 27,
    attackCooldown: 1.6,
    attackRange: 40,
    preferredRange: 0,
    xpReward: 16,
    radius: 20,
    color: '#c94f4f',
    telegraphMs: 260,
    shape: 'hex',
  },
  suppressor: {
    // Aggressive rapid-fire ranged harasser — trades rifleman's moderate
    // everything and sniper's huge single hit for frequency: a much shorter
    // telegraph and faster attack cadence make it hard to fully avoid, but
    // each hit is weak on its own. Pressures constant movement rather than
    // being a single priority target.
    id: 'suppressor',
    name: 'Suppressor',
    hp: 20,
    moveSpeed: 85,
    damage: 6,
    attackCooldown: 0.5,
    attackRange: 260,
    preferredRange: 160,
    xpReward: 9,
    radius: 14,
    color: '#ffd23f',
    telegraphMs: 150,
    shape: 'circle',
  },
};
