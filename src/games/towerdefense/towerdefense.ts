import { finishGameSession } from '../../state';
import { wireGameChrome } from '../../gameChrome';
import { ScoreKinds } from '../../scoring';
import { Haptics } from '../../haptics';
import { Sound } from '../../sound';
import { toast } from '../../toast';
import { EmberWardSound } from './audio';
import * as hud from './hud';
import { pathLengthPx, pointAtPathDistance, distanceToPathPx } from './path';
import { renderTerrain } from './terrain';
import { getTowerSprite, getEnemySprite, isSpriteReady, preloadSprites } from './sprites';
import { TOWER_DEFS, listTowers } from './towers';
import { ENEMY_DEFS } from './enemies';
import { spawnEnemy, updateEnemyMovement, applyEnemyDamage, applySlow } from './enemyRuntime';
import { buildStorySequence, getWaveTemplate, scaleForWave, type WaveScale } from './waves';
import { BALANCE } from './balance';
import { spawnProjectile, updateProjectiles, resolveChainTargets, type TdProjectile, type ZapEffect } from './combat';
import { VfxSystem } from '../shared/vfx';
import type { Vec2 } from '../shared/vec';
import type { EnemyInstance, TowerInstance, TowerId, WaveTemplate, SpawnTicket } from './types';

/** Minimum gap (px) a new tower must keep from the road centerline — derived from the road's own
 * rendered width (see terrain.ts's drawRoad) plus a fixed clearance, so towers never blot out the
 * path itself no matter the arena size. */
function pathClearancePx(arenaW: number): number {
  const roadHalfWidth = Math.max(20, arenaW * 0.04) / 2;
  return roadHalfWidth + 22;
}

/** Minimum gap (px) between two tower centers — just enough that placed towers don't visually
 * overlap; free placement is otherwise unrestricted (see the user ask: fixed build slots "take
 * some of the game away"). */
const MIN_TOWER_SPACING_PX = 34;
const PLACEMENT_EDGE_MARGIN_PX = 20;

type RunPhase = 'intro' | 'playing' | 'gameover';

interface RunState {
  phase: RunPhase;
  gold: number;
  lives: number;
  waveNumber: number;
  wavesCleared: number;
  totalKills: number;
  storySequence: WaveTemplate[];
  currentWave: WaveTemplate | null;
  currentScale: WaveScale;
  waveActive: boolean;
  spawnQueue: SpawnTicket[];
  autoStartRemaining: number;
  towers: TowerInstance[];
  enemies: EnemyInstance[];
  projectiles: TdProjectile[];
  zaps: ZapEffect[];
  vfx: VfxSystem;
  nextTowerId: number;
  arenaW: number;
  arenaH: number;
  pathLenPx: number;
  bossMaxHpSeen: number;
  canvas: HTMLCanvasElement | null;
  ctx: CanvasRenderingContext2D | null;
  bgCanvas: HTMLCanvasElement | null;
  bgCtx: CanvasRenderingContext2D | null;
  rafId: number | null;
  lastTime: number;
}

let run: RunState | null = null;

function makeRunState(): RunState {
  return {
    phase: 'intro',
    gold: BALANCE.economy.startingGold,
    lives: BALANCE.economy.startingLives,
    waveNumber: 1,
    wavesCleared: 0,
    totalKills: 0,
    storySequence: buildStorySequence(),
    currentWave: null,
    currentScale: { hpMult: 1, speedMult: 1, goldMult: 1 },
    waveActive: false,
    spawnQueue: [],
    autoStartRemaining: 0,
    towers: [],
    enemies: [],
    projectiles: [],
    zaps: [],
    vfx: new VfxSystem(),
    nextTowerId: 1,
    arenaW: 760,
    arenaH: 570,
    pathLenPx: 0,
    bossMaxHpSeen: 0,
    canvas: null,
    ctx: null,
    bgCanvas: null,
    bgCtx: null,
    rafId: null,
    lastTime: 0,
  };
}

