import type { ScoreKind } from './types';

/** Reusable scoring abstraction — new games register a ScoreKind here rather than inventing their own rating logic. */
export const ScoreKinds: Record<string, ScoreKind> = {
  reaction_ms: {
    direction: 'asc', // lower is better
    unit: 'ms',
    format: (v) => `${Math.round(v)}`,
    rating: (v) => {
      if (v < 150) return { label: 'INSANE', color: 'var(--lime)' };
      if (v < 200) return { label: 'EXCELLENT', color: 'var(--violet)' };
      if (v < 250) return { label: 'GOOD', color: 'var(--cyan)' };
      if (v < 300) return { label: 'AVERAGE', color: 'var(--text-dim)' };
      return { label: 'NEEDS WORK', color: 'var(--coral)' };
    },
  },
};
