export interface AvatarDef {
  id: string;
  emoji: string;
  cost: number;
}

export interface TitleDef {
  id: string;
  label: string;
  cost: number;
}

/** Purchasable with xpBalance (see state.ts). No entry here is "default" — an unset equippedAvatar just falls back to initials(name). */
export const AVATARS: AvatarDef[] = [
  { id: 'gamepad', emoji: '🎮', cost: 50 },
  { id: 'joystick', emoji: '🕹️', cost: 50 },
  { id: 'invader', emoji: '👾', cost: 75 },
  { id: 'target', emoji: '🎯', cost: 75 },
  { id: 'fox', emoji: '🦊', cost: 150 },
  { id: 'wolf', emoji: '🐺', cost: 150 },
  { id: 'lion', emoji: '🦁', cost: 190 },
  { id: 'lightning', emoji: '⚡', cost: 230 },
  { id: 'dragon', emoji: '🐉', cost: 260 },
  { id: 'robot', emoji: '🤖', cost: 360 },
  { id: 'alien', emoji: '👽', cost: 360 },
  { id: 'skull', emoji: '💀', cost: 420 },
  { id: 'fire', emoji: '🔥', cost: 420 },
  { id: 'star', emoji: '🌟', cost: 650 },
  { id: 'crown', emoji: '👑', cost: 900 },
  { id: 'trophy', emoji: '🏆', cost: 1200 },
];

export const TITLES: TitleDef[] = [
  { id: 'veteran', label: 'VETERAN', cost: 75 },
  { id: 'pixelpirat', label: 'PIXEL-PIRAT', cost: 125 },
  { id: 'skyggeloeber', label: 'SKYGGELØBER', cost: 125 },
  { id: 'kaosagent', label: 'KAOSAGENT', cost: 190 },
  { id: 'hoejtflyvende', label: 'HØJTFLYVENDE', cost: 190 },
  { id: 'elitespiller', label: 'ELITESPILLER', cost: 320 },
  { id: 'dominator', label: 'DOMINATOR', cost: 390 },
  { id: 'uovervindelig', label: 'UOVERVINDELIG', cost: 520 },
  { id: 'legendarisk', label: 'LEGENDARISK', cost: 800 },
  { id: 'arcadekongen', label: 'ARCADE-KONGEN', cost: 1300 },
];

export function findAvatar(id: string | null | undefined): AvatarDef | null {
  return id ? AVATARS.find((a) => a.id === id) ?? null : null;
}

export function findTitle(id: string | null | undefined): TitleDef | null {
  return id ? TITLES.find((t) => t.id === id) ?? null : null;
}
