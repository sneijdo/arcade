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
};
