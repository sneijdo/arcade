import type { Rarity } from './types';

export interface AvatarDef {
  id: string;
  name: string;
  asset: string;
  rarity: Rarity;
  cost: number;
  /** Not buyable below this level, regardless of XP balance — epic tier only. */
  unlockLevel?: number;
  /** Legendary tier only — not buyable until the player already owns this many OTHER legendary
   * items (any kind), on top of the usual legendary-slot requirement. A second, steeper gate for
   * a couple of specific joke/personal titles the owner wants reserved for players who've already
   * cleaned out the "serious" legendary catalog. */
  requiresOwnedLegendary?: number;
}

export interface FrameDef {
  id: string;
  name: string;
  asset: string;
  rarity: Rarity;
  cost: number;
  unlockLevel?: number;
  requiresOwnedLegendary?: number;
}

export interface TitleDef {
  id: string;
  label: string;
  asset: string;
  rarity: Rarity;
  cost: number;
  unlockLevel?: number;
  requiresOwnedLegendary?: number;
}

/**
 * Cosmetics Pack V1 (see /art/manifest.json — ids/names/rarities are canonical, taken directly
 * from there). Replaces the original emoji-avatar / text-title catalog entirely: existing
 * owned/equipped legacy ids simply stop resolving (findAvatar/findTitle already return null for
 * unknown ids, and avatarContent()/title rendering already fall back gracefully), which is the
 * accepted tradeoff for a full visual upgrade rather than a migration to route around.
 */
export const AVATARS: AvatarDef[] = [
  { id: 'avatar-pixel-kid', name: 'Pixel Kid', asset: '/cosmetics/avatars/common/pixel-kid.png', rarity: 'common', cost: 60 },
  { id: 'avatar-alien', name: 'Alien', asset: '/cosmetics/avatars/common/alien.png', rarity: 'common', cost: 80 },
  { id: 'avatar-arcade-bot', name: 'Arcade Bot', asset: '/cosmetics/avatars/common/arcade-bot.png', rarity: 'common', cost: 100 },
  { id: 'avatar-ghost', name: 'Ghost', asset: '/cosmetics/avatars/common/ghost.png', rarity: 'common', cost: 120 },
  { id: 'avatar-cyber-kid', name: 'Cyber Kid', asset: '/cosmetics/avatars/rare/cyber-kid.png', rarity: 'rare', cost: 150 },
  { id: 'avatar-racer', name: 'Racer', asset: '/cosmetics/avatars/rare/racer.png', rarity: 'rare', cost: 200 },
  { id: 'avatar-ninja', name: 'Ninja', asset: '/cosmetics/avatars/rare/ninja.png', rarity: 'rare', cost: 250 },
  { id: 'avatar-space-cat', name: 'Space Cat', asset: '/cosmetics/avatars/rare/space-cat.png', rarity: 'rare', cost: 300 },
  { id: 'avatar-cyber-samurai', name: 'Cyber Samurai', asset: '/cosmetics/avatars/epic/cyber-samurai.png', rarity: 'epic', cost: 450, unlockLevel: 10 },
  { id: 'avatar-neon-hacker', name: 'Neon Hacker', asset: '/cosmetics/avatars/epic/neon-hacker.png', rarity: 'epic', cost: 550, unlockLevel: 11 },
  { id: 'avatar-arcade-wizard', name: 'Arcade Wizard', asset: '/cosmetics/avatars/epic/arcade-wizard.png', rarity: 'epic', cost: 650, unlockLevel: 12 },
  { id: 'avatar-glitch', name: 'Glitch', asset: '/cosmetics/avatars/epic/glitch.png', rarity: 'epic', cost: 750, unlockLevel: 13 },
  { id: 'avatar-arcade-king', name: 'Arcade King', asset: '/cosmetics/avatars/legendary/arcade-king.png', rarity: 'legendary', cost: 1000 },
  { id: 'avatar-glitch-god', name: 'Glitch God', asset: '/cosmetics/avatars/legendary/glitch-god.png', rarity: 'legendary', cost: 1200 },
  { id: 'avatar-void', name: 'Void', asset: '/cosmetics/avatars/legendary/void.png', rarity: 'legendary', cost: 1400 },
  { id: 'avatar-8-bit-legend', name: '8-Bit Legend', asset: '/cosmetics/avatars/legendary/8-bit-legend.png', rarity: 'legendary', cost: 1600 },
];

