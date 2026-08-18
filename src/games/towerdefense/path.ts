import type { Vec2 } from '../shared/vec';

/**
 * One hand-authored serpentine path (spawn top-left, gate bottom-middle) — fractions of arena
 * size, same 0-1 scheme as ObstacleDef in shared/obstacles.ts, so it holds up at any canvas size.
 * v1 ships a single fixed layout; multiple randomized layouts are an explicit v2 item.
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

function distToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq < 1e-9 ? 0 : ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = a.x + dx * t;
  const cy = a.y + dy * t;
  return Math.hypot(p.x - cx, p.y - cy);
}

/** Shortest distance in px from a point to the path polyline — the core check behind free tower
 * placement (a tower must clear the road by some margin, see MIN_DIST_FROM_PATH_PX in
 * towerdefense.ts) now that placement isn't restricted to pre-baked slots. */
export function distanceToPathPx(point: Vec2, arenaW: number, arenaH: number): number {
  let best = Infinity;
  for (let i = 0; i < PATH_WAYPOINTS.length - 1; i++) {
    const a = { x: PATH_WAYPOINTS[i].x * arenaW, y: PATH_WAYPOINTS[i].y * arenaH };
    const b = { x: PATH_WAYPOINTS[i + 1].x * arenaW, y: PATH_WAYPOINTS[i + 1].y * arenaH };
    best = Math.min(best, distToSegment(point, a, b));
  }
  return best;
}
