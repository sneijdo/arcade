import type { TowerId, EnemyId } from './types';

const TOWER_SPRITE_PATH: Record<TowerId, string> = {
  firemage: '/td-sprites/tower-firemage.svg',
  frosttower: '/td-sprites/tower-frosttower.svg',
  lightning: '/td-sprites/tower-lightning.svg',
  catapult: '/td-sprites/tower-catapult.svg',
  obelisk: '/td-sprites/tower-obelisk.svg',
};

const ENEMY_SPRITE_PATH: Record<EnemyId, string> = {
  goblin: '/td-sprites/enemy-goblin.svg',
  goblin_shaman: '/td-sprites/enemy-goblin-shaman.svg',
  orc: '/td-sprites/enemy-orc.svg',
  orc_shield: '/td-sprites/enemy-orc-shield.svg',
  orc_berserker: '/td-sprites/enemy-orc-berserker.svg',
  troll: '/td-sprites/enemy-troll.svg',
};

const cache = new Map<string, HTMLImageElement>();

function load(path: string): HTMLImageElement {
  let img = cache.get(path);
  if (!img) {
    img = new Image();
    img.src = path;
    cache.set(path, img);
  }
  return img;
}

export function getTowerSprite(id: TowerId): HTMLImageElement {
  return load(TOWER_SPRITE_PATH[id]);
}

export function getEnemySprite(id: EnemyId): HTMLImageElement {
  return load(ENEMY_SPRITE_PATH[id]);
}

/** Raw asset URL — for DOM `<img>` usage (modal cards) rather than canvas drawImage. */
export function towerSpritePath(id: TowerId): string {
  return TOWER_SPRITE_PATH[id];
}

/** Kicks off loading every sprite immediately (browser caches after) instead of lazily on first
 * draw, so the very first frame of a session doesn't show fallback placeholders. */
export function preloadSprites(): void {
  Object.values(TOWER_SPRITE_PATH).forEach(load);
  Object.values(ENEMY_SPRITE_PATH).forEach(load);
}

/** True once an image has actually decoded — draw callers fall back to a simple placeholder shape
 * until then (only matters for the first ~1 frame of a session in practice). */
export function isSpriteReady(img: HTMLImageElement): boolean {
  return img.complete && img.naturalWidth > 0;
}