export function renderTowerDefenseGame(): void {
  if (run?.rafId != null) cancelAnimationFrame(run.rafId);
  window.removeEventListener('resize', resizeCanvas);
  preloadSprites();
  run = makeRunState();
  const main = document.getElementById('main')!;
  hud.renderShell(main);

  const canvas = document.getElementById('tdCanvas') as HTMLCanvasElement;
  run.canvas = canvas;
  run.ctx = canvas.getContext('2d');
  run.bgCanvas = document.createElement('canvas');
  run.bgCtx = run.bgCanvas.getContext('2d');
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  canvas.addEventListener('pointerdown', handleCanvasPointerDown);

  hud.updateGold(run.gold);
  hud.updateLives(run.lives);
  hud.updateWaveLabel(`BØLGE 1/${run.storySequence.length}`);
  hud.setStartWaveButton(true, 'START BØLGE');
  document.getElementById('tdStartWaveBtn')!.addEventListener('click', () => {
    if (!run || run.waveActive) return;
    Sound.click();
    beginWave();
  });

  wireGameChrome('towerdefense', renderTowerDefenseGame);
  run.lastTime = performance.now();
  run.phase = 'playing';
  run.rafId = requestAnimationFrame(loop);
}

function resizeCanvas(): void {
  if (!run?.canvas) return;
  const rect = run.canvas.parentElement!.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  run.canvas.width = Math.round(rect.width * dpr);
  run.canvas.height = Math.round(rect.height * dpr);
  run.arenaW = rect.width;
  run.arenaH = rect.height;
  run.pathLenPx = pathLengthPx(run.arenaW, run.arenaH);
  run.ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);

  // Static map layer (ground texture, road, scenery, spawn cave, gate keep) is expensive to
  // redraw at 60fps and never changes between resizes — render it once here into an offscreen
  // canvas at 1:1 CSS-pixel resolution, then render() just blits it every frame.
  if (run.bgCanvas && run.bgCtx) {
    run.bgCanvas.width = Math.round(run.arenaW);
    run.bgCanvas.height = Math.round(run.arenaH);
    renderTerrain(run.bgCtx, run.arenaW, run.arenaH);
  }
}

// ---- Wave lifecycle ----------------------------------------------------

function beginWave(): void {
  if (!run) return;
  const template = getWaveTemplate(run.waveNumber, run.storySequence);
  run.currentWave = template;
  run.currentScale = scaleForWave(run.waveNumber);
  run.bossMaxHpSeen = 0;

  const isBossWave = template.groups.some((g) => g.defId === 'troll');
  hud.showBossBar(isBossWave);
  if (isBossWave) {
    hud.updateBossName(template.groups.filter((g) => g.defId === 'troll').length > 1 ? 'TROLD-HORDE' : 'TROLD');
    EmberWardSound.bossWarning();
  }

  const tickets: SpawnTicket[] = [];
  for (const group of template.groups) {
    for (let i = 0; i < group.count; i++) tickets.push({ defId: group.defId, delay: i * template.spawnIntervalMs });
  }
  for (let i = tickets.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tickets[i].defId, tickets[j].defId] = [tickets[j].defId, tickets[i].defId];
  }
  run.spawnQueue = tickets.map((t, i) => ({ defId: t.defId, delay: i * template.spawnIntervalMs }));
  run.waveActive = true;
  run.autoStartRemaining = 0;
  hud.updateWaveLabel(`BØLGE ${run.waveNumber}/${run.storySequence.length}${run.waveNumber > run.storySequence.length ? ' · ENDELØS' : ''} · ${template.label.toUpperCase()}`);
  hud.setStartWaveButton(false, 'BØLGE I GANG');
  hud.updateAutoStartLabel('');
  EmberWardSound.waveStart();
}

function completeWave(): void {
  if (!run) return;
  const bonus = BALANCE.economy.waveClearBaseBonus + (run.currentWave?.bonusGold ?? 0);
  run.gold += bonus;
  run.wavesCleared++;
  run.waveActive = false;
  hud.updateGold(run.gold);
  hud.showBossBar(false);
  EmberWardSound.waveClear();
  Haptics.hit();

  run.waveNumber++;
  hud.setStartWaveButton(true, 'START NÆSTE BØLGE');
  run.autoStartRemaining = BALANCE.waves.autoStartDelayS;
  hud.updateWaveLabel(`BØLGE ${run.waveNumber - 1} KLARET — 💰+${bonus}`);
}

