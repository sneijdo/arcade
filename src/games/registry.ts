import type { GameDef } from '../types';

/**
 * Official registry of games. Add a new game by appending an entry here
 * (and, once implemented, wiring its route in router.ts) — pages
 * (home, games grid) render purely off this list.
 */
export const GAMES: GameDef[] = [
  {
    id: 'reaction',
    title: 'Reaction',
    category: 'REFLEX',
    icon: '⚡',
    description: 'Five rounds. One job: beat the light. Pure reflex, pure pressure.',
    scoreKind: 'reaction_ms',
    implemented: true,
  },
  {
    id: 'aim',
    title: 'Aim Trainer',
    category: 'PRECISION',
    icon: '🎯',
    description: 'Hit as many targets as you can in 30 seconds.',
    scoreKind: null,
    implemented: false,
  },
  {
    id: 'snake',
    title: 'Snake',
    category: 'CLASSIC',
    icon: '🟩',
    description: 'The one that started it all. Careful not to bite yourself.',
    scoreKind: null,
    implemented: false,
  },
  {
    id: 'memory',
    title: 'Memory',
    category: 'FOCUS',
    icon: '🧠',
    description: 'Remember increasingly long sequences.',
    scoreKind: null,
    implemented: false,
  },
  {
    id: 'numberrush',
    title: 'Number Rush',
    category: 'SPEED MATH',
    icon: '🔢',
    description: 'Solve as many sums as you can before time runs out.',
    scoreKind: null,
    implemented: false,
  },
  {
    id: 'color',
    title: 'Color Match',
    category: 'PERCEPTION',
    icon: '🎨',
    description: 'Match the target color as precisely as possible.',
    scoreKind: null,
    implemented: false,
  },
];
