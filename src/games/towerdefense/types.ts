import type { Vec2 } from '../shared/vec';

export type TowerId = 'firemage' | 'frosttower' | 'lightning' | 'catapult' | 'obelisk';
export type EnemyId = 'goblin' | 'goblin_shaman' | 'orc' | 'orc_shield' | 'orc_berserker' | 'troll';

export interface TowerTierStats {
  tier: 1 | 2 | 3;
  /** Gold cost to reach this tier — placement cost for tier 1, upgrade cost for 2/3. */
  cost: number;
  damage: number;
  /** Attacks per second. */
  fireRate: number;
  /** Pixels, evaluated against on-screen enemy positions (not path-distance). */
  range: number;
  projectileSpeed: number;
  projectileRadius: number;
  /** Splash: catapult only — damages every enemy within this pixel radius of impact. */
  splashRadius?: number;
  /** Slow: frost tower only. */
  slowPct?: number;
  slowDurationS?: number;
  /** Chain: lightning archer only — hits this many additional nearby enemies, each at chainFalloff x the previous hit's damage. */
  chainCount?: number;
  chainFalloff?: number;
  /** Aura: obelisk only — obelisk never attacks; it boosts damage of towers within auraRadius by auraDamageBonusPct. */
  auraRadius?: number;
  auraDamageBonusPct?: number;
}

export interface TowerDef {
  id: TowerId;
  name: string;
  icon: string;
  tagline: string;
  color: string;
  /** Always exactly 3 entries — index 0 = tier 1 (placement), 1 = tier 2, 2 = tier 3. Plain array
   * (not a fixed tuple) so indexing by a runtime tier value of type 1|2|3 doesn't require TS to
   * prove the index is in range at every call site. */
  tiers: TowerTierStats[];
}

export interface TowerInstance {
  id: number;
  defId: TowerId;
  slotId: string;
  pos: Vec2;
  tier: 1 | 2 | 3;
  cooldownRemaining: number;
  totalDamageDealt: number;
  kills: number;
  /** Brief scale-up pulse timer after placing/upgrading — pure juice. */
  placeFlash: number;
}

export interface EnemyStats {
  id: EnemyId;
  name: string;
  hp: number;
  speed: number; // px/s at wave-1 scaling
  radius: number;
  color: string;
  shape: 'circle' | 'triangle' | 'diamond' | 'hex';
  /** Lives lost if this enemy reaches the gate. */
  livesCost: number;
  goldReward: number;
  isBoss?: boolean;
  /** Shielded orc only: extra HP pool absorbed before real HP, regenerates if unhit for a few seconds. */
  shieldHp?: number;
  /** Goblin shaman only: nearby goblins get a speed boost while the shaman is alive. */
  auraRadius?: number;
  auraSpeedBoostPct?: number;
  /** Berserker only: below this HP fraction, speed multiplies by berserkSpeedMult. */
  berserkThresholdPct?: number;
  berserkSpeedMult?: number;
}

export interface EnemyInstance {
  id: number;
  defId: EnemyId;
  /** Distance traveled along the path, in px — the single source of truth for position. */
  pathDist: number;
  pos: Vec2;
  facing: number;
  hp: number;
  maxHp: number;
  shieldHp: number;
  shieldRegenCooldown: number;
  hitFlash: number;
  slowRemaining: number;
  slowFactor: number; // 1 = no slow, <1 = slowed
  /** Baked in at spawn from wave scaling — see waves.ts scaleForWave(). */
  hpMult: number;
  speedMult: number;
  goldMult: number;
}

export type WaveTier = 'early' | 'mid' | 'late';

export interface WaveTemplate {
  label: string;
  tier: WaveTier;
  groups: { defId: EnemyId; count: number }[];
  spawnIntervalMs: number;
  bonusGold: number;
}

export interface SpawnTicket {
  defId: EnemyId;
  delay: number;
}
