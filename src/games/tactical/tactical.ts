import { finishGameSession } from '../../state';
import { ScoreKinds } from '../../scoring';
import { Haptics } from '../../haptics';
import { Sound } from '../../sound';
import { TacticalSound } from './audio';
import { Player } from './player';
import { InputController } from './input';
import { ProjectilePool } from './projectiles';
import { VfxSystem } from './vfx';
import { selectTarget, type TargetCandidate } from './targeting';
import { WEAPONS, STARTING_WEAPON_ID } from './weapons';
import { ENEMY_DEFS } from './enemies';
import { spawnEnemy, updateEnemy, type EnemyInstance } from './enemyRuntime';
import { spawnBoss, updateBoss, BOSS_MAX_HP, type BossInstance } from './boss';
import { ENCOUNTERS, TOTAL_ROOMS } from './encounters';
import { pickUpgradeChoices } from './upgrades';
import { makeDefaultBuild, vAngle, vSub, vDist, type BuildStats, type EnemyId } from './types';
import * as hud from './hud';

type RunPhase = 'intro' | 'playing' | 'levelup' | 'roomclear' | 'gameover';

interface SpawnTicket {
  defId: EnemyId;
  delay: number;
}

interface RunState {
  phase: RunPhase;
  player: Player;
  build: BuildStats;
  upgradesTaken: Record<string, number>;
  xp: number;
  level: number;
  xpForNext: number;
  enemies: EnemyInstance[];
  boss: BossInstance | null;
  roomIndex: number;
  roomsCleared: number;
  enemiesKilled: number;
  spawnQueue: SpawnTicket[];
  roomTransitionTimer: number;
  arenaW: number;
  arenaH: number;
  input: InputController;
  projectiles: ProjectilePool;
  vfx: VfxSystem;
  canvas: HTMLCanvasElement | null;
  ctx: CanvasRenderingContext2D | null;
  rafId: number | null;
  lastTime: number;
}

let run: RunState | null = null;

function xpForLevel(level: number): number {
  return 18 + (level - 1) * 13;
}

function makeRunState(): RunState {
  return {
    phase: 'intro',
    player: new Player(),
    build: makeDefaultBuild(),
    upgradesTaken: {},
    xp: 0,
    level: 1,
    xpForNext: xpForLevel(1),
    enemies: [],
    boss: null,
    roomIndex: 0,
    roomsCleared: 0,
    enemiesKilled: 0,
    spawnQueue: [],
    roomTransitionTimer: 0,
    arenaW: 760,
    arenaH: 570,
    input: new InputController(),
    projectiles: new ProjectilePool(),
    vfx: new VfxSystem(),
    canvas: null,
    ctx: null,
    rafId: null,
    lastTime: 0,
  };
}

export function renderTacticalGame(): void {
  if (run?.rafId != null) cancelAnimationFrame(run.rafId);
  run?.input.destroy();
  run = makeRunState();
  const main = document.getElementById('main')!;
  hud.renderShell(main);

  const canvas = document.getElementById('tacticalCanvas') as HTMLCanvasElement;
  const wrap = document.getElementById('tacCanvasWrap')!;
  run.canvas = canvas;
  run.ctx = canvas.getContext('2d');
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  run.input.attachKeyboard();
  const joyBase = document.getElementById('tacJoystick')!;
  const joyKnob = document.getElementById('tacJoystickKnob')!;
  run.input.attachJoystick(joyBase, joyKnob);
  hud.showJoystickIfTouch();

  showIntroOverlay(wrap);
  hud.updateXpBar(1, 0, xpForLevel(1));
  hud.updateRoomLabel(`RUM 1/${TOTAL_ROOMS}`);
}

