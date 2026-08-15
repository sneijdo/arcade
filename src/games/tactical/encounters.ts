import type { EnemyId } from './types';
import type { ObstacleDef } from './obstacles';

export type RoomTier = 'early' | 'mid' | 'late';

export interface EncounterWave {
  label: string;
  enemies: { defId: EnemyId; count: number }[];
  spawnIntervalMs: number;
  isElite?: boolean;
  /** Fractions (0-1) of arena size — see obstacles.ts. */
  obstacles?: ObstacleDef[];
  /** Where this room can be drawn from when building a run's sequence — see buildRoomSequence(). */
  tier: RoomTier;
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

// One offset block near the shotgunner's side — teaches "don't walk straight
// at a shotgun," the single lesson this room exists to deliver.
const FIRST_CONTACT_COVER: ObstacleDef[] = [{ x: 0.55, y: 0.35, w: 0.15, h: 0.2 }];

// One central pillar breaks both riflemen's sightlines at once — the
// player learns that a single well-placed block can neutralize two
// separate ranged threats, not just one.
const CROSSFIRE_PILLAR_COVER: ObstacleDef[] = [{ x: 0.43, y: 0.42, w: 0.14, h: 0.16 }];

// Deliberately empty — a pure-melee swarm room is a movement/kiting test,
// not a cover test. Adding cover here would let the player camp instead of
// having to actually outmaneuver four things closing at once.
const LIGHTNING_STRIKE_COVER: ObstacleDef[] = [];

// A wide wall blocks the direct frontal line to the spawn center, so
// standing still and facing "forward" stops working — flankers curving in
// from the sides become the room's actual threat, not the rifleman behind
// the wall.
const FLANK_WALL_COVER: ObstacleDef[] = [{ x: 0.3, y: 0.42, w: 0.4, h: 0.16 }];

// Two duck spots on opposite sides — with two snipers you can't predict
// which side either one lands on, so (unlike the single-sniper "Skudlinje"
// room) there's no single safe corner; you have to keep moving between
// cover as both sightlines shift.
const DOUBLE_SNIPER_COVER: ObstacleDef[] = [
  { x: 0.14, y: 0.38, w: 0.13, h: 0.14 },
  { x: 0.73, y: 0.48, w: 0.13, h: 0.14 },
];

// Offset cover breaks the sniper's long sightline and the shotgunners'
// close-range spread independently — you need a different piece of cover
// for each threat, not one that solves both.
const CLOSE_QUARTERS_COVER: ObstacleDef[] = [
  { x: 0.35, y: 0.25, w: 0.12, h: 0.12 },
  { x: 0.5, y: 0.55, w: 0.13, h: 0.13 },
];

// Three blocks, busier than "Advarselsskud" — one more enemy, tighter
// spawn interval, same crossfire-breaking idea pushed further.
const OVERHEAT_COVER: ObstacleDef[] = [
  { x: 0.18, y: 0.25, w: 0.12, h: 0.12 },
  { x: 0.68, y: 0.3, w: 0.12, h: 0.12 },
  { x: 0.42, y: 0.6, w: 0.14, h: 0.14 },
];

// Four corner blocks, symmetric — the hardest room in the pool. Every
// archetype is present at once with an aggressive spawn interval, so cover
// has to serve constantly shifting priorities rather than one fixed danger.
const TOTAL_WAR_COVER: ObstacleDef[] = [
  { x: 0.15, y: 0.18, w: 0.12, h: 0.12 },
  { x: 0.7, y: 0.18, w: 0.12, h: 0.12 },
  { x: 0.15, y: 0.65, w: 0.12, h: 0.12 },
  { x: 0.7, y: 0.65, w: 0.12, h: 0.12 },
];

// Two wide blocks give room to circle around the brutes without ever fully
// losing them — kiting room, not a hiding room. A slow, heavy threat with
// nowhere to truly break line of sight forces you to keep moving instead
// of camping one spot.
const HEAVY_ORDNANCE_COVER: ObstacleDef[] = [
  { x: 0.18, y: 0.3, w: 0.16, h: 0.14 },
  { x: 0.66, y: 0.56, w: 0.16, h: 0.14 },
];

// Deliberately sparse — suppressors punish standing still far more than
// they punish being in the open, so heavy cover would trivialize the room's
// actual lesson (keep moving, don't trade shots at a fixed spot).
const SUPPRESSIVE_FIRE_COVER: ObstacleDef[] = [{ x: 0.43, y: 0.44, w: 0.14, h: 0.12 }];

/**
 * Pool of handcrafted room templates, tagged by tier — NOT a fixed linear
 * list anymore. buildRoomSequence() draws a run's actual room order from
 * here, so runs vary and the pool can grow (new rooms are pure data) without
 * every run getting longer or needing manual reordering. Spec: "handcrafted
 * + procedural selection, not pure random gen."
 */
export const ENCOUNTER_POOL: EncounterWave[] = [
  // Teaches the core loop: stop-to-fire against a pure ranged threat, with
  // one piece of cover to introduce line-of-sight breaking at low stakes.
  { label: 'Åben Ild', tier: 'early', enemies: [{ defId: 'rifleman', count: 3 }], spawnIntervalMs: 750, obstacles: OPEN_FIRE_COVER },

  // Forces a lane choice at the chokepoint while rushers close distance,
  // flankers arc in from the side you're not watching, and the shotgunner
  // punishes whoever camps too close to the doorway.
  { label: 'Klemme', tier: 'early', enemies: [{ defId: 'rusher', count: 2 }, { defId: 'flanker', count: 2 }, { defId: 'shotgunner', count: 1 }], spawnIntervalMs: 600, obstacles: CHOKE_COVER },

  // The signature dilemma: deal with the sniper (dangerous, telegraphed,
  // stationary — but ignoring it is punished hard) or handle the rushers
  // closing in (urgent, but individually weak). Can't fully do both.
  { label: 'Skudlinje', tier: 'mid', enemies: [{ defId: 'sniper', count: 1 }, { defId: 'rusher', count: 3 }], spawnIntervalMs: 550, obstacles: SNIPER_LANE_COVER },

  // Difficulty spike: a genuinely tanky, longer-ranged threat with two
  // riflemen adding chip damage so the player can't circle-strafe forever.
  { label: 'Elite-Enhed', tier: 'mid', enemies: [{ defId: 'elite_rifleman', count: 1 }, { defId: 'rifleman', count: 2 }], spawnIntervalMs: 500, isElite: true, obstacles: ELITE_FLANK_COVER },

  // Close-range swarm: standing still anywhere near multiple shotgunners
  // is lethal, so this room is about constant repositioning and using
  // cover to avoid overlapping pellet spreads, not just outgunning them.
  { label: 'Advarselsskud', tier: 'late', enemies: [{ defId: 'shotgunner', count: 3 }, { defId: 'rusher', count: 1 }], spawnIntervalMs: 420, obstacles: SHOTGUN_KILLZONE_COVER },

  // Combined-arms finale before the boss — one of everything, spawning
  // fast enough that priority calls matter (sniper vs. rushers/flankers vs.
  // the shotgunner's close-range threat vs. steady rifleman chip damage).
  { label: 'Sidste Forsvar', tier: 'late', enemies: [{ defId: 'rifleman', count: 2 }, { defId: 'shotgunner', count: 1 }, { defId: 'rusher', count: 1 }, { defId: 'flanker', count: 1 }, { defId: 'sniper', count: 1 }], spawnIntervalMs: 480, obstacles: LAST_STAND_COVER },

  // The gentlest room in the pool — one piece of cover placed specifically
  // to teach "peek, don't walk straight at a shotgun," before the game
  // ever asks for more than that.
  { label: 'Første Kontakt', tier: 'early', enemies: [{ defId: 'rifleman', count: 2 }, { defId: 'shotgunner', count: 1 }], spawnIntervalMs: 700, obstacles: FIRST_CONTACT_COVER },

  // A single pillar solves two riflemen's sightlines at once — teaches that
  // cover placement, not raw reaction speed, is the answer to multiple
  // ranged threats.
  { label: 'Krydsild', tier: 'early', enemies: [{ defId: 'rifleman', count: 2 }, { defId: 'rusher', count: 1 }], spawnIntervalMs: 650, obstacles: CROSSFIRE_PILLAR_COVER },

  // Pure movement/kiting test: four melee threats, zero cover. There's
  // nowhere to hide, so the only answer is constant repositioning and
  // picking who dies first.
  { label: 'Lynangreb', tier: 'early', enemies: [{ defId: 'rusher', count: 3 }, { defId: 'flanker', count: 1 }], spawnIntervalMs: 550, obstacles: LIGHTNING_STRIKE_COVER },

  // A wall blocks the obvious frontal approach, so the rifleman behind it
  // isn't the real threat — the flankers curving in from both sides are.
  // Standing still and facing "forward" is actively wrong here.
  { label: 'Flankeangreb', tier: 'mid', enemies: [{ defId: 'flanker', count: 3 }, { defId: 'rifleman', count: 1 }], spawnIntervalMs: 520, obstacles: FLANK_WALL_COVER },

  // Second sniper dilemma variant: two snipers instead of one means no
  // single safe corner exists, so the room is about reading which sightline
  // is live right now rather than memorizing one danger zone.
  { label: 'Dobbelt Sigte', tier: 'mid', enemies: [{ defId: 'sniper', count: 2 }, { defId: 'rusher', count: 2 }], spawnIntervalMs: 580, obstacles: DOUBLE_SNIPER_COVER },

  // Sniper + shotgunner instead of sniper + rushers: one threat wants
  // distance, one wants close range, and neither piece of cover solves both
  // at once.
  { label: 'Nærkampszone', tier: 'late', enemies: [{ defId: 'sniper', count: 1 }, { defId: 'shotgunner', count: 2 }, { defId: 'rusher', count: 1 }], spawnIntervalMs: 460, obstacles: CLOSE_QUARTERS_COVER },

  // Busier than "Advarselsskud" — one more body, tighter spawn interval,
  // same crossfire-breaking lesson pushed to its limit.
  { label: 'Overophedning', tier: 'late', enemies: [{ defId: 'rifleman', count: 2 }, { defId: 'shotgunner', count: 2 }, { defId: 'rusher', count: 1 }, { defId: 'flanker', count: 1 }], spawnIntervalMs: 430, obstacles: OVERHEAT_COVER },

  // The hardest room in the pool: every archetype at once on an aggressive
  // spawn timer. Cover has to serve whichever threat is most urgent right
  // now, not a fixed danger — priorities shift constantly.
  { label: 'Total Krig', tier: 'late', enemies: [{ defId: 'sniper', count: 1 }, { defId: 'shotgunner', count: 1 }, { defId: 'flanker', count: 2 }, { defId: 'rusher', count: 2 }], spawnIntervalMs: 420, obstacles: TOTAL_WAR_COVER },

  // Introduces the brute: slow but hits hard and soaks a lot of damage —
  // this room is a kiting test, not a burst-them-down test. One rifleman
  // adds chip pressure so circling the brutes forever isn't free either.
  { label: 'Tungt Skyts', tier: 'mid', enemies: [{ defId: 'brute', count: 2 }, { defId: 'rifleman', count: 1 }], spawnIntervalMs: 700, obstacles: HEAVY_ORDNANCE_COVER },

  // Introduces the suppressor: weak per hit but attacks nearly three times
  // as often as a rifleman, so standing still anywhere near one bleeds you
  // out fast even though no single shot feels dangerous. Constant movement
  // beats trading shots.
  { label: 'Undertrykkende Ild', tier: 'late', enemies: [{ defId: 'suppressor', count: 3 }, { defId: 'rusher', count: 1 }], spawnIntervalMs: 480, obstacles: SUPPRESSIVE_FIRE_COVER },
];

/** How many non-boss rooms a run draws from the pool (plus 1 boss room). */
export const NON_BOSS_ROOM_COUNT = 9;
export const TOTAL_ROOMS = NON_BOSS_ROOM_COUNT + 1;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickFrom(pool: EncounterWave[], n: number): EncounterWave[] {
  if (pool.length === 0 || n <= 0) return [];
  const shuffled = shuffle(pool);
  const result: EncounterWave[] = [];
  for (let i = 0; i < n; i++) result.push(shuffled[i % shuffled.length]); // repeats only if the pool is smaller than the draw
  return result;
}

/**
 * Builds one run's room order: an early/mid/late split with exactly one
 * elite room placed after the early rooms (a difficulty spike that isn't
 * right at the start, isn't saved for literally the last room either).
 * Called once per run (see tactical.ts's startRun), so every run's room
 * order — not just enemy positions — varies.
 */
export function buildRoomSequence(count: number = NON_BOSS_ROOM_COUNT): EncounterWave[] {
  const early = ENCOUNTER_POOL.filter((r) => r.tier === 'early' && !r.isElite);
  const mid = ENCOUNTER_POOL.filter((r) => r.tier === 'mid' && !r.isElite);
  const late = ENCOUNTER_POOL.filter((r) => r.tier === 'late' && !r.isElite);
  const eliteRooms = ENCOUNTER_POOL.filter((r) => r.isElite);

  const earlyCount = Math.round(count * 0.35);
  const midCount = Math.round(count * 0.3);
  const lateCount = Math.max(0, count - earlyCount - midCount - 1); // -1 reserves a slot for the elite room

  const elitePick = eliteRooms.length ? shuffle(eliteRooms)[0] : (mid[0] ?? early[0]);
  const sequence = [...pickFrom(early, earlyCount), ...pickFrom(mid, midCount), elitePick, ...pickFrom(late, lateCount)];
  return sequence.slice(0, count);
}
