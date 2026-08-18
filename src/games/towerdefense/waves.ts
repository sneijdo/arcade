import type { WaveTemplate, WaveTier } from './types';
import { BALANCE } from './balance';

/**
 * Pool of hand-authored wave templates, tagged by tier — mirrors tactical/encounters.ts's
 * ENCOUNTER_POOL + buildRoomSequence pattern exactly: NOT a fixed linear list, drawn into a run's
 * actual sequence by buildStorySequence() below. New waves are pure data, so the pool can keep
 * growing without needing every run to get longer or be manually reordered. This pool (22
 * templates) plus scaleForWave()'s continuous difficulty ramp is what makes a 60+ minute session
 * hold up: the 30-wave story campaign alone already has enough distinct compositions that repeats
 * are rare, and endless mode keeps recombining them under rising scaling instead of running dry.
 */
const EARLY_WAVES: WaveTemplate[] = [
  { label: 'Første Bølge', tier: 'early', groups: [{ defId: 'goblin', count: 6 }], spawnIntervalMs: 650, bonusGold: 20 },
  { label: 'Skovsti', tier: 'early', groups: [{ defId: 'goblin', count: 8 }], spawnIntervalMs: 550, bonusGold: 24 },
  { label: 'Spejder-Trup', tier: 'early', groups: [{ defId: 'goblin', count: 5 }, { defId: 'goblin_shaman', count: 1 }], spawnIntervalMs: 600, bonusGold: 26 },
  { label: 'Tunge Skridt', tier: 'early', groups: [{ defId: 'orc', count: 3 }], spawnIntervalMs: 900, bonusGold: 28 },
  { label: 'Blandet Flok', tier: 'early', groups: [{ defId: 'goblin', count: 6 }, { defId: 'orc', count: 2 }], spawnIntervalMs: 650, bonusGold: 30 },
  { label: 'Skjoldvagt', tier: 'early', groups: [{ defId: 'orc_shield', count: 2 }, { defId: 'goblin', count: 3 }], spawnIntervalMs: 750, bonusGold: 30 },
  { label: 'Hidsig Start', tier: 'early', groups: [{ defId: 'orc_berserker', count: 2 }, { defId: 'goblin', count: 4 }], spawnIntervalMs: 650, bonusGold: 32 },
];

const MID_WAVES: WaveTemplate[] = [
  { label: 'Orc-Lejr', tier: 'mid', groups: [{ defId: 'orc', count: 5 }, { defId: 'goblin_shaman', count: 1 }], spawnIntervalMs: 600, bonusGold: 40 },
  { label: 'Skjold-Mur', tier: 'mid', groups: [{ defId: 'orc_shield', count: 4 }], spawnIntervalMs: 700, bonusGold: 44 },
  { label: 'Bersærker-Flok', tier: 'mid', groups: [{ defId: 'orc_berserker', count: 3 }, { defId: 'orc', count: 2 }], spawnIntervalMs: 650, bonusGold: 44 },
  { label: 'Shaman-Sværm', tier: 'mid', groups: [{ defId: 'goblin', count: 10 }, { defId: 'goblin_shaman', count: 2 }], spawnIntervalMs: 450, bonusGold: 46 },
  { label: 'Dobbelt Skjold', tier: 'mid', groups: [{ defId: 'orc_shield', count: 3 }, { defId: 'orc_berserker', count: 2 }], spawnIntervalMs: 700, bonusGold: 48 },
  { label: 'Krydsild', tier: 'mid', groups: [{ defId: 'orc', count: 3 }, { defId: 'orc_shield', count: 2 }, { defId: 'goblin', count: 4 }], spawnIntervalMs: 550, bonusGold: 48 },
  { label: 'Grønt Tidevand', tier: 'mid', groups: [{ defId: 'goblin', count: 14 }], spawnIntervalMs: 380, bonusGold: 50 },
];

const LATE_WAVES: WaveTemplate[] = [
  { label: 'Total Angreb', tier: 'late', groups: [{ defId: 'orc', count: 4 }, { defId: 'orc_shield', count: 3 }, { defId: 'goblin_shaman', count: 2 }, { defId: 'goblin', count: 6 }], spawnIntervalMs: 450, bonusGold: 60 },
  { label: 'Bersærker-Storm', tier: 'late', groups: [{ defId: 'orc_berserker', count: 5 }, { defId: 'goblin_shaman', count: 1 }], spawnIntervalMs: 500, bonusGold: 62 },
  { label: 'Jernmur', tier: 'late', groups: [{ defId: 'orc_shield', count: 6 }, { defId: 'orc', count: 2 }], spawnIntervalMs: 600, bonusGold: 64 },
  { label: 'Sidste Skanse', tier: 'late', groups: [{ defId: 'goblin', count: 10 }, { defId: 'orc', count: 4 }, { defId: 'orc_shield', count: 2 }, { defId: 'orc_berserker', count: 2 }], spawnIntervalMs: 420, bonusGold: 66 },
  { label: 'Shaman-Hær', tier: 'late', groups: [{ defId: 'goblin', count: 16 }, { defId: 'goblin_shaman', count: 3 }], spawnIntervalMs: 360, bonusGold: 68 },
  { label: 'Alt På Én Gang', tier: 'late', groups: [{ defId: 'orc', count: 3 }, { defId: 'orc_shield', count: 3 }, { defId: 'orc_berserker', count: 3 }, { defId: 'goblin_shaman', count: 2 }, { defId: 'goblin', count: 5 }], spawnIntervalMs: 430, bonusGold: 70 },
  { label: 'Uendelig Bølge', tier: 'late', groups: [{ defId: 'goblin', count: 12 }, { defId: 'orc', count: 5 }], spawnIntervalMs: 400, bonusGold: 70 },
  { label: 'Mareridt', tier: 'late', groups: [{ defId: 'orc_berserker', count: 4 }, { defId: 'orc_shield', count: 4 }, { defId: 'goblin_shaman', count: 2 }], spawnIntervalMs: 460, bonusGold: 74 },
];