function resizeCanvas(): void {
  if (!run?.canvas) return;
  const rect = run.canvas.parentElement!.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  run.canvas.width = Math.round(rect.width * dpr);
  run.canvas.height = Math.round(rect.height * dpr);
  run.arenaW = rect.width;
  run.arenaH = rect.height;
  run.ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function showIntroOverlay(wrap: HTMLElement): void {
  const overlay = document.createElement('div');
  overlay.className = 'arena-inner';
  overlay.id = 'tacIntroOverlay';
  overlay.style.cssText = 'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:rgba(8,7,12,.82);z-index:5;padding:24px;';
  overlay.innerHTML = `
    <div class="arena-title">Klar til indsats?</div>
    <ul class="tactical-intro-list">
      <li>Bevæg dig med WASD/piletaster eller joysticket</li>
      <li>Stop for automatisk at sigte og skyde mod nærmeste fjende</li>
      <li>Ryd rum, level op, byg dit build — overlev bossen</li>
    </ul>
    <button class="btn btn-primary btn-lg" id="tacStartBtn">START MISSION</button>
  `;
  wrap.appendChild(overlay);
  document.getElementById('tacStartBtn')!.addEventListener('click', (e) => {
    e.stopPropagation();
    overlay.remove();
    startRun();
  });
}

function startRun(): void {
  if (!run) return;
  run.player.reset({ x: run.arenaW / 2, y: run.arenaH / 2 }, run.build);
  run.phase = 'playing';
  startRoom(0);
  run.lastTime = performance.now();
  run.rafId = requestAnimationFrame(loop);
}

function startRoom(index: number): void {
  if (!run) return;
  run.roomIndex = index;
  run.enemies = [];
  run.boss = null;
  hud.showBossBar(false);

  if (index >= ENCOUNTERS.length) {
    hud.updateRoomLabel(`RUM ${TOTAL_ROOMS}/${TOTAL_ROOMS} · BOSS`);
    run.boss = spawnBoss({ x: run.arenaW / 2, y: run.arenaH * 0.28 });
    hud.showBossBar(true);
    hud.updateBossBar(run.boss.hp, BOSS_MAX_HP);
    run.spawnQueue = [];
    return;
  }

  const wave = ENCOUNTERS[index];
  hud.updateRoomLabel(`RUM ${index + 1}/${TOTAL_ROOMS} · ${wave.label.toUpperCase()}`);
  const tickets: SpawnTicket[] = [];
  for (const group of wave.enemies) {
    for (let i = 0; i < group.count; i++) tickets.push({ defId: group.defId, delay: i * wave.spawnIntervalMs });
  }
  // stagger delays across a shuffled order so composition doesn't spawn in predictable blocks
  for (let i = tickets.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tickets[i].defId, tickets[j].defId] = [tickets[j].defId, tickets[i].defId];
  }
  run.spawnQueue = tickets.map((t, i) => ({ defId: t.defId, delay: i * wave.spawnIntervalMs }));
}

function spawnAtEdge(defId: EnemyId): void {
  if (!run) return;
  const edge = Math.floor(Math.random() * 4);
  const pad = 30;
  let x = run.arenaW / 2;
  let y = run.arenaH / 2;
  if (edge === 0) { x = pad; y = Math.random() * run.arenaH; }
  else if (edge === 1) { x = run.arenaW - pad; y = Math.random() * run.arenaH; }
  else if (edge === 2) { x = Math.random() * run.arenaW; y = pad; }
  else { x = Math.random() * run.arenaW; y = run.arenaH - pad; }
  run.enemies.push(spawnEnemy(defId, { x, y }));
}

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

