import type { ScoreKind } from './types';

/** Reusable scoring abstraction — new games register a ScoreKind here rather than inventing their own rating logic. */
export const ScoreKinds: Record<string, ScoreKind> = {
  reaction_ms: {
    direction: 'asc', // lower is better
    unit: 'ms',
    format: (v) => `${Math.round(v)}`,
    rating: (v) => {
      if (v < 150) return { label: 'SINDSSYGT', color: 'var(--lime)' };
      if (v < 200) return { label: 'FREMRAGENDE', color: 'var(--violet)' };
      if (v < 250) return { label: 'GODT', color: 'var(--cyan)' };
      if (v < 300) return { label: 'OKAY', color: 'var(--text-dim)' };
      return { label: 'SKAL ØVES', color: 'var(--coral)' };
    },
  },
  aim_hits: {
    direction: 'desc', // higher is better
    unit: 'hits',
    format: (v) => `${Math.round(v)}`,
    rating: (v) => {
      if (v >= 25) return { label: 'SINDSSYGT', color: 'var(--lime)' };
      if (v >= 18) return { label: 'FREMRAGENDE', color: 'var(--violet)' };
      if (v >= 12) return { label: 'GODT', color: 'var(--cyan)' };
      if (v >= 6) return { label: 'OKAY', color: 'var(--text-dim)' };
      return { label: 'SKAL ØVES', color: 'var(--coral)' };
    },
  },
  memory_level: {
    direction: 'desc',
    unit: 'niveau',
    format: (v) => `${Math.round(v)}`,
    rating: (v) => {
      if (v >= 12) return { label: 'SINDSSYGT', color: 'var(--lime)' };
      if (v >= 9) return { label: 'FREMRAGENDE', color: 'var(--violet)' };
      if (v >= 6) return { label: 'GODT', color: 'var(--cyan)' };
      if (v >= 3) return { label: 'OKAY', color: 'var(--text-dim)' };
      return { label: 'SKAL ØVES', color: 'var(--coral)' };
    },
  },
  numberrush_score: {
    direction: 'desc',
    unit: 'point',
    format: (v) => `${Math.round(v)}`,
    rating: (v) => {
      if (v >= 25) return { label: 'SINDSSYGT', color: 'var(--lime)' };
      if (v >= 18) return { label: 'FREMRAGENDE', color: 'var(--violet)' };
      if (v >= 12) return { label: 'GODT', color: 'var(--cyan)' };
      if (v >= 6) return { label: 'OKAY', color: 'var(--text-dim)' };
      return { label: 'SKAL ØVES', color: 'var(--coral)' };
    },
  },
  snake_score: {
    direction: 'desc',
    unit: 'point',
    format: (v) => `${Math.round(v)}`,
    rating: (v) => {
      if (v >= 20) return { label: 'SINDSSYGT', color: 'var(--lime)' };
      if (v >= 14) return { label: 'FREMRAGENDE', color: 'var(--violet)' };
      if (v >= 8) return { label: 'GODT', color: 'var(--cyan)' };
      if (v >= 3) return { label: 'OKAY', color: 'var(--text-dim)' };
      return { label: 'SKAL ØVES', color: 'var(--coral)' };
    },
  },
  tactical_rooms: {
    direction: 'desc',
    unit: ' rum',
    format: (v) => `${Math.round(v)}`,
    rating: (v) => {
      if (v >= 7) return { label: 'SINDSSYGT', color: 'var(--lime)' };
      if (v >= 5) return { label: 'FREMRAGENDE', color: 'var(--violet)' };
      if (v >= 3) return { label: 'GODT', color: 'var(--cyan)' };
      if (v >= 1) return { label: 'OKAY', color: 'var(--text-dim)' };
      return { label: 'SKAL ØVES', color: 'var(--coral)' };
    },
  },
  stack_height: {
    direction: 'desc',
    unit: ' blokke',
    format: (v) => `${Math.round(v)}`,
    rating: (v) => {
      if (v >= 25) return { label: 'SINDSSYGT', color: 'var(--lime)' };
      if (v >= 18) return { label: 'FREMRAGENDE', color: 'var(--violet)' };
      if (v >= 12) return { label: 'GODT', color: 'var(--cyan)' };
      if (v >= 6) return { label: 'OKAY', color: 'var(--text-dim)' };
      return { label: 'SKAL ØVES', color: 'var(--coral)' };
    },
  },
  color_accuracy: {
    direction: 'desc',
    unit: '%',
    format: (v) => `${Math.round(v)}`,
    rating: (v) => {
      if (v >= 95) return { label: 'SINDSSYGT', color: 'var(--lime)' };
      if (v >= 85) return { label: 'FREMRAGENDE', color: 'var(--violet)' };
      if (v >= 70) return { label: 'GODT', color: 'var(--cyan)' };
      if (v >= 50) return { label: 'OKAY', color: 'var(--text-dim)' };
      return { label: 'SKAL ØVES', color: 'var(--coral)' };
    },
  },
  dash_distance: {
    direction: 'desc',
    unit: 'm',
    format: (v) => `${Math.round(v)}`,
    rating: (v) => {
      if (v >= 400) return { label: 'SINDSSYGT', color: 'var(--lime)' };
      if (v >= 200) return { label: 'FREMRAGENDE', color: 'var(--violet)' };
      if (v >= 100) return { label: 'GODT', color: 'var(--cyan)' };
      if (v >= 40) return { label: 'OKAY', color: 'var(--text-dim)' };
      return { label: 'SKAL ØVES', color: 'var(--coral)' };
    },
  },
  merge_tile: {
    direction: 'desc',
    unit: '',
    format: (v) => `${Math.round(v)}`,
    rating: (v) => {
      if (v >= 1024) return { label: 'SINDSSYGT', color: 'var(--lime)' };
      if (v >= 512) return { label: 'FREMRAGENDE', color: 'var(--violet)' };
      if (v >= 256) return { label: 'GODT', color: 'var(--cyan)' };
      if (v >= 128) return { label: 'OKAY', color: 'var(--text-dim)' };
      return { label: 'SKAL ØVES', color: 'var(--coral)' };
    },
  },
};