function loseLife(cost: number): void {
  if (!run) return;
  run.lives -= cost;
  hud.updateLives(run.lives);
  EmberWardSound.leak();
  Haptics.miss();
  if (run.lives <= 0) {
    run.lives = 0;
    hud.updateLives(0);
    endRun();
  }
}

function endRun(): void {
  if (!run) return;
  run.phase = 'gameover';
  run.enemies = [];
  run.spawnQueue = [];
  run.waveActive = false;
  Sound.mistake();
  void finishSession();
}

async function finishSession(): Promise<void> {
  if (!run) return;
  const score = run.wavesCleared;
  const { isNewBest, xpGain, rank } = await finishGameSession('towerdefense', score);
  Sound.complete();
  if (isNewBest) {
    setTimeout(() => Sound.pb(), 250);
    Haptics.personalBest();
  }
  drawFinalScreen(score, isNewBest, xpGain, rank);
}

function drawFinalScreen(score: number, isNewBest: boolean, xpGain: number, rank: number | null): void {
  const main = document.getElementById('main')!;
  const rating = ScoreKinds.towerdefense_waves.rating(score);
  main.innerHTML = `
    <div class="page">
      <div class="game-shell">
        <div class="final-wrap">
          <div class="final-label">Bølger overlevet</div>
          <div class="final-score">${score}<span style="font-size:26px">bølger</span></div>
          <div class="final-rating" style="color:${rating.color}">${rating.label}</div>
          ${isNewBest ? '<div class="pb-flag">★ NY PERSONLIG REKORD</div>' : ''}
          <div class="xp-toast">✦ +${xpGain} XP optjent${rank && rank <= 3 ? ' · TOP 3-BONUS' : ''}</div>

          <div class="final-stats">
            <div class="fstat"><div class="n">${score}</div><div class="l">Bølger</div></div>
            <div class="fstat"><div class="n">${run?.totalKills ?? 0}</div><div class="l">Nedkæmpet</div></div>
            <div class="fstat"><div class="n">${run?.towers.length ?? 0}</div><div class="l">Tårne</div></div>
            <div class="fstat"><div class="n">+${xpGain}</div><div class="l">XP optjent</div></div>
          </div>

          <div class="final-ctas">
            <button class="btn btn-primary btn-lg" id="playAgainBtn">SPIL IGEN</button>
            <button class="btn btn-ghost btn-lg" data-nav="leaderboard-towerdefense">LEADERBOARD</button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.getElementById('playAgainBtn')!.addEventListener('click', () => {
    Sound.click();
    renderTowerDefenseGame();
  });
}

// ---- Update loop ---------------------------------------------------------

function loop(now: number): void {
  if (!run || !run.canvas || !document.body.contains(run.canvas)) {
    cleanup();
    return;
  }
  const dt = Math.min(0.05, (now - run.lastTime) / 1000);
  run.lastTime = now;
  if (run.phase === 'playing') update(dt);
  render();
  run.rafId = requestAnimationFrame(loop);
}

function cleanup(): void {
  if (run?.rafId != null) cancelAnimationFrame(run.rafId);
  window.removeEventListener('resize', resizeCanvas);
  run = null;
}

/** Shaman aura: nearby goblins get a speed multiplier while a shaman is alive. Recomputed every
 * frame from current positions (see enemies.ts) — a one-frame lag against the shaman's own latest
 * move is an acceptable approximation, not worth extra bookkeeping to eliminate. */
function computeAuraBoosts(enemies: EnemyInstance[]): Map<number, number> {
  const boosts = new Map<number, number>();
  const shamans = enemies.filter((e) => e.defId === 'goblin_shaman');
  if (shamans.length === 0) return boosts;
  const def = ENEMY_DEFS.goblin_shaman;
  for (const s of shamans) {
    for (const e of enemies) {
      if (e.defId !== 'goblin') continue;
      const dist = Math.hypot(e.pos.x - s.pos.x, e.pos.y - s.pos.y);
      if (dist <= (def.auraRadius ?? 0)) {
        boosts.set(e.id, Math.max(boosts.get(e.id) ?? 1, 1 + (def.auraSpeedBoostPct ?? 0)));
      }
    }
  }
  return boosts;
}

/** Obelisk support aura: sums auraDamageBonusPct from every obelisk within range of the attacking
 * tower's own position — additive stacking (two obelisks in range add together), applied as a flat
 * multiplier on that tower's damage for this shot. */
function obeliskDamageMult(towerPos: { x: number; y: number }, towers: TowerInstance[]): number {
  let bonus = 0;
  for (const t of towers) {
    if (t.defId !== 'obelisk') continue;
    const stats = TOWER_DEFS.obelisk.tiers[t.tier - 1];
    const dist = Math.hypot(towerPos.x - t.pos.x, towerPos.y - t.pos.y);
    if (dist <= (stats.auraRadius ?? 0)) bonus += stats.auraDamageBonusPct ?? 0;
  }
  return 1 + bonus;
}

function resolveHitOnEnemy(target: EnemyInstance, damage: number, ownerTowerId: number): void {
  if (!run) return;
  const hadShield = target.shieldHp > 0;
  const result = applyEnemyDamage(target, damage);
  const owner = run.towers.find((t) => t.id === ownerTowerId);
  if (owner) owner.totalDamageDealt += result.hpDamageDealt;

  if (hadShield && target.shieldHp <= 0 && result.hpDamageDealt > 0) {
    EmberWardSound.shieldBreak();
  } else if (!result.died) {
    EmberWardSound.impact();
  }
  if (result.hpDamageDealt > 0) run.vfx.damageNumber(target.pos, result.hpDamageDealt, false);
  run.vfx.impactSpark(target.pos, ENEMY_DEFS[target.defId].color);

  if (result.died) {
    if (owner) owner.kills++;
    run.totalKills++;
    run.gold += Math.round(ENEMY_DEFS[target.defId].goldReward * target.goldMult);
    hud.updateGold(run.gold);
    run.vfx.deathBurst(target.pos, ENEMY_DEFS[target.defId].color);
    EmberWardSound.enemyDeath();
    run.enemies = run.enemies.filter((e) => e.id !== target.id);
  }
}

function fireTower(tower: TowerInstance, target: EnemyInstance): void {
  if (!run) return;
  const def = TOWER_DEFS[tower.defId];
  const stats = def.tiers[tower.tier - 1];
  if (def.id === 'obelisk') return; // pure support, never fires

  const dmgMult = obeliskDamageMult(tower.pos, run.towers);
  const damage = stats.damage * dmgMult;
  const angle = Math.atan2(target.pos.y - tower.pos.y, target.pos.x - tower.pos.x);
  run.vfx.muzzleFlash(tower.pos, angle);

  if (def.id === 'lightning') {
    const chain = resolveChainTargets(target, run.enemies, stats.chainCount ?? 1, 100);
    let from = tower.pos;
    chain.forEach((enemy, i) => {
      const dmg = damage * Math.pow(stats.chainFalloff ?? 1, i);
      run!.zaps.push({ x1: from.x, y1: from.y, x2: enemy.pos.x, y2: enemy.pos.y, life: 0.15, maxLife: 0.15 });
      resolveHitOnEnemy(enemy, dmg, tower.id);
      from = enemy.pos;
    });
    EmberWardSound.lightningFire();
    return;
  }

  const kind = def.id === 'frosttower' ? 'frost' : def.id === 'catapult' ? 'catapult' : 'fire';
  run.projectiles.push(
    spawnProjectile(tower.pos, target, stats.projectileSpeed, damage, kind, def.color, stats.projectileRadius, tower.id, stats.splashRadius ?? 0, stats.slowPct ?? 0, stats.slowDurationS ?? 0),
  );
  if (kind === 'frost') EmberWardSound.frostFire();
  else if (kind === 'catapult') EmberWardSound.catapultFire();
  else EmberWardSound.towerFire();
}

function onProjectileHit(p: TdProjectile, target: EnemyInstance): void {
  if (!run) return;
  resolveHitOnEnemy(target, p.damage, p.ownerTowerId);
  if (p.kind === 'frost' && run.enemies.some((e) => e.id === target.id)) {
    applySlow(target, p.slowPct, p.slowDurationS);
  }
  if (p.kind === 'catapult' && p.splashRadius > 0) {
    const splashCenter = { x: p.x, y: p.y };
    for (const other of [...run.enemies]) {
      if (other.id === target.id) continue;
      const dist = Math.hypot(other.pos.x - splashCenter.x, other.pos.y - splashCenter.y);
      if (dist <= p.splashRadius) resolveHitOnEnemy(other, p.damage, p.ownerTowerId);
    }
  }
}

function update(dt: number): void {
  if (!run) return;
  const r = run;

  // spawning
  for (let i = r.spawnQueue.length - 1; i >= 0; i--) {
    r.spawnQueue[i].delay -= dt * 1000;
    if (r.spawnQueue[i].delay <= 0) {
      const enemy = spawnEnemy(r.spawnQueue[i].defId, r.currentScale.hpMult, r.currentScale.speedMult, r.currentScale.goldMult);
      const start = pointAtPathDistance(0, r.arenaW, r.arenaH);
      enemy.pos = start.pos;
      enemy.facing = start.angle;
      r.enemies.push(enemy);
      r.spawnQueue.splice(i, 1);
    }
  }

  // enemy movement
  const auraBoosts = computeAuraBoosts(r.enemies);
  for (let i = r.enemies.length - 1; i >= 0; i--) {
    const e = r.enemies[i];
    const move = updateEnemyMovement(e, dt, r.arenaW, r.arenaH, r.pathLenPx, auraBoosts.get(e.id) ?? 1);
    if (move.reachedGate) {
      r.enemies.splice(i, 1);
      loseLife(ENEMY_DEFS[e.defId].livesCost);
      if (run == null || run.phase !== 'playing') return; // game over mid-loop
    }
  }

  // boss bar
  const trolls = r.enemies.filter((e) => e.defId === 'troll');
  if (trolls.length > 0) {
    const hpNow = trolls.reduce((s, t) => s + t.hp, 0);
    const maxNow = trolls.reduce((s, t) => s + t.maxHp, 0);
    r.bossMaxHpSeen = Math.max(r.bossMaxHpSeen, maxNow);
    hud.updateBossBar(hpNow, r.bossMaxHpSeen || 1);
  }

  // towers
  for (const t of r.towers) {
    if (t.placeFlash > 0) t.placeFlash -= dt;
    if (t.defId === 'obelisk') continue;
    if (t.cooldownRemaining > 0) {
      t.cooldownRemaining -= dt;
      continue;
    }
    const stats = TOWER_DEFS[t.defId].tiers[t.tier - 1];
    let best: EnemyInstance | null = null;
    let bestProgress = -Infinity;
    for (const e of r.enemies) {
      const dist = Math.hypot(e.pos.x - t.pos.x, e.pos.y - t.pos.y);
      if (dist > stats.range) continue;
      if (e.pathDist > bestProgress) {
        bestProgress = e.pathDist;
        best = e;
      }
    }
    if (best) {
      fireTower(t, best);
      t.cooldownRemaining = 1 / stats.fireRate;
    }
  }

  updateProjectiles(r.projectiles, r.enemies, dt, onProjectileHit);

  for (let i = r.zaps.length - 1; i >= 0; i--) {
    r.zaps[i].life -= dt;
    if (r.zaps[i].life <= 0) r.zaps.splice(i, 1);
  }

  r.vfx.update(dt);

  // wave completion / auto-start
  if (r.waveActive && r.spawnQueue.length === 0 && r.enemies.length === 0) {
    completeWave();
  } else if (!r.waveActive && r.autoStartRemaining > 0 && r.phase === 'playing') {
    r.autoStartRemaining -= dt;
    hud.updateAutoStartLabel(`Auto-start om ${Math.ceil(r.autoStartRemaining)}s`);
    if (r.autoStartRemaining <= 0) beginWave();
  }
}

// ---- Input ---------------------------------------------------------------

function handleCanvasPointerDown(e: PointerEvent): void {
  if (!run || !e.isPrimary || !run.canvas) return;
  const rect = run.canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const hitTower = run.towers.find((t) => Math.hypot(t.pos.x - x, t.pos.y - y) <= 22);
  if (hitTower) {
    openTowerInfo(hitTower);
    return;
  }

  tryPlaceAt({ x, y });
}

/**
 * Free placement (no pre-baked build slots — a fixed grid of spots was flagged as taking choice
 * out of the game): any point clears three checks — inside the arena with a margin, far enough
 * from the road (see pathClearancePx), and far enough from every other tower — opens the picker
 * right there. An invalid tap gets a toast + a miss cue instead of silently doing nothing, so it
 * reads as "no, not there" rather than "nothing happened."
 */
function tryPlaceAt(pos: Vec2): void {
  if (!run) return;
  if (pos.x < PLACEMENT_EDGE_MARGIN_PX || pos.x > run.arenaW - PLACEMENT_EDGE_MARGIN_PX || pos.y < PLACEMENT_EDGE_MARGIN_PX || pos.y > run.arenaH - PLACEMENT_EDGE_MARGIN_PX) {
    Sound.mistake();
    toast('For tæt på kanten af banen');
    return;
  }
  if (distanceToPathPx(pos, run.arenaW, run.arenaH) < pathClearancePx(run.arenaW)) {
    Sound.mistake();
    toast('For tæt på stien — fjendene skal kunne gå frit');
    return;
  }
  if (run.towers.some((t) => Math.hypot(t.pos.x - pos.x, t.pos.y - pos.y) < MIN_TOWER_SPACING_PX)) {
    Sound.mistake();
    toast('For tæt på et andet tårn');
    return;
  }
  openTowerPicker(pos);
}

function openTowerPicker(pos: Vec2): void {
  if (!run) return;
  Sound.click();
  hud.showTowerPickerModal(listTowers(), run.gold, (towerId: TowerId) => {
    if (!run) return;
    const def = TOWER_DEFS[towerId];
    const cost = def.tiers[0].cost;
    if (run.gold < cost) return;
    run.gold -= cost;
    hud.updateGold(run.gold);
    run.towers.push({
      id: run.nextTowerId++,
      defId: towerId,
      pos: { ...pos },
      tier: 1,
      cooldownRemaining: 0,
      totalDamageDealt: 0,
      kills: 0,
      placeFlash: BALANCE.juice.placeFlashS,
    });
    EmberWardSound.towerPlace();
    Haptics.hit();
  });
}

function openTowerInfo(tower: TowerInstance): void {
  if (!run) return;
  Sound.click();
  const def = TOWER_DEFS[tower.defId];
  const spent = def.tiers.slice(0, tower.tier).reduce((sum, t) => sum + t.cost, 0);
  const sellValue = Math.round(spent * 0.6);
  hud.showTowerInfoModal(
    def,
    tower,
    run.gold,
    sellValue,
    () => {
      if (!run) return;
      const nextStats = def.tiers[tower.tier];
      if (!nextStats || run.gold < nextStats.cost) return;
      run.gold -= nextStats.cost;
      tower.tier = nextStats.tier;
      tower.placeFlash = BALANCE.juice.placeFlashS;
      hud.updateGold(run.gold);
      EmberWardSound.towerUpgrade();
      Haptics.personalBest();
    },
    () => {
      if (!run) return;
      run.gold += sellValue;
      run.towers = run.towers.filter((t) => t.id !== tower.id);
      hud.updateGold(run.gold);
      Sound.click();
    },
  );
}

// ---- Render ---------------------------------------------------------------

function drawEnemySprite(ctx: CanvasRenderingContext2D, e: EnemyInstance): void {
  const def = ENEMY_DEFS[e.defId];
  const img = getEnemySprite(e.defId);
  const size = def.radius * 2.7;

  if (def.isBoss) {
    ctx.strokeStyle = 'rgba(255,210,63,.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(e.pos.x, e.pos.y, size / 2 + 3, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (isSpriteReady(img)) {
    ctx.save();
    ctx.drawImage(img, e.pos.x - size / 2, e.pos.y - size / 2, size, size);
    if (e.hitFlash > 0 || e.slowFactor < 1) {
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = e.hitFlash > 0 ? 'rgba(255,255,255,.55)' : 'rgba(140,220,255,.35)';
      ctx.fillRect(e.pos.x - size / 2, e.pos.y - size / 2, size, size);
    }
    ctx.restore();
  } else {
    ctx.fillStyle = def.color;
    ctx.beginPath();
    ctx.arc(e.pos.x, e.pos.y, def.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  // hp bar
  const barW = def.radius * 2.2;
  const barY = e.pos.y - size / 2 - 8;
  ctx.fillStyle = 'rgba(0,0,0,.5)';
  ctx.fillRect(e.pos.x - barW / 2, barY, barW, 4);
  ctx.fillStyle = '#c9f73e';
  ctx.fillRect(e.pos.x - barW / 2, barY, barW * Math.max(0, e.hp / e.maxHp), 4);
  if (def.shieldHp) {
    ctx.fillStyle = 'rgba(0,0,0,.5)';
    ctx.fillRect(e.pos.x - barW / 2, barY - 5, barW, 3);
    ctx.fillStyle = '#8ea6c9';
    ctx.fillRect(e.pos.x - barW / 2, barY - 5, barW * Math.max(0, e.shieldHp / def.shieldHp), 3);
  }
}

function drawTowerSprite(ctx: CanvasRenderingContext2D, t: TowerInstance): void {
  const def = TOWER_DEFS[t.defId];
  const img = getTowerSprite(t.defId);
  const pulse = t.placeFlash > 0 ? 1 + (t.placeFlash / BALANCE.juice.placeFlashS) * 0.25 : 1;
  const size = 48 * pulse;

  if (def.id === 'obelisk') {
    const stats = def.tiers[t.tier - 1];
    ctx.strokeStyle = 'rgba(255,210,63,.22)';
    ctx.setLineDash([4, 5]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(t.pos.x, t.pos.y, stats.auraRadius ?? 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Bottom-anchored: the sprite's own ground shadow sits near the bottom of its 100x100 frame, so
  // drawing with its bottom edge at t.pos (not centered) makes the tower look planted on the spot
  // the player tapped, not floating around it.
  if (isSpriteReady(img)) {
    ctx.drawImage(img, t.pos.x - size / 2, t.pos.y - size, size, size);
  } else {
    ctx.fillStyle = def.color;
    ctx.beginPath();
    ctx.arc(t.pos.x, t.pos.y - size * 0.3, 16, 0, Math.PI * 2);
    ctx.fill();
  }

  if (t.tier > 1) {
    const bx = t.pos.x + size * 0.28;
    const by = t.pos.y - size * 0.92;
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.arc(bx, by, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1a1024';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.font = 'bold 10px "JetBrains Mono", monospace';
    ctx.fillStyle = '#1a1024';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${t.tier}`, bx, by + 1);
    ctx.textBaseline = 'alphabetic';
  }
}

function render(): void {
  if (!run?.ctx || !run.canvas) return;
  const ctx = run.ctx;
  const r = run;
  ctx.clearRect(0, 0, r.arenaW, r.arenaH);

  if (r.bgCanvas) ctx.drawImage(r.bgCanvas, 0, 0);

  for (const t of r.towers) drawTowerSprite(ctx, t);
  for (const e of r.enemies) drawEnemySprite(ctx, e);

  // projectiles
  for (const p of r.projectiles) {
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  // lightning zaps
  for (const z of r.zaps) {
    const alpha = z.life / z.maxLife;
    ctx.strokeStyle = `rgba(201,166,255,${alpha})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(z.x1, z.y1);
    ctx.lineTo(z.x2, z.y2);
    ctx.stroke();
  }

  r.vfx.render(ctx, r.arenaW, r.arenaH);
}