function update(dt: number): void {
  if (!run) return;
  const r = run;

  // spawning
  for (let i = r.spawnQueue.length - 1; i >= 0; i--) {
    r.spawnQueue[i].delay -= dt * 1000;
    if (r.spawnQueue[i].delay <= 0) {
      spawnAtEdge(r.spawnQueue[i].defId);
      r.spawnQueue.splice(i, 1);
    }
  }

  const moveVec = r.input.getMoveVector();
  const isMoving = r.input.isMoving();
  r.player.update(dt, moveVec, r.build);
  r.player.clampToArena(r.arenaW, r.arenaH);
  if (isMoving) r.player.facing = vAngle({ x: moveVec.x, y: moveVec.y }) || r.player.facing;

  if (!isMoving && r.player.canFire()) tryFire();

  r.projectiles.update(dt);
  handleProjectileCollisions();

  for (const e of r.enemies) {
    const result = updateEnemy(e, r.player.pos, dt, r.arenaW, r.arenaH);
    if (result.meleeAttack) {
      const dmg = r.player.takeDamage(result.meleeAttack.damage, r.build);
      if (dmg > 0) onPlayerHit(dmg);
    }
    if (result.rangedAttack) fireEnemyProjectile(result.rangedAttack.from, result.rangedAttack.angleRad, result.rangedAttack.damage);
  }

  if (r.boss) {
    const bossResult = updateBoss(r.boss, r.player.pos, dt, r.arenaW, r.arenaH);
    if (bossResult.fireShot) fireBossProjectile(r.boss, bossResult.fireShot.angleRad, bossResult.fireShot.damage);
    if (bossResult.slamNowResolving) {
      const { center, radius, damage } = bossResult.slamNowResolving;
      if (vDist(r.player.pos, center) <= radius) {
        const dmg = r.player.takeDamage(damage, r.build);
        if (dmg > 0) onPlayerHit(dmg);
      }
      r.vfx.deathBurst(center, '#ff5d7a');
      r.vfx.shake(14);
    }
    hud.updateBossBar(r.boss.hp, BOSS_MAX_HP);
    if (r.boss.hp <= 0) {
      r.vfx.deathBurst(r.boss.pos, '#ff5d7a');
      r.vfx.shake(16);
      TacticalSound.waveClear();
      r.roomsCleared = TOTAL_ROOMS;
      endRun(true);
      return;
    }
  }

  r.vfx.update(dt);
  hud.updateHpBar(r.player.hp, r.player.maxHp);

  if (r.player.isDead()) {
    endRun(false);
    return;
  }

  const roomHasBoss = r.roomIndex >= ENCOUNTERS.length;
  if (!roomHasBoss && r.spawnQueue.length === 0 && r.enemies.length === 0 && r.phase === 'playing') {
    r.roomsCleared = r.roomIndex + 1;
    TacticalSound.waveClear();
    const nextIndex = r.roomIndex + 1;
    setTimeout(() => {
      if (!run || run.phase !== 'playing') return;
      startRoom(nextIndex);
    }, 500);
    r.phase = 'playing'; // stays playing; brief gap has no enemies which is fine
  }
}

function onPlayerHit(dmg: number): void {
  if (!run) return;
  run.vfx.shake(6);
  run.vfx.impactSpark(run.player.pos, '#ff5d7a');
  TacticalSound.playerHurt();
  Haptics.miss();
  void dmg;
}

function computeWeaponRange(): number {
  if (!run) return 0;
  return WEAPONS[STARTING_WEAPON_ID].range * run.build.rangeMult;
}

function tryFire(): void {
  if (!run) return;
  const r = run;
  const weapon = WEAPONS[STARTING_WEAPON_ID];
  const candidates: TargetCandidate[] = r.enemies.map((e) => ({ id: e.id, pos: e.pos, isElite: ENEMY_DEFS[e.defId].isElite }));
  if (r.boss) candidates.push({ id: -1, pos: r.boss.pos, isElite: true });
  const target = selectTarget(r.player.pos, candidates, computeWeaponRange());
  if (!target) return;

  const angle = vAngle(vSub(target.pos, r.player.pos));
  r.player.facing = angle;
  const count = weapon.projectileCount + r.build.projectileCountBonus;
  const spreadRad = (weapon.spreadDeg * Math.PI) / 180;
  for (let i = 0; i < count; i++) {
    const offset = count === 1 ? 0 : (i / (count - 1) - 0.5) * spreadRad * 2 + (Math.random() - 0.5) * spreadRad * 0.3;
    const a = angle + offset;
    const crit = Math.random() < r.build.critChance;
    const dmg = weapon.damage * r.build.damageMult * (crit ? r.build.critMultiplier : 1);
    r.projectiles.spawn({
      x: r.player.pos.x,
      y: r.player.pos.y,
      vx: Math.cos(a) * weapon.projectileSpeed * r.build.projectileSpeedMult,
      vy: Math.sin(a) * weapon.projectileSpeed * r.build.projectileSpeedMult,
      damage: dmg,
      crit,
      penetration: weapon.penetration + r.build.penetrationBonus,
      ricochetChance: r.build.ricochetChance,
      maxRange: computeWeaponRange(),
      fromPlayer: true,
      radius: 4,
      color: crit ? '#ffcf4d' : '#c9f73e',
    });
  }
  r.vfx.muzzleFlash(r.player.pos, angle);
  TacticalSound.shot();
  r.player.fireCooldownRemaining = r.player.fireCooldownFor(weapon, r.build);
}