/**
 * Frames V2 (art/frames/*.svg — dropped in directly, no updated root manifest entry, so this
 * catalog is hand-built from the actual folder contents rather than art/manifest.json). Vector
 * now instead of raster PNG, which also resolves the "frames might not read well at 28px" open
 * question from the original integration — SVG stays crisp at any size.
 * Composition changed from V1: "Dragon" (epic) and "Arcade King" (legendary) are retired (no
 * longer present in the source), "Prism" (epic) and "Neon Legend" (legendary) are new, and
 * "Circuit" moved from common to rare — "Scanlines" is the new 4th common. Since this pack
 * shipped only hours ago, no player has meaningfully owned the retired ids yet.
 */
export const FRAMES: FrameDef[] = [
  { id: 'frame-pixel', name: 'Pixel', asset: '/cosmetics/frames/common/pixel.svg', rarity: 'common', cost: 60 },
  { id: 'frame-retro', name: 'Retro', asset: '/cosmetics/frames/common/retro.svg', rarity: 'common', cost: 80 },
  { id: 'frame-arcade', name: 'Arcade', asset: '/cosmetics/frames/common/arcade.svg', rarity: 'common', cost: 100 },
  { id: 'frame-scanlines', name: 'Scanlines', asset: '/cosmetics/frames/common/scanlines.svg', rarity: 'common', cost: 120 },
  { id: 'frame-neon', name: 'Neon', asset: '/cosmetics/frames/rare/neon.svg', rarity: 'rare', cost: 150 },
  { id: 'frame-cyber', name: 'Cyber', asset: '/cosmetics/frames/rare/cyber.svg', rarity: 'rare', cost: 200 },
  { id: 'frame-holographic', name: 'Holographic', asset: '/cosmetics/frames/rare/holographic.svg', rarity: 'rare', cost: 250 },
  { id: 'frame-circuit', name: 'Circuit', asset: '/cosmetics/frames/rare/circuit.svg', rarity: 'rare', cost: 300 },
  { id: 'frame-glitch', name: 'Glitch', asset: '/cosmetics/frames/epic/glitch.svg', rarity: 'epic', cost: 450, unlockLevel: 10 },
  { id: 'frame-plasma', name: 'Plasma', asset: '/cosmetics/frames/epic/plasma.svg', rarity: 'epic', cost: 550, unlockLevel: 11 },
  { id: 'frame-galaxy', name: 'Galaxy', asset: '/cosmetics/frames/epic/galaxy.svg', rarity: 'epic', cost: 650, unlockLevel: 12 },
  { id: 'frame-prism', name: 'Prism', asset: '/cosmetics/frames/epic/prism.svg', rarity: 'epic', cost: 750, unlockLevel: 13 },
  { id: 'frame-golden', name: 'Golden', asset: '/cosmetics/frames/legendary/golden.svg', rarity: 'legendary', cost: 1000 },
  { id: 'frame-diamond', name: 'Diamond', asset: '/cosmetics/frames/legendary/diamond.svg', rarity: 'legendary', cost: 1200 },
  { id: 'frame-neon-legend', name: 'Neon Legend', asset: '/cosmetics/frames/legendary/neon-legend.svg', rarity: 'legendary', cost: 1400 },
  { id: 'frame-void', name: 'Void', asset: '/cosmetics/frames/legendary/void.svg', rarity: 'legendary', cost: 1600 },
];

