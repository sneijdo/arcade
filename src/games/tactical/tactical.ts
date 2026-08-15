import { finishGameSession } from '../../state';
import { ScoreKinds } from '../../scoring';
import { Haptics } from '../../haptics';
import { Sound } from '../../sound';
import { toast } from '../../toast';
import { TacticalSound } from './audio';
import {
  loadMeta,
  saveMeta,
  applyPerks,
  computeRunReward,
  isWeaponUnlocked,
  tryUnlockWeapon,
  tryUnlockPerk,
  WEAPON_COSTS,
  PERK_DEFS,
  STARTING_UNLOCKED_WEAPON,
  type TacticalMeta,
} from './meta';
import { Player } from './player';
import { InputController } from './input';
import { ProjectilePool } from './projectiles';
import { VfxSystem } from './vfx';
import { selectTarget, type TargetCandidate } from './targeting';
import { WEAPONS, STARTING_WEAPON_ID, listWeapons } from './weapons';
import { ENEMY_DEFS } from './enemies';
import { spawnEnemy, updateEnemy, type EnemyInstance } from './enemyRuntime';
import { spawnBoss, updateBoss, pickBossId, BOSS_NAMES, type BossInstance } from './boss';
import { buildRoomSequence, TOTAL_ROOMS, type EncounterWave } from './encounters';
import { pickUpgradeChoices } from './upgrades';
import { makeDefaultBuild, vAngle, vSub, vDist, vNorm, type BuildStats, type EnemyId, type WeaponId } from './types';
import { toPixelRects, resolveCircleVsObstacles, hasLineOfSight, type ObstacleRect } from './obstacles';
import { BALANCE } from './balance';
import * as hud from './hud';

type RunPhase = 'intro' | 'playing' | 'levelup' | 'roomclear' | 'vault' | 'gameover';

interface SpawnTicket {
  defId: EnemyId;
  delay: number;
}

interface BurstState {
  shotsRemaining: number;
  delayRemaining: number;
  angleRad: number;
}

interface RunState {
  phase: RunPhase;
  weaponId: WeaponId;
  player: Player;
  build: BuildStats;
  upgradesTaken: Record<string, number>;
  xp: number;
  level: number;
  xpForNext: number;
  enemies: EnemyInstance[];
  boss: BossInstance | null;
  roomSequence: EncounterWave[];
  roomIndex: number;
  roomsCleared: number;
  enemiesKilled: number;
  spawnQueue: SpawnTicket[];
  roomTransitionTimer: number;
  arenaW: number;
  arenaH: number;
  obstacles: ObstacleRect[];
  lockedTargetId: number | null;
  lockTimeRemaining: number;
  hitStopRemaining: number;
  burst: BurstState | null;
  input: InputController;
  projectiles: ProjectilePool;
  vfx: VfxSystem;
  canvas: HTMLCanvasElement | null;
  ctx: CanvasRenderingContext2D | null;
  rafId: number | null;
  lastTime: number;
}

let run: RunState | null = null;
let meta: TacticalMeta = { currency: 0, unlockedWeapons: [STARTING_UNLOCKED_WEAPON], unlockedPerks: [], eliteKills: 0, vaultsUsed: 0, bossesDefeated: [] };
let metaLoaded = false;

/** Loaded once per session (not on every run) — mutated in place and saved on every currency/unlock change, so repeat loads can't race a save still in flight. */
async function ensureMetaLoaded(): Promise<void> {
  if (metaLoaded) return;
  meta = await loadMeta();
  metaLoaded = true;
}

function xpForLevel(level: number): number {
  return BALANCE.xp.baseForLevel + (level - 1) * BALANCE.xp.perLevelGrowth;
}

