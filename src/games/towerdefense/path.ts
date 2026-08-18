import type { Vec2 } from '../shared/vec';

/**
 * One hand-authored serpentine path (spawn top-left, gate bottom-middle) — fractions of arena
 * size, same 0-1 scheme as ObstacleDef in shared/obstacles.ts, so it holds up at any canvas size.
 * v1 ships a single fixed layout (see plan); multiple randomized layouts are an explicit v2 item.
 */
export const PATH_WAYPOINTS: Vec2[] = [
  { x: 0.04, y: 0.12 },
  { x: 0.82, y: 0.12 },
  { x: 0.82, y: 0.4 },
  { x: 0.14, y: 0.4 },
  { x: 0.14, y: 0.66 },
  { x: 0.86, y: 0.66 },
  { x: 0.86, y: 0.9 },
  { x: 0.46, y: 0.9 },
];

export interface BuildSlot {
  id: string;
  pos: Vec2; // fractions
}

const SLOT_OFFSET = 0.045;
const SLOT_TS = [0.32, 0.68];

/**
 * Build slots are derived from the path rather than hand-typed one at a time — two per segment,
 * offset perpendicular to alternating sides — so the layout can't accidentally overlap the path
 * itself or drift off-canvas. Deterministic (no randomness), so the map is identical every game,
 * matching the "one fixed path" v1 decision.
 */
function generateSlots(): BuildSlot[] {
  const slots: BuildSlot[] = [];
  let idx = 0;
  for (let i = 0; i < PATH_WAYPOINTS.length - 1; i++) {
    const a = PATH_WAYPOINTS[i];
    const b = PATH_WAYPOINTS[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    for (let ti = 0; ti < SLOT_TS.length; ti++) {
      const t = SLOT_TS[ti];
      const baseX = a.x + dx * t;
      const baseY = a.y + dy * t;
      const side = (i + ti) % 2 === 0 ? 1 : -1;
      const x = Math.max(0.03, Math.min(0.97, baseX + nx * SLOT_OFFSET * side));
      const y = Math.max(0.03, Math.min(0.97, baseY + ny * SLOT_OFFSET * side));
      slots.push({ id: `slot-${idx++}`, pos: { x, y } });
    }
  }
  return slots;
}

export const BUILD_SLOTS: BuildSlot[] = generateSlots();

/** Total path length in px for a given arena size — used to know when an enemy reaches the gate. */
export function pathLengthPx(arenaW: number, arenaH: number): number {
  let total = 0;
  for (let i = 0; i < PATH_WAYPOINTS.length - 1; i++) {
    const a = PATH_WAYPOINTS[i];
    const b = PATH_WAYPOINTS[i + 1];
    total += Math.hypot((b.x - a.x) * arenaW, (b.y - a.y) * arenaH);
  }
  return total;
}

/** Resolves a distance-traveled-along-path value to a pixel position + facing angle. Distance
 * beyond the path's total length clamps to the final waypoint (the gate). */
export function pointAtPathDistance(dist: number, arenaW: number, arenaH: number): { pos: Vec2; angle: number } {
  let remaining = Math.max(0, dist);
  for (let i = 0; i < PATH_WAYPOINTS.length - 1; i++) {
    const a = { x: PATH_WAYPOINTS[i].x * arenaW, y: PATH_WAYPOINTS[i].y * arenaH };
    const b = { x: PATH_WAYPOINTS[i + 1].x * arenaW, y: PATH_WAYPOINTS[i + 1].y * arenaH };
    const segLen = Math.hypot(b.x - a.x, b.y - a.y);
    if (remaining <= segLen || i === PATH_WAYPOINTS.length - 2) {
      const t = segLen < 1e-6 ? 0 : Math.min(1, remaining / segLen);
      return {
        pos: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t },
        angle: Math.atan2(b.y - a.y, b.x - a.x),
      };
    }
    remaining -= segLen;
  }
  const last = PATH_WAYPOINTS[PATH_WAYPOINTS.length - 1];
  return { pos: { x: last.x * arenaW, y: last.y * arenaH }, angle: 0 };
}