function fireEnemyProjectile(e: EnemyInstance, angleRad: number, damage: number): void {
  if (!run) return;
  const def = ENEMY_DEFS[e.defId];
  const pelletCount = def.id === 'shotgunner' ? 5 : 1;
  const spread = def.id === 'shotgunner' ? 0.55 : 0.04;
  for (let i = 0; i < pelletCount; i++) {
    const offset = pelletCount === 1 ? 0 : (i / (pelletCount - 1) - 0.5) * spread;
    const a = angleRad + offset;
    run.projectiles.spawn({
      x: e.pos.x,
      y: e.pos.y,
      vx: Math.cos(a) * 380,
      vy: Math.sin(a) * 380,
      damage: damage / (pelletCount > 1 ? 2 : 1),
      crit: false,
      penetration: 0,
      ricochetChance: 0,
      maxRange: 700,
      fromPlayer: false,
      radius: 4,
      color: '#ff5d7a',
    });
  }
  TacticalSound.shot();
}

function fireBossProjectile(b: BossInstance, angleRad: number, damage: number): void {
  if (!run) return;
  run.projectiles.spawn({
    x: b.pos.x,
    y: b.pos.y,
    vx: Math.cos(angleRad) * 420,
    vy: Math.sin(angleRad) * 420,
    damage,
    crit: false,
    penetration: 0,
    ricochetChance: 0,
    maxRange: 800,
    fromPlayer: false,
    radius: 5,
    color: '#8b6bff',
  });
  TacticalSound.shot();
}

function handleProjectileCollisions(): void {
  if (!run) return;
  const r = run;
  for (const p of r.projectiles.active()) {
    if (p.fromPlayer) {
      let hitSomething = false;
      for (const e of r.enemies) {
        if (p.hitIds.has(e.id)) continue;
        const def = ENEMY_DEFS[e.defId];
        if (vDist(p, e.pos) <= p.radius + def.radius) {
          applyDamageToEnemy(e, p.damage, p.crit);
          p.hitIds.add(e.id);
          hitSomething = true;
          if (p.penetration > 0) {
            p.penetration--;
          } else if (p.ricochetChance > 0 && Math.random() < p.ricochetChance && r.enemies.length > 1) {
            const other = r.enemies.find((o) => o.id !== e.id && !p.hitIds.has(o.id));
            if (other) {
              const a = vAngle(vSub(other.pos, p));
              p.vx = Math.cos(a) * Math.hypot(p.vx, p.vy);
              p.vy = Math.sin(a) * Math.hypot(p.vx, p.vy);
              p.ricochetChance = 0; // one ricochet jump per projectile
            } else {
              r.projectiles.deactivate(p);
            }
          } else {
            r.projectiles.deactivate(p);
          }
          break;
        }
      }
      if (!hitSomething && r.boss && !p.hitIds.has(-1)) {
        if (vDist(p, r.boss.pos) <= p.radius + r.boss.radius) {
          applyDamageToBoss(r.boss, p.damage, p.crit);
          p.hitIds.add(-1);
          if (p.penetration > 0) p.penetration--;
          else r.projectiles.deactivate(p);
        }
      }
    } else {
      if (vDist(p, r.player.pos) <= p.radius + r.player.radius) {
        const dmg = r.player.takeDamage(p.damage, r.build);
        if (dmg > 0) onPlayerHit(dmg);
        r.projectiles.deactivate(p);
      }
    }
  }
}

function applyDamageToEnemy(e: EnemyInstance, dmg: number, crit: boolean): void {
  if (!run) return;
  e.hp -= dmg;
  e.hitFlash = 0.08;
  run.vfx.impactSpark(e.pos, ENEMY_DEFS[e.defId].color);
  run.vfx.damageNumber(e.pos, dmg, crit);
  if (crit) TacticalSound.crit();
  else TacticalSound.hit();
  if (crit) Haptics.hit();
  if (run.build.lifestealPct > 0) run.player.heal(dmg * run.build.lifestealPct);

  if (e.hp <= 0) {
    run.vfx.deathBurst(e.pos, ENEMY_DEFS[e.defId].color);
    TacticalSound.enemyDeath();
    Haptics.hit();
    grantXp(ENEMY_DEFS[e.defId].xpReward);
    run.enemies = run.enemies.filter((x) => x.id !== e.id);
    run.enemiesKilled++;
    if (run.build.healOnKillChance > 0 && Math.random() < run.build.healOnKillChance) run.player.heal(8);
  }
}

