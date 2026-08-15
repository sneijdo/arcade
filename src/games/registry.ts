import type { GameDef } from '../types';

/**
 * Official registry of games. Add a new game by appending an entry here,
 * implementing a `render<Name>Game()` in `src/games/<id>/`, and wiring it
 * into `src/games/index.ts`'s GAME_RENDERERS map — pages (home, games grid)
 * render purely off this list.
 */
export const GAMES: GameDef[] = [
  {
    id: 'reaction',
    title: 'Reaction',
    category: 'REFLEKS',
    icon: '⚡',
    description: 'Fem runder. Ét job: slå lyset. Ren refleks, rent pres.',
    scoreKind: 'reaction_ms',
    implemented: true,
  },
  {
    id: 'aim',
    title: 'Aim Trainer',
    category: 'PRÆCISION',
    icon: '🎯',
    description: 'Ram så mange mål som muligt på 30 sekunder.',
    scoreKind: 'aim_hits',
    implemented: true,
  },
  {
    id: 'memory',
    title: 'Memory',
    category: 'FOKUS',
    icon: '🧠',
    description: 'Husk stadig længere sekvenser.',
    scoreKind: 'memory_level',
    implemented: true,
  },
  {
    id: 'numberrush',
    title: 'Number Rush',
    category: 'HOVEDREGNING',
    icon: '🔢',
    description: 'Løs så mange stykker som muligt før tiden løber ud.',
    scoreKind: 'numberrush_score',
    implemented: true,
  },
  {
    id: 'snake',
    title: 'Snake',
    category: 'KLASSIKER',
    icon: '🟩',
    description: 'Den der startede det hele. Pas på ikke at bide dig selv.',
    scoreKind: 'snake_score',
    implemented: true,
  },
  {
    id: 'tactical',
    title: 'Breach Protocol',
    category: 'ROGUELITE',
    icon: '🪖',
    description: 'Ryd rum, byg dit loadout, overlev bossen. Auto-sigte roguelite i taktisk stil.',
    scoreKind: 'tactical_rooms',
    implemented: true,
  },
  {
    id: 'color',
    title: 'Color Match',
    category: 'PERCEPTION',
    icon: '🎨',
    description: 'Match målfarven så præcist som muligt.',
    scoreKind: null,
    implemented: false,
  },
];
