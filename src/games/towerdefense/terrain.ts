import { PATH_WAYPOINTS, pointAtPathDistance, pathLengthPx } from './path';

/**
 * Everything drawn here is static per arena size — towerdefense.ts renders it once into an
 * offscreen canvas on resize and blits that each frame, instead of redrawing gradients/scenery
 * every frame at 60fps. Only towers/enemies/projectiles/vfx (the actually-dynamic layer) get
 * redrawn per frame on top of it.
 */

type PropType = 'rock' | 'bush' | 'pine' | 'torch';
interface Prop {
  type: PropType;
  x: number; // fraction
  y: number; // fraction
  scale: number;
}

/** Hand-placed set dressing, one deliberate handful per "room" the serpentine path encloses —
 * same philosophy as the path itself (hand-authored, not procedurally scattered) so nothing ever
 * spawns awkwardly on top of the road. */
const PROPS: Prop[] = [
  { type: 'rock', x: 0.25, y: 0.22, scale: 1 },
  { type: 'bush', x: 0.55, y: 0.2, scale: 1 },
  { type: 'pine', x: 0.7, y: 0.28, scale: 1.1 },
  { type: 'rock', x: 0.46, y: 0.52, scale: 0.85 },
  { type: 'bush', x: 0.3, y: 0.48, scale: 0.9 },
  { type: 'pine', x: 0.66, y: 0.56, scale: 1 },
  { type: 'bush', x: 0.25, y: 0.8, scale: 1 },
  { type: 'rock', x: 0.6, y: 0.76, scale: 1 },
  { type: 'pine', x: 0.38, y: 0.82, scale: 0.95 },
  { type: 'rock', x: 0.94, y: 0.55, scale: 0.8 },
  { type: 'bush', x: 0.5, y: 0.05, scale: 0.7 },
  { type: 'rock', x: 0.12, y: 0.95, scale: 0.75 },
  { type: 'torch', x: 0.78, y: 0.08, scale: 1 },
  { type: 'torch', x: 0.18, y: 0.62, scale: 1 },
];

