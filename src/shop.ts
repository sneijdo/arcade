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
  { id: 'gamepad', emoji: '🎮', cost: 40 },
  { id: 'joystick', emoji: '🕹️', cost: 40 },
  { id: 'invader', emoji: '👾', cost: 60 },
  { id: 'target', emoji: '🎯', cost: 60 },
  { id: 'fox', emoji: '🦊', cost: 120 },
  { id: 'wolf', emoji: '🐺', cost: 120 },
  { id: 'lion', emoji: '🦁', cost: 150 },
  { id: 'lightning', emoji: '⚡', cost: 180 },
  { id: 'dragon', emoji: '🐉', cost: 200 },
  { id: 'robot', emoji: '🤖', cost: 280 },
  { id: 'alien', emoji: '👽', cost: 280 },
  { id: 'skull', emoji: '💀', cost: 320 },
  { id: 'fire', emoji: '🔥', cost: 320 },
  { id: 'star', emoji: '🌟', cost: 500 },
  { id: 'crown', emoji: '👑', cost: 650 },
  { id: 'trophy', emoji: '🏆', cost: 800 },
];

export const TITLES: TitleDef[] = [
  { id: 'veteran', label: 'VETERAN', cost: 60 },
  { id: 'pixelpirat', label: 'PIXEL-PIRAT', cost: 100 },
  { id: 'skyggeloeber', label: 'SKYGGELØBER', cost: 100 },
  { id: 'kaosagent', label: 'KAOSAGENT', cost: 150 },
  { id: 'hoejtflyvende', label: 'HØJTFLYVENDE', cost: 150 },
  { id: 'elitespiller', label: 'ELITESPILLER', cost: 250 },
  { id: 'dominator', label: 'DOMINATOR', cost: 300 },
  { id: 'uovervindelig', label: 'UOVERVINDELIG', cost: 400 },
  { id: 'legendarisk', label: 'LEGENDARISK', cost: 600 },
  { id: 'arcadekongen', label: 'ARCADE-KONGEN', cost: 900 },
];

export function findAvatar(id: string | null | undefined): AvatarDef | null {
  return id ? AVATARS.find((a) => a.id === id) ?? null : null;
}

export function findTitle(id: string | null | undefined): TitleDef | null {
  return id ? TITLES.find((t) => t.id === id) ?? null : null;
}
