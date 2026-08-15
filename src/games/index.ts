import { renderReactionGame } from './reaction/reaction';
import { renderAimGame } from './aim/aim';
import { renderMemoryGame } from './memory/memory';
import { renderNumberRushGame } from './numberrush/numberrush';
import { renderSnakeGame } from './snake/snake';

/** Maps a GAMES registry id to its render function. router.ts dispatches `play-<id>` routes through this. */
export const GAME_RENDERERS: Record<string, () => void> = {
  reaction: renderReactionGame,
  aim: renderAimGame,
  memory: renderMemoryGame,
  numberrush: renderNumberRushGame,
  snake: renderSnakeGame,
};
