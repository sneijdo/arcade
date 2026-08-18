/** Generic 2D vector math — shared by every canvas-based game (Breach Protocol, Ember Ward, ...).
 * No game-specific coupling; lives here rather than inside one game's types.ts so a new game
 * doesn't have to reach into another game's folder for basic geometry. */
export interface Vec2 {
  x: number;
  y: number;
}

export function vAdd(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}
export function vSub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}
export function vScale(a: Vec2, s: number): Vec2 {
  return { x: a.x * s, y: a.y * s };
}
export function vLen(a: Vec2): number {
  return Math.hypot(a.x, a.y);
}
export function vDist(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
export function vNorm(a: Vec2): Vec2 {
  const len = vLen(a);
  return len < 1e-6 ? { x: 0, y: 0 } : { x: a.x / len, y: a.y / len };
}
export function vAngle(a: Vec2): number {
  return Math.atan2(a.y, a.x);
}