const POOL_BY_TIER: Record<WaveTier, WaveTemplate[]> = { early: EARLY_WAVES, mid: MID_WAVES, late: LATE_WAVES };

/** Every Nth wave (see BALANCE.waves.bossWaveInterval) is a troll wave — troll count and goblin/orc
 * escort both grow with how many boss waves have come before, so "the boss wave" keeps being an
 * event rather than a fixed fight repeated forever. */
function bossWaveTemplate(bossOccurrence: number): WaveTemplate {
  const trollCount = 1 + Math.floor((bossOccurrence - 1) / 3);
  const escortOrcs = Math.min(6, 1 + bossOccurrence);
  const escortGoblins = Math.min(10, 2 + bossOccurrence * 2);
  return {
    label: trollCount > 1 ? `Trold-Horde (${trollCount})` : 'Trold-Angreb',
    tier: 'late',
    groups: [
      { defId: 'troll', count: Math.min(3, trollCount) },
      { defId: 'orc', count: escortOrcs },
      { defId: 'goblin', count: escortGoblins },
    ],
    spawnIntervalMs: 700,
    bonusGold: 90 + bossOccurrence * 10,
  };
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickFrom(pool: WaveTemplate[], n: number): WaveTemplate[] {
  if (pool.length === 0 || n <= 0) return [];
  const shuffled = shuffle(pool);
  const result: WaveTemplate[] = [];
  for (let i = 0; i < n; i++) result.push(shuffled[i % shuffled.length]);
  return result;
}

/** Builds one run's full story-campaign wave order (30 waves by default): boss waves land on every
 * Nth slot, and the remaining slots draw from an early/mid/late-weighted pool (35/35/30 split,
 * same ratios as tactical's buildRoomSequence) so difficulty composition — not just raw
 * scaling — ramps across the campaign. Called once per run. */
export function buildStorySequence(count: number = BALANCE.waves.storyWaveCount): WaveTemplate[] {
  const bossInterval = BALANCE.waves.bossWaveInterval;
  const bossSlots = Math.floor(count / bossInterval);
  const nonBossSlots = count - bossSlots;
  const earlyCount = Math.round(nonBossSlots * 0.35);
  const midCount = Math.round(nonBossSlots * 0.35);
  const lateCount = Math.max(0, nonBossSlots - earlyCount - midCount);
  const nonBossQueue = [...pickFrom(EARLY_WAVES, earlyCount), ...pickFrom(MID_WAVES, midCount), ...pickFrom(LATE_WAVES, lateCount)];

  const sequence: WaveTemplate[] = [];
  let nonBossIdx = 0;
  let bossOccurrence = 0;
  for (let w = 1; w <= count; w++) {
    if (w % bossInterval === 0) {
      bossOccurrence++;
      sequence.push(bossWaveTemplate(bossOccurrence));
    } else {
      sequence.push(nonBossQueue[nonBossIdx++] ?? LATE_WAVES[0]);
    }
  }
  return sequence;
}

/** Endless-mode wave, generated on demand once a run passes the story campaign — boss waves keep
 * landing on the same interval, everything else draws live from the late/mid pool (weighted toward
 * late) so endless mode stays visibly harder in *composition*, not just in scaleForWave()'s numbers. */
function getEndlessWave(waveNumber: number): WaveTemplate {
  const bossInterval = BALANCE.waves.bossWaveInterval;
  if (waveNumber % bossInterval === 0) return bossWaveTemplate(Math.floor(waveNumber / bossInterval));
  const pool = Math.random() < 0.7 ? LATE_WAVES : MID_WAVES;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function getWaveTemplate(waveNumber: number, storySequence: WaveTemplate[]): WaveTemplate {
  if (waveNumber <= storySequence.length) return storySequence[waveNumber - 1];
  return getEndlessWave(waveNumber);
}

export interface WaveScale {
  hpMult: number;
  speedMult: number;
  goldMult: number;
}

/**
 * Difficulty scaling designed in from wave 1, not bolted on after the fact (the explicit lesson
 * carried over from Breach Protocol's endless mode having shipped with none — see balance.ts).
 * Waves 1..storyWaveCount ramp linearly (approachable early, meaningfully harder by the campaign's
 * end); waves past that compound, so an endless run keeps getting harder the whole way instead of
 * plateauing once hand-authored content runs out.
 */
export function scaleForWave(waveNumber: number): WaveScale {
  const story = BALANCE.waves.storyWaveCount;
  const cappedStoryWave = Math.min(waveNumber, story);
  let hpMult = 1 + (cappedStoryWave - 1) * BALANCE.scaling.storyHpPerWave;
  let speedMult = 1 + (cappedStoryWave - 1) * BALANCE.scaling.storySpeedPerWave;
  if (waveNumber > story) {
    const extra = waveNumber - story;
    hpMult *= Math.pow(BALANCE.scaling.endlessHpCompound, extra);
    speedMult = Math.min(BALANCE.scaling.endlessSpeedCap, speedMult * Math.pow(BALANCE.scaling.endlessSpeedCompound, extra));
  }
  const goldMult = BALANCE.scaling.goldMultFromHpMult(hpMult);
  return { hpMult, speedMult, goldMult };
}

export { POOL_BY_TIER };