function makeRunState(): RunState {
  return {
    phase: 'intro',
    weaponId: STARTING_WEAPON_ID,
    player: new Player(),
    build: makeDefaultBuild(),
    upgradesTaken: {},
    xp: 0,
    level: 1,
    xpForNext: xpForLevel(1),
    enemies: [],
    boss: null,
    roomSequence: [],
    roomIndex: 0,
    roomsCleared: 0,
    enemiesKilled: 0,
    spawnQueue: [],
    roomTransitionTimer: 0,
    arenaW: 760,
    arenaH: 570,
    obstacles: [],
    lockedTargetId: null,
    lockTimeRemaining: 0,
    burst: null,
    hitStopRemaining: 0,
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

  void showIntroOverlay(wrap);
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

async function showIntroOverlay(wrap: HTMLElement): Promise<void> {
  if (!run) return;
  await ensureMetaLoaded();
  if (!run) return; // navigated away while meta was loading
  if (!isWeaponUnlocked(meta, run.weaponId)) run.weaponId = STARTING_UNLOCKED_WEAPON;

  const overlay = document.createElement('div');
  overlay.id = 'tacIntroOverlay';
  // Fixed header + fixed footer (title, hint, start button always visible)
  // with only the weapon grid scrolling in between — a cut-off, unreachable
  // Start button on short viewports (10 weapon cards easily overflow a
  // ~240px-tall canvas area) is a real bug, not a nice-to-have.
  overlay.style.cssText =
    'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;gap:8px;background:rgba(8,7,12,.9);z-index:5;padding:14px 16px;';
  wrap.appendChild(overlay);
  renderIntroOverlayContent(overlay);
}

function renderIntroOverlayContent(overlay: HTMLElement): void {
  if (!run) return;
  const weapons = listWeapons();
  overlay.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;width:100%;max-width:420px;flex-shrink:0">
      <div class="arena-title" style="margin:0">Vælg dit våben</div>
      <div class="tac-currency-chip">🔷 ${meta.currency}</div>
    </div>
    <div class="weapon-select-grid" id="weaponSelectGrid" style="flex:1 1 auto;min-height:0;max-height:none;">
      ${weapons
        .map((w) => {
          const unlocked = isWeaponUnlocked(meta, w.id);
          const cost = WEAPON_COSTS[w.id] ?? 0;
          return `
        <button class="weapon-card ${w.id === run!.weaponId ? 'selected' : ''} ${unlocked ? '' : 'locked'}" data-weapon="${w.id}">
          <div class="icon">${w.icon}</div>
          <div class="name">${w.name}</div>
          <div class="tagline">${unlocked ? w.tagline : `🔒 Lås op for 🔷 ${cost}`}</div>
        </button>
      `;
        })
        .join('')}
    </div>
    <p style="flex-shrink:0;color:var(--text-faint);font-size:11px;text-align:center;line-height:1.4;margin:0">Stop for automatisk at skyde. Ryd rum, level op, overlev bossen.</p>
    <div style="display:flex;gap:8px;width:100%;max-width:340px;flex-shrink:0">
      <button class="btn btn-ghost" id="tacPerksBtn" style="flex:1">PERKS</button>
      <button class="btn btn-primary" id="tacStartBtn" style="flex:2">START MISSION</button>
    </div>
  `;

  overlay.querySelectorAll<HTMLButtonElement>('[data-weapon]').forEach((btn) => {
    btn.addEventListener('pointerdown', (e) => {
      if (!(e as PointerEvent).isPrimary || !run) return;
      e.preventDefault();
      const id = btn.dataset.weapon as WeaponId;
      if (!isWeaponUnlocked(meta, id)) {
        const cost = WEAPON_COSTS[id] ?? 999999;
        if (meta.currency < cost) {
          toast('Ikke nok Fragmenter til dette våben endnu');
          return;
        }
        tryUnlockWeapon(meta, id);
        void saveMeta(meta);
        Sound.pb();
        Haptics.personalBest();
        run.weaponId = id;
        renderIntroOverlayContent(overlay);
        return;
      }
      run.weaponId = id;
      overlay.querySelectorAll('.weapon-card').forEach((c) => c.classList.remove('selected'));
      btn.classList.add('selected');
      Sound.click();
    });
  });

  document.getElementById('tacPerksBtn')!.addEventListener('click', (e) => {
    e.stopPropagation();
    Sound.click();
    hud.showPerkShopModal(
      meta,
      PERK_DEFS,
      (perkId) => {
        const bought = tryUnlockPerk(meta, perkId);
        if (bought) {
          void saveMeta(meta);
          Sound.pb();
          Haptics.personalBest();
        } else {
          toast('Ikke nok Fragmenter til denne perk endnu');
        }
        return bought;
      },
      () => renderIntroOverlayContent(overlay),
    );
  });

  document.getElementById('tacStartBtn')!.addEventListener('click', (e) => {
    e.stopPropagation();
    overlay.remove();
    startRun();
  });
}

function startRun(): void {
  if (!run) return;
  applyPerks(meta, run.build);
  run.player.reset({ x: run.arenaW / 2, y: run.arenaH / 2 }, run.build);
  run.roomSequence = buildRoomSequence();
  hud.updateWeaponChip(currentWeapon().name);
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
  run.lockedTargetId = null;
  run.lockTimeRemaining = 0;
  run.burst = null;
  hud.showBossBar(false);

  if (index >= run.roomSequence.length) {
    hud.updateRoomLabel(`RUM ${TOTAL_ROOMS}/${TOTAL_ROOMS} · BOSS`);
    const bossId = pickBossId();
    run.boss = spawnBoss({ x: run.arenaW / 2, y: run.arenaH * 0.28 }, bossId);
    hud.showBossBar(true);
    hud.updateBossName(BOSS_NAMES[bossId]);
    hud.updateBossBar(run.boss.hp, run.boss.maxHp);
    run.spawnQueue = [];
    run.obstacles = []; // open arena for the boss fight
    run.vfx.warningBanner('boss', { x: run.arenaW / 2, y: run.arenaH / 2 });
    TacticalSound.bossWarning();
    return;
  }

  const wave = run.roomSequence[index];
  run.obstacles = toPixelRects(wave.obstacles ?? [], run.arenaW, run.arenaH);
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
  // Elite-instance chance climbs with room progress — near-zero in the opening rooms, capped at 22% by the last non-boss room, so lategame runs get real elite pressure without the first room ever surprising a new player.
  const eliteChance = Math.min(0.22, run.roomIndex * 0.025);
  const enemy = spawnEnemy(defId, { x, y }, eliteChance);
  run.enemies.push(enemy);
  if (ENEMY_DEFS[defId].isElite || enemy.eliteMod) {
    run.vfx.warningBanner('elite', { x: run.arenaW / 2, y: run.arenaH / 2 });
    TacticalSound.eliteWarning();
  }
}

function loop(now: number): void {
  if (!run || !run.canvas || !document.body.contains(run.canvas)) {
    cleanup();
    return;
  }
  const dt = Math.min(0.05, (now - run.lastTime) / 1000);
  run.lastTime = now;
  if (run.hitStopRemaining > 0) {
    run.hitStopRemaining -= dt;
  } else if (run.phase === 'playing') {
    update(dt);
  }
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
  resolveCircleVsObstacles(r.player.pos, r.player.radius, r.obstacles);
  if (isMoving) r.player.facing = vAngle({ x: moveVec.x, y: moveVec.y }) || r.player.facing;

  if (r.lockTimeRemaining > 0) r.lockTimeRemaining -= dt;

  if (r.burst) {
    r.burst.delayRemaining -= dt;
    if (r.burst.delayRemaining <= 0) {
      fireWeaponShots(r.burst.angleRad);
      r.burst.shotsRemaining--;
      r.burst.delayRemaining = WEAPONS[r.weaponId]?.burstDelayS ?? 0.08;
      if (r.burst.shotsRemaining <= 0) r.burst = null;
    }
  } else if (!isMoving && r.player.canFire()) {
    tryFire();
  }

  r.projectiles.update(dt);
  handleProjectileCollisions();

  for (const e of r.enemies) {
    const result = updateEnemy(e, r.player.pos, dt, r.arenaW, r.arenaH);
    resolveCircleVsObstacles(e.pos, ENEMY_DEFS[e.defId].radius, r.obstacles);
    if (result.meleeAttack) {
      const dmg = r.player.takeDamage(result.meleeAttack.damage, r.build);
      if (dmg > 0) onPlayerHit(dmg);
    }
    if (result.rangedAttack) fireEnemyProjectile(result.rangedAttack.from, result.rangedAttack.angleRad, result.rangedAttack.damage);
  }

  if (r.boss) {
    const bossResult = updateBoss(r.boss, r.player.pos, dt, r.arenaW, r.arenaH);
    resolveCircleVsObstacles(r.boss.pos, r.boss.radius, r.obstacles);
    if (bossResult.enteredBurstWindup) TacticalSound.bossWindup();
    if (bossResult.fireShot) fireBossProjectile(r.boss, bossResult.fireShot.angleRad, bossResult.fireShot.damage);
    if (bossResult.enteredSummonTelegraph) {
      TacticalSound.eliteWarning();
      r.vfx.warningBanner('elite', r.boss.pos);
    }
    if (bossResult.enteredSweepWindup) {
      TacticalSound.bossWindup();
      r.vfx.warningBanner('boss', r.boss.pos);
    }
    if (bossResult.summonAdds) {
      const { count, defId } = bossResult.summonAdds;
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const spawnDist = r.boss.radius + 60 + Math.random() * 40;
        r.enemies.push(
          spawnEnemy(defId, {
            x: Math.max(20, Math.min(r.arenaW - 20, r.boss.pos.x + Math.cos(angle) * spawnDist)),
            y: Math.max(20, Math.min(r.arenaH - 20, r.boss.pos.y + Math.sin(angle) * spawnDist)),
          }),
        );
      }
      r.vfx.impactSpark(r.boss.pos, '#8b6bff');
    }
    if (bossResult.slamNowResolving) {
      const { center, radius, damage } = bossResult.slamNowResolving;
      if (vDist(r.player.pos, center) <= radius) {
        const dmg = r.player.takeDamage(damage, r.build);
        if (dmg > 0) onPlayerHit(dmg);
      }
      r.vfx.deathBurst(center, '#ff5d7a');
      r.vfx.shake(14);
    }
    hud.updateBossBar(r.boss.hp, r.boss.maxHp);
    if (r.boss.hp <= 0) {
      r.vfx.deathBurst(r.boss.pos, '#ff5d7a');
      r.vfx.shake(16);
      TacticalSound.waveClear();
      r.roomsCleared = TOTAL_ROOMS;
      if (!meta.bossesDefeated.includes(r.boss.bossId)) meta.bossesDefeated.push(r.boss.bossId);
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

  const roomHasBoss = r.roomIndex >= r.roomSequence.length;
  if (!roomHasBoss && r.spawnQueue.length === 0 && r.enemies.length === 0 && r.phase === 'playing') {
    r.roomsCleared = r.roomIndex + 1;
    TacticalSound.waveClear();
    const nextIndex = r.roomIndex + 1;
    // A vault checkpoint every 3rd cleared room (never right before the boss room, which has its own warning beat) — a breather with a guaranteed reward instead of pure combat back-to-back.
    const showVault = (r.roomIndex + 1) % 3 === 0 && nextIndex < r.roomSequence.length;
    r.phase = showVault ? 'vault' : 'playing';
    setTimeout(() => {
      if (!run) return;
      if (showVault) {
        if (run.phase !== 'vault') return;
        showVaultScreen(nextIndex);
      } else {
        if (run.phase !== 'playing') return;
        startRoom(nextIndex);
      }
    }, 500);
  }
}

/** Vault checkpoint: a guaranteed, player-picked reward (heal / currency / a bonus upgrade) between rooms — no combat, just a beat of forward progress that doesn't ride on RNG the way a room-clear drop would. */
function showVaultScreen(nextIndex: number): void {
  if (!run) return;
  TacticalSound.levelUp();
  hud.showVaultModal((choice) => {
    if (!run) return;
    meta.vaultsUsed++;
    void saveMeta(meta);
    if (choice === 'heal') {
      run.player.heal(run.player.maxHp);
      toast('❤️ Fuldt helbredt');
      run.phase = 'playing';
      startRoom(nextIndex);
    } else if (choice === 'currency') {
      meta.currency += 40;
      toast('🔷 +40 Fragmenter');
      run.phase = 'playing';
      startRoom(nextIndex);
    } else {
      const choices = pickUpgradeChoices(run.upgradesTaken, 3);
      hud.showLevelUpModal(choices, (chosen) => {
        if (!run) return;
        chosen.apply(run.build);
        run.upgradesTaken[chosen.id] = (run.upgradesTaken[chosen.id] ?? 0) + 1;
        run.player.applyBuildHpChange(run.build);
        TacticalSound.upgradePick();
        run.phase = 'playing';
        startRoom(nextIndex);
      });
    }
  });
}

function onPlayerHit(dmg: number): void {
  if (!run) return;
  run.vfx.shake(6);
  run.vfx.impactSpark(run.player.pos, '#ff5d7a');
  TacticalSound.playerHurt();
  Haptics.miss();
  void dmg;
}

function currentWeapon() {
  return WEAPONS[run!.weaponId]!;
}

function computeWeaponRange(): number {
  if (!run) return 0;
  return currentWeapon().range * run.build.rangeMult;
}

/** Finds/keeps a target to fire at. Once locked, the same target is reused for BALANCE.juice.targetLockSeconds (or until it dies/leaves range/LOS) instead of re-selecting every shot — stops visible flicker between two similarly-placed enemies. */
function resolveFireTarget(): TargetCandidate | null {
  if (!run) return null;
  const r = run;
  const range = computeWeaponRange();
  const candidates: TargetCandidate[] = r.enemies.map((e) => ({ id: e.id, pos: e.pos, isElite: ENEMY_DEFS[e.defId].isElite || e.eliteMod }));
  if (r.boss) candidates.push({ id: -1, pos: r.boss.pos, isElite: true });

  if (r.lockedTargetId != null && r.lockTimeRemaining > 0) {
    const stillValid = candidates.find((c) => c.id === r.lockedTargetId);
    if (stillValid && vDist(r.player.pos, stillValid.pos) <= range) return stillValid;
    r.lockedTargetId = null;
  }

  const los = (c: TargetCandidate) => hasLineOfSight(r.player.pos, c.pos, r.obstacles);
  const picked = selectTarget(r.player.pos, candidates, range, los);
  if (picked) {
    r.lockedTargetId = picked.id;
    r.lockTimeRemaining = BALANCE.juice.targetLockSeconds;
  }
  return picked;
}

/** Spawns one weapon's worth of projectiles (all of `projectileCount`, spread across `spreadDeg`) at a fixed angle — shared by the immediate-fire path and each shot of a burst weapon. */
function fireWeaponShots(angle: number): void {
  if (!run) return;
  const r = run;
  const weapon = currentWeapon();
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
      radius: weapon.projectileRadius ?? 4,
      color: crit ? '#ffcf4d' : '#c9f73e',
      knockback: weapon.knockbackForce ?? 0,
      splashRadius: weapon.splashRadius ?? 0,
    });
  }
  r.vfx.muzzleFlash(r.player.pos, angle);
  TacticalSound.shot();
}

function tryFire(): void {
  if (!run) return;
  const r = run;
  const weapon = currentWeapon();
  const target = resolveFireTarget();
  if (!target) return;

  const angle = vAngle(vSub(target.pos, r.player.pos));
  r.player.facing = angle;

  if ((weapon.burstCount ?? 1) > 1) {
    // First shot fires immediately; the rest are queued and fired by the burst
    // ticker in update() so a 3-round burst actually reads as three shots,
    // not one instant triple-damage hit.
    fireWeaponShots(angle);
    r.burst = { shotsRemaining: weapon.burstCount! - 1, delayRemaining: weapon.burstDelayS ?? 0.08, angleRad: angle };
  } else {
    fireWeaponShots(angle);
  }
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
      vx: Math.cos(a) * BALANCE.enemyProjectile.speed,
      vy: Math.sin(a) * BALANCE.enemyProjectile.speed,
      damage: damage / (pelletCount > 1 ? 2 : 1),
      crit: false,
      penetration: 0,
      ricochetChance: 0,
      maxRange: BALANCE.enemyProjectile.maxRange,
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
    vx: Math.cos(angleRad) * BALANCE.enemyProjectile.bossSpeed,
    vy: Math.sin(angleRad) * BALANCE.enemyProjectile.bossSpeed,
    damage,
    crit: false,
    penetration: 0,
    ricochetChance: 0,
    maxRange: BALANCE.enemyProjectile.bossMaxRange,
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
        if (p.hitIds.has(e.id) || e.hp <= 0) continue;
        const def = ENEMY_DEFS[e.defId];
        if (vDist(p, e.pos) <= p.radius + def.radius) {
          applyDamageToEnemy(e, p.damage, p.crit);
          if (p.knockback > 0) {
            const dir = vNorm({ x: p.vx, y: p.vy });
            e.pos.x += dir.x * p.knockback;
            e.pos.y += dir.y * p.knockback;
          }
          if (p.splashRadius > 0) {
            for (const other of r.enemies) {
              if (other.id === e.id || other.hp <= 0 || p.hitIds.has(other.id)) continue;
              if (vDist(e.pos, other.pos) <= p.splashRadius) {
                applyDamageToEnemy(other, p.damage, false);
                p.hitIds.add(other.id);
              }
            }
            r.vfx.impactSpark(e.pos, '#ffb347');
            r.vfx.shake(4);
          }
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
  if (crit) {
    run.vfx.critBurst(e.pos);
    TacticalSound.crit();
    Haptics.hit();
    run.hitStopRemaining = Math.max(run.hitStopRemaining, BALANCE.juice.hitStopCritS);
  } else {
    TacticalSound.hit();
  }
  if (run.build.lifestealPct > 0) run.player.heal(dmg * run.build.lifestealPct);

  if (e.hp <= 0) {
    const xpReward = Math.round(ENEMY_DEFS[e.defId].xpReward * (e.eliteMod ? 1.6 : 1));
    run.vfx.deathBurst(e.pos, ENEMY_DEFS[e.defId].color);
    run.vfx.xpPop(e.pos, xpReward);
    TacticalSound.enemyDeath();
    Haptics.hit();
    run.hitStopRemaining = Math.max(run.hitStopRemaining, BALANCE.juice.hitStopKillS);
    grantXp(xpReward);
    run.enemies = run.enemies.filter((x) => x.id !== e.id);
    run.enemiesKilled++;
    if (e.eliteMod) meta.eliteKills++;
    if (run.build.healOnKillChance > 0 && Math.random() < run.build.healOnKillChance) run.player.heal(8);
  }
}

function applyDamageToBoss(b: BossInstance, dmg: number, crit: boolean): void {
  if (!run) return;
  b.hp -= dmg;
  b.hitFlash = 0.08;
  run.vfx.impactSpark(b.pos, '#ff5d7a');
  run.vfx.damageNumber(b.pos, dmg, crit);
  if (crit) {
    run.vfx.critBurst(b.pos);
    TacticalSound.crit();
    run.hitStopRemaining = Math.max(run.hitStopRemaining, BALANCE.juice.hitStopCritS);
  } else {
    TacticalSound.hit();
    run.hitStopRemaining = Math.max(run.hitStopRemaining, BALANCE.juice.hitStopBossHitS);
  }
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

/** Traces a shape path centered on the origin (caller has already translated/rotated) — distinct silhouettes per enemy archetype so they read apart by shape alone, not just color. */
function traceEnemyShape(ctx: CanvasRenderingContext2D, shape: string | undefined, r: number): void {
  ctx.beginPath();
  switch (shape) {
    case 'triangle':
      ctx.moveTo(r * 1.15, 0);
      ctx.lineTo(-r * 0.75, r * 0.9);
      ctx.lineTo(-r * 0.75, -r * 0.9);
      ctx.closePath();
      break;
    case 'diamond':
      ctx.moveTo(r * 1.2, 0);
      ctx.lineTo(0, r);
      ctx.lineTo(-r * 1.2, 0);
      ctx.lineTo(0, -r);
      ctx.closePath();
      break;
    case 'hex': {
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      break;
    }
    case 'chevron': {
      // an arrow-like wedge — reads as "moving diagonally," fitting the flanker's arc-in approach
      ctx.moveTo(r * 1.2, 0);
      ctx.lineTo(-r * 0.3, r);
      ctx.lineTo(-r * 0.2, 0);
      ctx.lineTo(-r * 0.3, -r);
      ctx.closePath();
      break;
    }
    default:
      ctx.arc(0, 0, r, 0, Math.PI * 2);
  }
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
  // subtle vignette — draws the eye toward the center of the arena instead of the edges
  const vignette = ctx.createRadialGradient(arenaW / 2, arenaH / 2, Math.min(arenaW, arenaH) * 0.35, arenaW / 2, arenaH / 2, Math.max(arenaW, arenaH) * 0.7);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, arenaW, arenaH);

  // obstacles / cover — beveled top-left highlight / bottom-right shadow so
  // they read as solid 3D crates rather than flat dark rectangles
  for (const o of run.obstacles) {
    ctx.fillStyle = '#1e1c2f';
    ctx.fillRect(o.x, o.y, o.w, o.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(o.x, o.y + o.h);
    ctx.lineTo(o.x, o.y);
    ctx.lineTo(o.x + o.w, o.y);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.moveTo(o.x + o.w, o.y);
    ctx.lineTo(o.x + o.w, o.y + o.h);
    ctx.lineTo(o.x, o.y + o.h);
    ctx.stroke();
    // faint diagonal hatching reinforces "solid cover" at a glance
    ctx.save();
    ctx.beginPath();
    ctx.rect(o.x, o.y, o.w, o.h);
    ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    const diag = o.w + o.h;
    for (let hx = 0; hx < diag; hx += 9) {
      ctx.beginPath();
      ctx.moveTo(o.x + hx, o.y);
      ctx.lineTo(o.x + hx - o.h, o.y + o.h);
      ctx.stroke();
    }
    ctx.restore();
  }

  // boss burst wind-up tell
  if (run.boss && run.boss.phase === 'burstWindup') {
    ctx.beginPath();
    ctx.arc(run.boss.pos.x, run.boss.pos.y, run.boss.radius + 8, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,93,122,0.7)';
    ctx.lineWidth = 3;
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

  // harbinger: violet pulse ring while summoning adds — distinct color from the coral commander tells, so a player who's seen both bosses reads "purple = adds incoming" at a glance
  if (run.boss && run.boss.phase === 'summonTelegraph') {
    ctx.beginPath();
    ctx.arc(run.boss.pos.x, run.boss.pos.y, run.boss.radius + 10, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(139,107,255,0.75)';
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  // harbinger: wide wedge showing the sweep's full arc before it starts firing — the player sees the whole danger zone up front, not just where the current shot is
  if (run.boss && run.boss.phase === 'sweepWindup') {
    const B = run.boss;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(B.pos.x, B.pos.y);
    ctx.arc(B.pos.x, B.pos.y, 340, B.sweepAngle, B.sweepAngle + BALANCE.harbinger.sweepArcRad);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,93,122,0.09)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,93,122,0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  // enemy attack telegraphs — ranged types show an aim line, melee types show a closing warning ring (works for any enemy that sets telegraphRemaining/telegraphTotal, so new archetypes get this for free)
  for (const e of run.enemies) {
    if (e.telegraphRemaining <= 0) continue;
    const progress = e.telegraphTotal > 0 ? 1 - e.telegraphRemaining / e.telegraphTotal : 0;
    if (e.isMelee) {
      const def = ENEMY_DEFS[e.defId];
      ctx.save();
      ctx.beginPath();
      ctx.arc(e.pos.x, e.pos.y, def.radius + 4 + progress * 8, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,93,122,${0.5 + 0.3 * Math.sin(progress * 25)})`;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    } else {
      ctx.save();
      ctx.strokeStyle = `rgba(255,93,122,${0.25 + 0.35 * progress})`;
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
    traceEnemyShape(ctx, def.shape, def.radius);
    ctx.fill();
    // runtime elite-modified instances get a violet outline instead of the
    // default dark one — the same "elite = violet" language as elite_rifleman's
    // hp sliver, so it reads as a threat tier even on an otherwise-plain enemy shape
    ctx.strokeStyle = e.eliteMod ? '#8b6bff' : 'rgba(0,0,0,0.3)';
    ctx.lineWidth = e.eliteMod ? 2.5 : 1.5;
    ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(def.radius - 3, -3, 10, 6);
    ctx.restore();
    // hp sliver for elites (static isElite defs and runtime-elite instances alike)
    if (def.isElite || e.eliteMod) {
      const w = def.radius * 2;
      ctx.fillStyle = 'rgba(0,0,0,.4)';
      ctx.fillRect(e.pos.x - w / 2, e.pos.y - def.radius - 10, w, 4);
      ctx.fillStyle = '#8b6bff';
      ctx.fillRect(e.pos.x - w / 2, e.pos.y - def.radius - 10, w * Math.max(0, e.hp / e.maxHp), 4);
    }
  }

  // boss — a core plus two flanking armor plates so it reads as a bigger,
  // multi-part threat rather than just a scaled-up regular enemy
  if (run.boss) {
    const b = run.boss;
    const bossAccent = b.bossId === 'harbinger' ? '#8b6bff' : '#ff5d7a';
    ctx.save();
    ctx.translate(b.pos.x, b.pos.y);
    ctx.rotate(b.facing);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(-b.radius * 0.3, -b.radius * 1.35, b.radius * 0.9, b.radius * 0.55);
    ctx.fillRect(-b.radius * 0.3, b.radius * 0.8, b.radius * 0.9, b.radius * 0.55);
    ctx.fillStyle = b.hitFlash > 0 ? '#ffffff' : '#3a2540';
    ctx.strokeStyle = bossAccent;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, b.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(b.radius - 5, -5, 16, 10);
    ctx.restore();
  }

  // player — a soft glow ring plus a tapered "barrel" instead of a flat
  // rectangle reads more like an armed operative than a bare circle
  const p = run.player;
  ctx.save();
  ctx.translate(p.pos.x, p.pos.y);
  ctx.beginPath();
  ctx.arc(0, 0, p.radius + 5, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(201,247,62,0.12)';
  ctx.fill();
  ctx.rotate(p.facing);
  ctx.fillStyle = p.invulnRemaining > 0.06 ? 'rgba(201,247,62,0.55)' : '#c9f73e';
  ctx.beginPath();
  ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#08070c';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#08070c';
  ctx.beginPath();
  ctx.moveTo(p.radius - 5, -4);
  ctx.lineTo(p.radius + 9, -2);
  ctx.lineTo(p.radius + 9, 2);
  ctx.lineTo(p.radius - 5, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // projectiles — a short fading trail behind each one reads as "moving fast"
  // far better than a bare dot, especially for the faster/smaller rounds.
  for (const pr of run.projectiles.active()) {
    const speed = Math.hypot(pr.vx, pr.vy) || 1;
    const trailLen = Math.min(26, pr.radius * 3.5);
    const tx = pr.x - (pr.vx / speed) * trailLen;
    const ty = pr.y - (pr.vy / speed) * trailLen;
    const trail = ctx.createLinearGradient(pr.x, pr.y, tx, ty);
    trail.addColorStop(0, pr.color);
    trail.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.strokeStyle = trail;
    ctx.lineWidth = pr.radius * 1.1;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(pr.x, pr.y);
    ctx.lineTo(tx, ty);
    ctx.stroke();

    ctx.fillStyle = pr.color;
    ctx.beginPath();
    ctx.arc(pr.x, pr.y, pr.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  run.vfx.render(ctx, arenaW, arenaH);
  ctx.restore();
}

function endRun(victory: boolean): void {
  if (!run) return;
  run.phase = 'gameover';
  const score = run.roomsCleared;
  const reward = computeRunReward(run.roomsCleared, run.enemiesKilled, victory);
  meta.currency += reward;
  void saveMeta(meta);
  TacticalSound.waveClear();
  Haptics.miss();
  void finishAndShowResults(score, victory, reward);
}

async function finishAndShowResults(score: number, victory: boolean, reward: number): Promise<void> {
  const { isNewBest, xpGain, rank } = await finishGameSession('tactical', score, {
    tacticalEliteKills: meta.eliteKills,
    tacticalVaultsUsed: meta.vaultsUsed,
    tacticalBossesDefeated: meta.bossesDefeated,
  });
  Sound.complete();
  if (isNewBest) {
    setTimeout(() => Sound.pb(), 250);
    Haptics.personalBest();
  }
  showResultsScreen(score, victory, isNewBest, xpGain, rank, reward);
}

function showResultsScreen(score: number, victory: boolean, isNewBest: boolean, xpGain: number, rank: number | null, reward: number): void {
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
          <div class="xp-toast">🔷 +${reward} Fragmenter optjent</div>

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
