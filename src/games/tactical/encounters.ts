import type { EnemyId } from './types';
import type { ObstacleDef } from './obstacles';

export interface EncounterWave {
  label: string;
  enemies: { defId: EnemyId; count: number }[];
  spawnIntervalMs: number;
  isElite?: boolean;
  /** Fractions (0-1) of arena size — see obstacles.ts. */
  obstacles?: ObstacleDef[];
}

// Single duck-behind block near the middle — gentle, doesn't block much,
// just introduces "cover exists" before later rooms lean on it.
const OPEN_FIRE_COVER: ObstacleDef[] = [{ x: 0.42, y: 0.4, w: 0.16, h: 0.18 }];

// A vertical wall split into two segments with a gap in the middle third —
// a doorway players and rushers alike have to funnel through, with open
// space at the very top/bottom edges so nothing gets fully walled off
// (enemies here only push out of overlap, they don't pathfind).
const CHOKE_COVER: ObstacleDef[] = [
  { x: 0.44, y: 0.08, w: 0.1, h: 0.3 },
  { x: 0.44, y: 0.62, w: 0.1, h: 0.3 },
];

// Three blocks spread wide (not clustered) so there's always a reachable
// duck option no matter which edge the sniper happens to spawn on — you
// can't predict its side, so the room can't rely on one "correct" corner.
const SNIPER_LANE_COVER: ObstacleDef[] = [
  { x: 0.15, y: 0.6, w: 0.14, h: 0.14 },
  { x: 0.72, y: 0.2, w: 0.14, h: 0.14 },
  { x: 0.44, y: 0.68, w: 0.14, h: 0.14 },
];

// Two flank blocks, center left open — the elite itself is the obstacle
// here, not the terrain; cover is for breathing room against its escort,
// not for hiding from the elite indefinitely.
const ELITE_FLANK_COVER: ObstacleDef[] = [
  { x: 0.12, y: 0.35, w: 0.13, h: 0.13 },
  { x: 0.75, y: 0.55, w: 0.13, h: 0.13 },
];

// Offset cluster (not a neat grid) so no single position gets hit by two
// shotgun spreads from different angles at once — breaks multi-angle
// crossfire, which is the actual danger of this room, not raw enemy count.
const SHOTGUN_KILLZONE_COVER: ObstacleDef[] = [
  { x: 0.38, y: 0.42, w: 0.12, h: 0.12 },
  { x: 0.58, y: 0.3, w: 0.1, h: 0.1 },
  { x: 0.2, y: 0.68, w: 0.12, h: 0.12 },
];

// Busiest layout in the run (finale) — a mix of the choke and duck ideas
// from earlier rooms so every tool the player has learned is usable.
const LAST_STAND_COVER: ObstacleDef[] = [
  { x: 0.2, y: 0.2, w: 0.13, h: 0.13 },
  { x: 0.67, y: 0.2, w: 0.13, h: 0.13 },
  { x: 0.44, y: 0.62, w: 0.14, h: 0.14 },
];

/** Handcrafted room templates selected in sequence — not fully random (spec: "handcrafted + procedural selection, not pure random gen"). Each room is built around a specific decision, not just "spawn enemies until dead." */
export const ENCOUNTERS: EncounterWave[] = [
  // Teaches the core loop: stop-to-fire against a pure ranged threat, with
  // one piece of cover to introduce line-of-sight breaking at low stakes.
  { label: 'Åben Ild', enemies: [{ defId: 'rifleman', count: 3 }], spawnIntervalMs: 750, obstacles: OPEN_FIRE_COVER },

  // Forces a lane choice at the chokepoint while rushers close distance,
  // flankers arc in from the side you're not watching, and the shotgunner
  // punishes whoever camps too close to the doorway.
  { label: 'Klemme', enemies: [{ defId: 'rusher', count: 2 }, { defId: 'flanker', count: 2 }, { defId: 'shotgunner', count: 1 }], spawnIntervalMs: 600, obstacles: CHOKE_COVER },

  // The signature dilemma: deal with the sniper (dangerous, telegraphed,
  // stationary — but ignoring it is punished hard) or handle the rushers
  // closing in (urgent, but individually weak). Can't fully do both.
  { label: 'Skudlinje', enemies: [{ defId: 'sniper', count: 1 }, { defId: 'rusher', count: 3 }], spawnIntervalMs: 550, obstacles: SNIPER_LANE_COVER },

  // Difficulty spike: a genuinely tanky, longer-ranged threat with two
  // riflemen adding chip damage so the player can't circle-strafe forever.
  { label: 'Elite-Enhed', enemies: [{ defId: 'elite_rifleman', count: 1 }, { defId: 'rifleman', count: 2 }], spawnIntervalMs: 500, isElite: true, obstacles: ELITE_FLANK_COVER },

  // Close-range swarm: standing still anywhere near multiple shotgunners
  // is lethal, so this room is about constant repositioning and using
  // cover to avoid overlapping pellet spreads, not just outgunning them.
  { label: 'Advarselsskud', enemies: [{ defId: 'shotgunner', count: 3 }, { defId: 'rusher', count: 1 }], spawnIntervalMs: 420, obstacles: SHOTGUN_KILLZONE_COVER },

  // Combined-arms finale before the boss — one of everything, spawning
  // fast enough that priority calls matter (sniper vs. rushers/flankers vs.
  // the shotgunner's close-range threat vs. steady rifleman chip damage).
  { label: 'Sidste Forsvar', enemies: [{ defId: 'rifleman', count: 2 }, { defId: 'shotgunner', count: 1 }, { defId: 'rusher', count: 1 }, { defId: 'flanker', count: 1 }, { defId: 'sniper', count: 1 }], spawnIntervalMs: 480, obstacles: LAST_STAND_COVER },
];

export const TOTAL_ROOMS = ENCOUNTERS.length + 1; // +1 for the boss room