function applyDamageToBoss(b: BossInstance, dmg: number, crit: boolean): void {
  if (!run) return;
  b.hp -= dmg;
  b.hitFlash = 0.08;
  run.vfx.impactSpark(b.pos, '#ff5d7a');
  run.vfx.damageNumber(b.pos, dmg, crit);
  if (crit) TacticalSound.crit();
  else TacticalSound.hit();
  if (run.build.lifestealPct > 0) run.player.heal(dmg * run.build.lifestealPct);
}

function grantXp(amount: number): void {
  if (!run) return;
  run.xp += amount;
  let leveled = false;
  while (run.xp >= run.xpForNext) {
    run.xp -= run.xpForNext;
    run.level++;
    run.xpForNext = xpForLevel(run.level);
    leveled = true;
  }
  hud.updateXpBar(run.level, run.xp, run.xpForNext);
  if (leveled) triggerLevelUp();
}

function triggerLevelUp(): void {
  if (!run) return;
  run.phase = 'levelup';
  TacticalSound.levelUp();
  const choices = pickUpgradeChoices(run.upgradesTaken, 3);
  hud.showLevelUpModal(choices, (chosen) => {
    if (!run) return;
    chosen.apply(run.build);
    run.upgradesTaken[chosen.id] = (run.upgradesTaken[chosen.id] ?? 0) + 1;
    run.player.applyBuildHpChange(run.build);
    TacticalSound.upgradePick();
    run.phase = 'playing';
  });
}

