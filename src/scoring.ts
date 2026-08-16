import type { ScoreKind } from './types';

/** The space (or lack of one) between a formatted score and its unit, e.g. "800 point" vs "95%"
 * vs a bare "256" for merge's unitless tile value. Centralized so every call site gets this right
 * instead of each one guessing — several previously hardcoded a space that was wrong for '%' and
 * '' units, and a couple of ScoreKinds compensated with an inconsistent leading space baked into
 * `unit` itself. */
export function scoreUnitSuffix(kind: ScoreKind): string {
  const u = kind.unit.trim();
  if (!u || u === '%') return u;
  return ' ' + u;
}

/** The one place a score + its unit should be formatted for display — use this instead of
 * hand-concatenating `kind.format(v)` and `kind.unit`. */
export function formatScore(kind: ScoreKind, value: number): string {
  return kind.format(value) + scoreUnitSuffix(kind);
}

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
    unit: 'rum',
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
    unit: 'blokke',
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
  overclock_score: {
    direction: 'desc',
    unit: 'point',
    format: (v) => `${Math.round(v)}`,
    rating: (v) => {
      if (v >= 2500) return { label: 'SINDSSYGT', color: 'var(--lime)' };
      if (v >= 1800) return { label: 'FREMRAGENDE', color: 'var(--violet)' };
      if (v >= 1200) return { label: 'GODT', color: 'var(--cyan)' };
      if (v >= 700) return { label: 'OKAY', color: 'var(--text-dim)' };
      return { label: 'SKAL ØVES', color: 'var(--coral)' };
    },
  },
  glitchgrid_score: {
    direction: 'desc',
    unit: 'point',
    format: (v) => `${Math.round(v)}`,
    rating: (v) => {
      if (v >= 90) return { label: 'SINDSSYGT', color: 'var(--lime)' };
      if (v >= 60) return { label: 'FREMRAGENDE', color: 'var(--violet)' };
      if (v >= 35) return { label: 'GODT', color: 'var(--cyan)' };
      if (v >= 15) return { label: 'OKAY', color: 'var(--text-dim)' };
      return { label: 'SKAL ØVES', color: 'var(--coral)' };
    },
  },
  pulse_score: {
    direction: 'desc',
    unit: 'point',
    format: (v) => `${Math.round(v)}`,
    rating: (v) => {
      if (v >= 15000) return { label: 'SINDSSYGT', color: 'var(--lime)' };
      if (v >= 9000) return { label: 'FREMRAGENDE', color: 'var(--violet)' };
      if (v >= 5000) return { label: 'GODT', color: 'var(--cyan)' };
      if (v >= 2000) return { label: 'OKAY', color: 'var(--text-dim)' };
      return { label: 'SKAL ØVES', color: 'var(--coral)' };
    },
  },
  dropzone_score: {
    direction: 'desc',
    unit: 'point',
    format: (v) => `${Math.round(v)}`,
    rating: (v) => {
      if (v >= 3000) return { label: 'SINDSSYGT', color: 'var(--lime)' };
      if (v >= 1500) return { label: 'FREMRAGENDE', color: 'var(--violet)' };
      if (v >= 800) return { label: 'GODT', color: 'var(--cyan)' };
      if (v >= 400) return { label: 'OKAY', color: 'var(--text-dim)' };
      return { label: 'SKAL ØVES', color: 'var(--coral)' };
    },
  },
  ruleswitch_score: {
    direction: 'desc',
    unit: 'point',
    format: (v) => `${Math.round(v)}`,
    rating: (v) => {
      if (v >= 24) return { label: 'SINDSSYGT', color: 'var(--lime)' };
      if (v >= 18) return { label: 'FREMRAGENDE', color: 'var(--violet)' };
      if (v >= 12) return { label: 'GODT', color: 'var(--cyan)' };
      if (v >= 6) return { label: 'OKAY', color: 'var(--text-dim)' };
      return { label: 'SKAL ØVES', color: 'var(--coral)' };
    },
  },
  wordrush_score: {
    direction: 'desc',
    unit: 'ord',
    format: (v) => `${Math.round(v)}`,
    rating: (v) => {
      if (v >= 22) return { label: 'SINDSSYGT', color: 'var(--lime)' };
      if (v >= 16) return { label: 'FREMRAGENDE', color: 'var(--violet)' };
      if (v >= 11) return { label: 'GODT', color: 'var(--cyan)' };
      if (v >= 6) return { label: 'OKAY', color: 'var(--text-dim)' };
      return { label: 'SKAL ØVES', color: 'var(--coral)' };
    },
  },
  swerve_time: {
    direction: 'desc', // stored as milliseconds survived; higher is better
    unit: 's',
    format: (v) => (v / 1000).toFixed(1),
    rating: (v) => {
      if (v >= 45000) return { label: 'SINDSSYGT', color: 'var(--lime)' };
      if (v >= 30000) return { label: 'FREMRAGENDE', color: 'var(--violet)' };
      if (v >= 18000) return { label: 'GODT', color: 'var(--cyan)' };
      if (v >= 8000) return { label: 'OKAY', color: 'var(--text-dim)' };
      return { label: 'SKAL ØVES', color: 'var(--coral)' };
    },
  },
  pairs_score: {
    direction: 'desc',
    unit: 'point',
    format: (v) => `${Math.round(v)}`,
    rating: (v) => {
      if (v >= 220) return { label: 'SINDSSYGT', color: 'var(--lime)' };
      if (v >= 160) return { label: 'FREMRAGENDE', color: 'var(--violet)' };
      if (v >= 110) return { label: 'GODT', color: 'var(--cyan)' };
      if (v >= 60) return { label: 'OKAY', color: 'var(--text-dim)' };
      return { label: 'SKAL ØVES', color: 'var(--coral)' };
    },
  },
  oddoneout_score: {
    direction: 'desc',
    unit: 'runder',
    format: (v) => `${Math.round(v)}`,
    rating: (v) => {
      if (v >= 16) return { label: 'SINDSSYGT', color: 'var(--lime)' };
      if (v >= 11) return { label: 'FREMRAGENDE', color: 'var(--violet)' };
      if (v >= 7) return { label: 'GODT', color: 'var(--cyan)' };
      if (v >= 3) return { label: 'OKAY', color: 'var(--text-dim)' };
      return { label: 'SKAL ØVES', color: 'var(--coral)' };
    },
  },
};
