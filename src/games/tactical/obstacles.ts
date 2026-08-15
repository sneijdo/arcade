import type { Vec2 } from './types';

/** Room data expresses obstacles as fractions (0-1) of arena size so the same room definition works at any canvas size. */
export interface ObstacleDef {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ObstacleRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function toPixelRects(defs: ObstacleDef[], arenaW: number, arenaH: number): ObstacleRect[] {
  return defs.map((d) => ({ x: d.x * arenaW, y: d.y * arenaH, w: d.w * arenaW, h: d.h * arenaH }));
}

/** Pushes a circle out of any obstacle it's overlapping — used for both player and enemy movement so cover actually blocks movement, not just line of sight. */
export function resolveCircleVsObstacles(pos: Vec2, radius: number, obstacles: ObstacleRect[]): void {
  for (const r of obstacles) {
    const closestX = Math.max(r.x, Math.min(pos.x, r.x + r.w));
    const closestY = Math.max(r.y, Math.min(pos.y, r.y + r.h));
    const dx = pos.x - closestX;
    const dy = pos.y - closestY;
    const distSq = dx * dx + dy * dy;
    if (distSq < radius * radius) {
      const dist = Math.sqrt(distSq) || 0.0001;
      const push = radius - dist;
      pos.x += (dx / dist) * push;
      pos.y += (dy / dist) * push;
    }
  }
}

function cross(o: Vec2, a: Vec2, b: Vec2): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

function segmentsIntersect(p1: Vec2, p2: Vec2, p3: Vec2, p4: Vec2): boolean {
  const d1 = cross(p3, p4, p1);
  const d2 = cross(p3, p4, p2);
  const d3 = cross(p1, p2, p3);
  const d4 = cross(p1, p2, p4);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
  return false;
}

function pointInRect(p: Vec2, r: ObstacleRect): boolean {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

function segmentIntersectsRect(a: Vec2, b: Vec2, r: ObstacleRect): boolean {
  if (pointInRect(a, r) || pointInRect(b, r)) return true;
  const tl = { x: r.x, y: r.y };
  const tr = { x: r.x + r.w, y: r.y };
  const bl = { x: r.x, y: r.y + r.h };
  const br = { x: r.x + r.w, y: r.y + r.h };
  return segmentsIntersect(a, b, tl, tr) || segmentsIntersect(a, b, tr, br) || segmentsIntersect(a, b, br, bl) || segmentsIntersect(a, b, bl, tl);
}

export function hasLineOfSight(a: Vec2, b: Vec2, obstacles: ObstacleRect[]): boolean {
  for (const r of obstacles) {
    if (segmentIntersectsRect(a, b, r)) return false;
  }
  return true;
}