/** The 2 "secret" titles (rarity: 'secret') are deliberately absent here — they're never purchasable, only auto-granted by checkSecretUnlocks() in state.ts, and only rendered in the shop once owned. See SECRET_TITLES below. */
export const TITLES: TitleDef[] = [
  { id: 'title-new-player', label: 'NEW PLAYER', asset: '/cosmetics/titles/new-player.svg', rarity: 'common', cost: 50 },
  { id: 'title-rookie', label: 'ROOKIE', asset: '/cosmetics/titles/rookie.svg', rarity: 'common', cost: 60 },
  { id: 'title-player-one', label: 'PLAYER ONE', asset: '/cosmetics/titles/player-one.svg', rarity: 'common', cost: 70 },
  { id: 'title-arcade-one', label: 'ARCADE ONE', asset: '/cosmetics/titles/arcade-one.svg', rarity: 'common', cost: 80 },
  { id: 'title-fan', label: 'FAN', asset: '/cosmetics/titles/fan.svg', rarity: 'common', cost: 90 },
  { id: 'title-beginner', label: 'BEGINNER', asset: '/cosmetics/titles/beginner.svg', rarity: 'common', cost: 100 },
  { id: 'title-arcade-fan', label: 'ARCADE FAN', asset: '/cosmetics/titles/arcade-fan.svg', rarity: 'common', cost: 110 },
  { id: 'title-grinder', label: 'GRINDER', asset: '/cosmetics/titles/grinder.svg', rarity: 'common', cost: 120 },
  { id: 'title-score-chaser', label: 'SCORE CHASER', asset: '/cosmetics/titles/score-chaser.svg', rarity: 'rare', cost: 130 },
  { id: 'title-high-scorer', label: 'HIGH SCORER', asset: '/cosmetics/titles/high-scorer.svg', rarity: 'rare', cost: 150 },
  { id: 'title-coin-collector', label: 'COIN COLLECTOR', asset: '/cosmetics/titles/coin-collector.svg', rarity: 'rare', cost: 170 },
  { id: 'title-progress', label: 'PROGRESS', asset: '/cosmetics/titles/progress.svg', rarity: 'rare', cost: 190 },
  { id: 'title-ranked', label: 'RANKED', asset: '/cosmetics/titles/ranked.svg', rarity: 'rare', cost: 210 },
  { id: 'title-speedrunner', label: 'SPEEDRUNNER', asset: '/cosmetics/titles/speedrunner.svg', rarity: 'rare', cost: 230 },
  { id: 'title-unstoppable', label: 'UNSTOPPABLE', asset: '/cosmetics/titles/unstoppable.svg', rarity: 'rare', cost: 250 },
  { id: 'title-high-roller', label: 'HIGH ROLLER', asset: '/cosmetics/titles/high-roller.svg', rarity: 'rare', cost: 270 },
  { id: 'title-top-10', label: 'TOP 10', asset: '/cosmetics/titles/top-10.svg', rarity: 'rare', cost: 290 },
  { id: 'title-streaker', label: 'STREAKER', asset: '/cosmetics/titles/streaker.svg', rarity: 'rare', cost: 310 },
  { id: 'title-arcade-hero', label: 'ARCADE HERO', asset: '/cosmetics/titles/arcade-hero.svg', rarity: 'epic', cost: 400, unlockLevel: 10 },
  { id: 'title-cyber-master', label: 'CYBER MASTER', asset: '/cosmetics/titles/cyber-master.svg', rarity: 'epic', cost: 450, unlockLevel: 10 },
  { id: 'title-the-chosen-one', label: 'THE CHOSEN ONE', asset: '/cosmetics/titles/the-chosen-one.svg', rarity: 'epic', cost: 500, unlockLevel: 11 },
  { id: 'title-dragon-rider', label: 'DRAGON RIDER', asset: '/cosmetics/titles/dragon-rider.svg', rarity: 'epic', cost: 550, unlockLevel: 11 },
  { id: 'title-perfect-run', label: 'PERFECT RUN', asset: '/cosmetics/titles/perfect-run.svg', rarity: 'epic', cost: 600, unlockLevel: 12 },
  { id: 'title-planker', label: 'PLANKER', asset: '/cosmetics/titles/planker.svg', rarity: 'epic', cost: 650, unlockLevel: 12 },
  { id: 'title-diamond-title', label: 'DIAMOND', asset: '/cosmetics/titles/diamond-title.svg', rarity: 'epic', cost: 700, unlockLevel: 13 },
  { id: 'title-no-death', label: 'NO DEATH', asset: '/cosmetics/titles/no-death.svg', rarity: 'epic', cost: 750, unlockLevel: 13 },
  { id: 'title-elite', label: 'ELITE', asset: '/cosmetics/titles/elite.svg', rarity: 'epic', cost: 800, unlockLevel: 14 },
  { id: 'title-global', label: 'GLOBAL', asset: '/cosmetics/titles/global.svg', rarity: 'epic', cost: 850, unlockLevel: 14 },
  { id: 'title-void-walker', label: 'VOID WALKER', asset: '/cosmetics/titles/void-walker.svg', rarity: 'epic', cost: 875, unlockLevel: 14 },
  { id: 'title-score-king', label: 'SCORE KING', asset: '/cosmetics/titles/score-king.svg', rarity: 'legendary', cost: 900 },
  { id: 'title-arcade-legend', label: 'ARCADE LEGEND', asset: '/cosmetics/titles/arcade-legend.svg', rarity: 'legendary', cost: 1000 },
  { id: 'title-the-king', label: 'THE KING', asset: '/cosmetics/titles/the-king.svg', rarity: 'legendary', cost: 1100 },
  { id: 'title-8-bit-legend', label: '8-BIT LEGEND', asset: '/cosmetics/titles/8-bit-legend.svg', rarity: 'legendary', cost: 1200 },
  { id: 'title-dragon-lord', label: 'DRAGON LORD', asset: '/cosmetics/titles/dragon-lord.svg', rarity: 'legendary', cost: 1300 },
  { id: 'title-cosmic', label: 'COSMIC', asset: '/cosmetics/titles/cosmic.svg', rarity: 'legendary', cost: 1400 },
  { id: 'title-the-ultimate', label: 'THE ULTIMATE', asset: '/cosmetics/titles/the-ultimate.svg', rarity: 'legendary', cost: 1500 },
  { id: 'title-god-mode', label: 'GOD MODE', asset: '/cosmetics/titles/god-mode.svg', rarity: 'legendary', cost: 1600 },
  { id: 'title-jas-final-boss', label: 'JAS FINAL BOSS', asset: '/cosmetics/titles/jas-final-boss.svg', rarity: 'legendary', cost: 1700, requiresOwnedLegendary: 4 },
  { id: 'title-stor-pik', label: 'STOR PIK', asset: '/cosmetics/titles/stor-pik.svg', rarity: 'legendary', cost: 1800, requiresOwnedLegendary: 4 },
];

/** Never shown in the shop until owned — auto-granted by checkSecretUnlocks() in state.ts. Name stays "???" (matches the source art) until then. */
export const SECRET_TITLES: TitleDef[] = [
  { id: 'title-secret-01', label: '???', asset: '/cosmetics/titles/secret-01.svg', rarity: 'secret', cost: 0 },
  { id: 'title-secret-02', label: '???', asset: '/cosmetics/titles/secret-02.svg', rarity: 'secret', cost: 0 },
];

export function findAvatar(id: string | null | undefined): AvatarDef | null {
  return id ? AVATARS.find((a) => a.id === id) ?? null : null;
}

export function findFrame(id: string | null | undefined): FrameDef | null {
  return id ? FRAMES.find((f) => f.id === id) ?? null : null;
}

export function findTitle(id: string | null | undefined): TitleDef | null {
  if (!id) return null;
  return TITLES.find((t) => t.id === id) ?? SECRET_TITLES.find((t) => t.id === id) ?? null;
}
