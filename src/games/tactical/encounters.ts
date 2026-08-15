import type { EnemyId } from './types';

export interface EncounterWave {
  label: string;
  enemies: { defId: EnemyId; count: number }[];
  spawnIntervalMs: number;
  isElite?: boolean;
}

/** Handcrafted room templates selected in sequence — not fully random (spec: "handcrafted + procedural selection, not pure random gen"). */
export const ENCOUNTERS: EncounterWave[] = [
  { label: 'Riflemænd', enemies: [{ defId: 'rifleman', count: 3 }], spawnIntervalMs: 700 },
  { label: 'Fremrykning', enemies: [{ defId: 'rifleman', count: 2 }, { defId: 'rusher', count: 2 }], spawnIntervalMs: 650 },
  { label: 'Nærkamp', enemies: [{ defId: 'shotgunner', count: 2 }, { defId: 'rusher', count: 2 }], spawnIntervalMs: 600 },
  { label: 'Elite-enhed', enemies: [{ defId: 'elite_rifleman', count: 1 }, { defId: 'rifleman', count: 2 }], spawnIntervalMs: 500, isElite: true },
  { label: 'Skarpskytter', enemies: [{ defId: 'sniper', count: 2 }, { defId: 'rusher', count: 3 }], spawnIntervalMs: 550 },
  { label: 'Sidste Forsvar', enemies: [{ defId: 'rifleman', count: 3 }, { defId: 'shotgunner', count: 2 }, { defId: 'rusher', count: 2 }], spawnIntervalMs: 480 },
];

export const TOTAL_ROOMS = ENCOUNTERS.length + 1; // +1 for the boss room
