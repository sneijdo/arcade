import { renderReactionGame } from './reaction/reaction';
import { renderAimGame } from './aim/aim';
import { renderMemoryGame } from './memory/memory';
import { renderNumberRushGame } from './numberrush/numberrush';
import { renderSnakeGame } from './snake/snake';
import { renderTacticalGame } from './tactical/tactical';
import { renderColorGame } from './color/color';
import { renderStackGame } from './stack/stack';
import { renderDashGame } from './dash/dash';
import { renderMergeGame } from './merge/merge';
import { renderOverclockGame } from './overclock/overclock';
import { renderGlitchGridGame } from './glitchgrid/glitchgrid';
import { renderPulseGame } from './pulse/pulse';
import { renderDropZoneGame } from './dropzone/dropzone';
import { renderRuleSwitchGame } from './ruleswitch/ruleswitch';
import { renderWordRushGame } from './wordrush/wordrush';
import { renderSwerveGame } from './swerve/swerve';
import { renderPairsGame } from './pairs/pairs';
import { renderOddOneOutGame } from './oddoneout/oddoneout';
import { renderTowerDefenseGame } from './towerdefense/towerdefense';

/** Maps a GAMES registry id to its render function. router.ts dispatches `play-<id>` routes through this. */
export const GAME_RENDERERS: Record<string, () => void> = {
  reaction: renderReactionGame,
  aim: renderAimGame,
  memory: renderMemoryGame,
  numberrush: renderNumberRushGame,
  snake: renderSnakeGame,
  tactical: renderTacticalGame,
  color: renderColorGame,
  stack: renderStackGame,
  dash: renderDashGame,
  merge: renderMergeGame,
  overclock: renderOverclockGame,
  glitchgrid: renderGlitchGridGame,
  pulse: renderPulseGame,
  dropzone: renderDropZoneGame,
  ruleswitch: renderRuleSwitchGame,
  wordrush: renderWordRushGame,
  swerve: renderSwerveGame,
  pairs: renderPairsGame,
  oddoneout: renderOddOneOutGame,
  towerdefense: renderTowerDefenseGame,
};
