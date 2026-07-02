import type { MoveLabel } from '../types';

// Evaluation score guide from blueprint §6.
export interface EvalBand {
  label: string;
  color: string; // hex, matches tailwind config
  min: number; // centipawns (inclusive lower bound), white POV
}

export const EVAL_BANDS: EvalBand[] = [
  { label: 'Winning', color: '#22c55e', min: 300 },
  { label: 'Advantage', color: '#86efac', min: 100 },
  { label: 'Slight Edge', color: '#60a5fa', min: 25 },
  { label: 'Equal', color: '#e5e7eb', min: -25 },
  { label: 'Slightly Worse', color: '#facc15', min: -100 },
  { label: 'Losing', color: '#fb923c', min: -300 },
  { label: 'Critical', color: '#ef4444', min: -Infinity },
];

/** Map a centipawn score (white POV) to a label + color band. */
export function bandForCp(cp: number): EvalBand {
  return EVAL_BANDS.find((b) => cp >= b.min) ?? EVAL_BANDS[EVAL_BANDS.length - 1];
}

/**
 * Assign a BEST/GOOD/EQUAL pill to a candidate move relative to the best line.
 * Thresholds mirror blueprint §4 move suggestion panel.
 */
export function labelForRank(rank: number, cpDiffFromBest: number): MoveLabel {
  if (rank === 1) return 'BEST';
  if (cpDiffFromBest <= 50) return 'GOOD';
  return 'EQUAL';
}

/** Convert centipawns to a clamped 0..1 fraction for the eval bar (white share). */
export function cpToBarFraction(cp: number): number {
  // Logistic curve: ~+/-600cp maps close to the extremes.
  const k = 0.0045;
  return 1 / (1 + Math.exp(-k * cp));
}

/** Format a centipawn value like "+1.8" or "M3". */
export function formatEval(cp: number, mate: number | null): string {
  if (mate !== null) return `M${Math.abs(mate)}`;
  const pawns = cp / 100;
  return (pawns >= 0 ? '+' : '') + pawns.toFixed(1);
}
