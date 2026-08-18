import type { EnemyStats, EnemyId } from './types';

/**
 * Data-driven enemy table, same spirit as tactical/enemies.ts — a new enemy is a data entry, not
 * new code (the state machine in enemyRuntime.ts reads shieldHp/auraRadius/berserkThresholdPct
 * generically). Ground-only roster by design (no flying/air-ground split — explicit v2 item), so
 * every tower can hit every enemy and targeting stays simple.
 */
export const ENEMY_DEFS: Record<EnemyId, EnemyStats> = {
  goblin: {
    id: 'goblin',
    name: 'Goblin',
    hp: 18,
    speed: 92,
    radius: 12,
    color: '#7dd45a',
    shape: 'triangle',
    livesCost: 1,
    goldReward: 4,
  },
  goblin_shaman: {
    // Doesn't fight itself — it's a priority-kill call: while alive, every goblin within
    // auraRadius moves auraSpeedBoostPct faster, so a shaman buried in a goblin swarm quietly
    // makes the whole group harder to kite/kill in time. Ignoring it is the tempting mistake.
    id: 'goblin_shaman',
    name: 'Goblin-Shaman',
    hp: 34,
    speed: 78,
    radius: 13,
    color: '#b8f04d',
    shape: 'diamond',
    livesCost: 1,
    goldReward: 9,
    auraRadius: 90,
    auraSpeedBoostPct: 0.32,
  },
  orc: {
    id: 'orc',
    name: 'Orc',
    hp: 55,
    speed: 56,
    radius: 15,
    color: '#c98b3e',
    shape: 'hex',
    livesCost: 2,
    goldReward: 10,
  },
  orc_shield: {
    // The shield absorbs damage first and regenerates after a few unhit seconds — sustained
    // single-target fire breaks through it permanently, but spreading chip damage across many
    // shielded orcs (e.g. lightning's chain) lets every shield regen before any of them pop.
    // Rewards focus fire, the opposite lesson from the goblin swarm.
    id: 'orc_shield',
    name: 'Skjold-Orc',
    hp: 42,
    speed: 50,
    radius: 16,
    color: '#8ea6c9',
    shape: 'hex',
    livesCost: 2,
    goldReward: 12,
    shieldHp: 45,
  },
  orc_berserker: {
    // Speeds up hard once low — a leaker that suddenly outruns a slow/kite response right at the
    // gate is the danger, not its damage output while at full health.
    id: 'orc_berserker',
    name: 'Bersærker-Orc',
    hp: 48,
    speed: 58,
    radius: 15,
    color: '#e0563f',
    shape: 'triangle',
    livesCost: 2,
    goldReward: 11,
    berserkThresholdPct: 0.4,
    berserkSpeedMult: 2.1,
  },
  troll: {
    id: 'troll',
    name: 'Trold',
    hp: 900,
    speed: 34,
    radius: 26,
    color: '#5a3d7a',
    shape: 'hex',
    livesCost: 10,
    goldReward: 90,
    isBoss: true,
  },
};