function render(): void {
  if (!run || !run.ctx) return;
  const { ctx, arenaW, arenaH } = run;
  ctx.save();
  const shake = run.vfx.getShakeOffset();
  ctx.translate(shake.x, shake.y);

  ctx.fillStyle = '#0a0b10';
  ctx.fillRect(-10, -10, arenaW + 20, arenaH + 20);
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1;
  const gridSize = 40;
  for (let x = 0; x < arenaW; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, arenaH);
    ctx.stroke();
  }
  for (let y = 0; y < arenaH; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(arenaW, y);
    ctx.stroke();
  }

  // boss slam telegraph
  if (run.boss && run.boss.phase === 'slamTelegraph') {
    const t = 1 - Math.max(0, run.boss.phaseTimer) / 1.1;
    ctx.beginPath();
    ctx.arc(run.boss.slamTarget.x, run.boss.slamTarget.y, 130 * Math.min(1, t + 0.15), 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,93,122,${0.4 + 0.4 * Math.sin(t * 20)})`;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,93,122,0.08)';
    ctx.fill();
  }

  // enemy sniper/ranged telegraph lines
  for (const e of run.enemies) {
    if (e.telegraphRemaining > 0 && !e.isMelee) {
      const def = ENEMY_DEFS[e.defId];
      ctx.save();
      ctx.strokeStyle = `rgba(255,93,122,${0.25 + 0.35 * (1 - e.telegraphRemaining / (def.telegraphMs! / 1000))})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(e.pos.x, e.pos.y);
      ctx.lineTo(e.pos.x + Math.cos(e.facing) * 600, e.pos.y + Math.sin(e.facing) * 600);
      ctx.stroke();
      ctx.restore();
    }
  }

  // enemies
  for (const e of run.enemies) {
    const def = ENEMY_DEFS[e.defId];
    ctx.save();
    ctx.translate(e.pos.x, e.pos.y);
    ctx.rotate(e.facing);
    ctx.fillStyle = e.hitFlash > 0 ? '#ffffff' : def.color;
    ctx.beginPath();
    ctx.arc(0, 0, def.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(def.radius - 3, -3, 10, 6);
    ctx.restore();
    // hp sliver for elites
    if (def.isElite) {
      const w = def.radius * 2;
      ctx.fillStyle = 'rgba(0,0,0,.4)';
      ctx.fillRect(e.pos.x - w / 2, e.pos.y - def.radius - 10, w, 4);
      ctx.fillStyle = '#8b6bff';
      ctx.fillRect(e.pos.x - w / 2, e.pos.y - def.radius - 10, w * Math.max(0, e.hp / e.maxHp), 4);
    }
  }

  // boss
  if (run.boss) {
    const b = run.boss;
    ctx.save();
    ctx.translate(b.pos.x, b.pos.y);
    ctx.rotate(b.facing);
    ctx.fillStyle = b.hitFlash > 0 ? '#ffffff' : '#3a2540';
    ctx.strokeStyle = '#ff5d7a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, b.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(b.radius - 5, -5, 16, 10);
    ctx.restore();
  }

  // player
  const p = run.player;
  ctx.save();
  ctx.translate(p.pos.x, p.pos.y);
  ctx.rotate(p.facing);
  ctx.fillStyle = p.invulnRemaining > 0.06 ? 'rgba(201,247,62,0.55)' : 'var(--lime)'.startsWith('var') ? '#c9f73e' : '#c9f73e';
  ctx.beginPath();
  ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#08070c';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#08070c';
  ctx.fillRect(p.radius - 4, -3, 12, 6);
  ctx.restore();

  // projectiles
  for (const pr of run.projectiles.active()) {
    ctx.fillStyle = pr.color;
    ctx.beginPath();
    ctx.arc(pr.x, pr.y, pr.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  run.vfx.render(ctx);
  ctx.restore();
}

function endRun(victory: boolean): void {
  if (!run) return;
  run.phase = 'gameover';
  const score = run.roomsCleared;
  TacticalSound.waveClear();
  Haptics.miss();
  void finishAndShowResults(score, victory);
}

async function finishAndShowResults(score: number, victory: boolean): Promise<void> {
  const { isNewBest, xpGain, rank } = await finishGameSession('tactical', score);
  Sound.complete();
  if (isNewBest) {
    setTimeout(() => Sound.pb(), 250);
    Haptics.personalBest();
  }
  showResultsScreen(score, victory, isNewBest, xpGain, rank);
}

function showResultsScreen(score: number, victory: boolean, isNewBest: boolean, xpGain: number, rank: number | null): void {
  if (run?.rafId != null) cancelAnimationFrame(run.rafId);
  run?.input.destroy();
  const rating = ScoreKinds.tactical_rooms.rating(score);
  const main = document.getElementById('main')!;
  main.innerHTML = `
    <div class="page">
      <div class="game-shell">
        <div class="final-wrap">
          <div class="final-label">${victory ? 'MISSION FULDFØRT' : 'MISSION MISLYKKEDES'}</div>
          <div class="final-score">${score}<span style="font-size:20px"> / ${TOTAL_ROOMS} rum</span></div>
          <div class="final-rating" style="color:${rating.color}">${rating.label}</div>
          ${isNewBest ? '<div class="pb-flag">★ NY PERSONLIG REKORD</div>' : ''}
          <div class="xp-toast">✦ +${xpGain} XP optjent${rank && rank <= 3 ? ' · TOP 3-BONUS' : ''}</div>

          <div class="final-stats">
            <div class="fstat"><div class="n">${score}</div><div class="l">Rum ryddet</div></div>
            <div class="fstat"><div class="n">${run ? run.enemiesKilled : 0}</div><div class="l">Fjender nedkæmpet</div></div>
            <div class="fstat"><div class="n">${rank ? '#' + rank : '—'}</div><div class="l">Placering</div></div>
            <div class="fstat"><div class="n">+${xpGain}</div><div class="l">XP optjent</div></div>
          </div>

          <div class="final-ctas">
            <button class="btn btn-primary btn-lg" id="tacRestartBtn">SPIL IGEN</button>
            <button class="btn btn-ghost btn-lg" data-nav="leaderboard">LEADERBOARD</button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.getElementById('tacRestartBtn')!.addEventListener('click', () => {
    Sound.click();
    renderTacticalGame();
  });
}

function cleanup(): void {
  if (run?.rafId != null) cancelAnimationFrame(run.rafId);
  run?.input.destroy();
  window.removeEventListener('resize', resizeCanvas);
  run = null;
}