function seededRand(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function drawGround(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#1d1428');
  grad.addColorStop(1, '#120c1a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Deterministic speckle texture (fixed seed so it's stable across re-resizes at the same size,
  // and never needs to be recomputed per frame — this whole function only runs on resize).
  const rand = seededRand(1337);
  for (let i = 0; i < 90; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const r = 1.5 + rand() * 2.5;
    ctx.fillStyle = rand() > 0.5 ? 'rgba(90,120,70,0.10)' : 'rgba(0,0,0,0.14)';
    ctx.beginPath();
    ctx.ellipse(x, y, r * 1.6, r * 0.7, rand() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawRoad(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const pts = PATH_WAYPOINTS.map((p) => ({ x: p.x * w, y: p.y * h }));
  const roadWidth = Math.max(20, w * 0.04);

  // Outer dirt edge (darker, wider) then inner worn-path fill (lighter tan) on top — reads as a
  // trodden dirt road instead of a glowing line.
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#3a2a1e';
  ctx.lineWidth = roadWidth + 6;
  ctx.beginPath();
  pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.stroke();

  ctx.strokeStyle = '#6b5138';
  ctx.lineWidth = roadWidth;
  ctx.stroke();

  ctx.strokeStyle = 'rgba(154,124,90,0.55)';
  ctx.lineWidth = roadWidth * 0.5;
  ctx.stroke();

  // Worn stone flecks + edge grass tufts at regular intervals along the road.
  const total = pathLengthPx(w, h);
  const step = Math.max(26, roadWidth * 1.4);
  const rand = seededRand(4242);
  for (let d = 10; d < total; d += step) {
    const { pos, angle } = pointAtPathDistance(d, w, h);
    const nx = -Math.sin(angle);
    const ny = Math.cos(angle);

    if (rand() > 0.4) {
      const fx = pos.x + (rand() - 0.5) * roadWidth * 0.7;
      const fy = pos.y + (rand() - 0.5) * roadWidth * 0.7;
      ctx.fillStyle = 'rgba(60,44,32,0.35)';
      ctx.beginPath();
      ctx.ellipse(fx, fy, 3.5, 2.2, rand() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }

    const side = rand() > 0.5 ? 1 : -1;
    const gx = pos.x + nx * (roadWidth / 2 + 3) * side;
    const gy = pos.y + ny * (roadWidth / 2 + 3) * side;
    ctx.strokeStyle = '#4f7a3a';
    ctx.lineWidth = 1.4;
    for (let b = 0; b < 3; b++) {
      const bx = gx + (rand() - 0.5) * 6;
      const by = gy + (rand() - 0.5) * 6;
      ctx.beginPath();
      ctx.moveTo(bx, by + 5);
      ctx.lineTo(bx + (rand() - 0.5) * 3, by - 4 - rand() * 3);
      ctx.stroke();
    }
  }
}

function drawRock(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(1, 9, 15, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#5a5468';
  ctx.beginPath();
  ctx.moveTo(-14, 6);
  ctx.lineTo(-9, -8);
  ctx.lineTo(3, -13);
  ctx.lineTo(14, -3);
  ctx.lineTo(11, 8);
  ctx.lineTo(-6, 10);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#7a7590';
  ctx.beginPath();
  ctx.moveTo(-9, -8);
  ctx.lineTo(3, -13);
  ctx.lineTo(9, -6);
  ctx.lineTo(-2, -3);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawBush(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(0, 9, 15, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  const blobs: [number, number, number, string][] = [
    [-8, 1, 9, '#2f5a2a'],
    [7, 2, 9.5, '#2f5a2a'],
    [0, -6, 10, '#3d7233'],
    [-3, -2, 6, '#5a9a44'],
  ];
  for (const [bx, by, r, c] of blobs) {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(bx, by, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawPine(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 24, 12, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#4a3323';
  ctx.fillRect(-2.5, 12, 5, 10);

  ctx.fillStyle = '#213d24';
  const tiers: [number, number][] = [
    [22, -2],
    [17, -12],
    [12, -22],
  ];
  for (const [wid, topY] of tiers) {
    ctx.beginPath();
    ctx.moveTo(0, topY - 10);
    ctx.lineTo(-wid / 2, topY + 10);
    ctx.lineTo(wid / 2, topY + 10);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = '#2f5a30';
  for (const [wid, topY] of tiers) {
    ctx.beginPath();
    ctx.moveTo(2, topY - 8);
    ctx.lineTo(-2, topY + 9);
    ctx.lineTo(wid / 2 - 1, topY + 9);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawTorch(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);

  const glow = ctx.createRadialGradient(0, -14, 1, 0, -14, 26);
  glow.addColorStop(0, 'rgba(255,154,61,0.45)');
  glow.addColorStop(1, 'rgba(255,154,61,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, -14, 26, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#5a4028';
  ctx.fillRect(-2, -6, 4, 20);

  const flame = ctx.createRadialGradient(0, -16, 1, 0, -16, 10);
  flame.addColorStop(0, '#ffe9a8');
  flame.addColorStop(0.55, '#ff8a3d');
  flame.addColorStop(1, 'rgba(255,138,61,0)');
  ctx.fillStyle = flame;
  ctx.beginPath();
  ctx.moveTo(0, -26);
  ctx.quadraticCurveTo(7, -18, 4, -8);
  ctx.quadraticCurveTo(0, -12, -4, -8);
  ctx.quadraticCurveTo(-7, -18, 0, -26);
  ctx.fill();
  ctx.restore();
}

function drawProps(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  for (const p of PROPS) {
    const x = p.x * w;
    const y = p.y * h;
    const scale = p.scale * Math.min(w, h) * 0.0055;
    if (p.type === 'rock') drawRock(ctx, x, y, scale);
    else if (p.type === 'bush') drawBush(ctx, x, y, scale);
    else if (p.type === 'pine') drawPine(ctx, x, y, scale);
    else drawTorch(ctx, x, y, scale);
  }
}

/** Cave mouth at the path's spawn end — replaces the plain dot marker. */
function drawSpawnCave(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const p = PATH_WAYPOINTS[0];
  const x = p.x * w;
  const y = p.y * h;
  const r = Math.max(20, w * 0.032);

  ctx.fillStyle = '#3a3348';
  ctx.beginPath();
  ctx.ellipse(x, y, r * 1.3, r * 1.1, 0, 0, Math.PI * 2);
  ctx.fill();

  const inner = ctx.createRadialGradient(x, y, 1, x, y, r);
  inner.addColorStop(0, '#050308');
  inner.addColorStop(1, '#1c1626');
  ctx.fillStyle = inner;
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.82, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#5a5468';
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const tx = x + Math.cos(a) * r * 1.15;
    const ty = y + Math.sin(a) * r * 0.95;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(tx + Math.cos(a) * 7, ty + Math.sin(a) * 7);
    ctx.lineTo(tx + Math.cos(a + 0.5) * 5, ty + Math.sin(a + 0.5) * 5);
    ctx.closePath();
    ctx.fill();
  }
  const glow = ctx.createRadialGradient(x, y, 1, x, y, r * 0.6);
  glow.addColorStop(0, 'rgba(139,107,255,0.35)');
  glow.addColorStop(1, 'rgba(139,107,255,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.6, 0, Math.PI * 2);
  ctx.fill();
}

/** Small keep/gate at the path's end — replaces the plain dot marker. */
function drawGateKeep(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const p = PATH_WAYPOINTS[PATH_WAYPOINTS.length - 1];
  const x = p.x * w;
  const y = p.y * h;
  const s = Math.max(18, w * 0.028);

  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(x, y + s * 0.9, s * 2.3, s * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();

  const towerColor = '#6b5a70';
  const crenel = (cx: number) => {
    ctx.fillStyle = towerColor;
    ctx.fillRect(cx - s * 0.42, y - s * 1.5, s * 0.84, s * 1.9);
    ctx.fillStyle = '#544560';
    for (let i = -1; i <= 1; i++) {
      ctx.fillRect(cx + i * s * 0.3 - s * 0.09, y - s * 1.75, s * 0.18, s * 0.3);
    }
  };
  crenel(x - s * 1.15);
  crenel(x + s * 1.15);

  ctx.fillStyle = '#241a1f';
  ctx.beginPath();
  ctx.moveTo(x - s * 0.65, y + s * 0.4);
  ctx.lineTo(x - s * 0.65, y - s * 0.5);
  ctx.quadraticCurveTo(x, y - s * 1.1, x + s * 0.65, y - s * 0.5);
  ctx.lineTo(x + s * 0.65, y + s * 0.4);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = '#ff5d7a';
  ctx.lineWidth = s * 0.12;
  ctx.beginPath();
  ctx.moveTo(x - s * 1.15, y - s * 1.5);
  ctx.lineTo(x - s * 1.15, y - s * 2.3);
  ctx.lineTo(x - s * 0.75, y - s * 1.95);
  ctx.closePath();
  ctx.fillStyle = '#ff5d7a';
  ctx.fill();
}

/** Renders the full static map into ctx (an offscreen canvas sized to the current arena) — call
 * once on resize, then blit the result every frame instead of redrawing all this per frame. */
export function renderTerrain(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.clearRect(0, 0, w, h);
  drawGround(ctx, w, h);
  drawProps(ctx, w, h);
  drawRoad(ctx, w, h);
  drawSpawnCave(ctx, w, h);
  drawGateKeep(ctx, w, h);
}
