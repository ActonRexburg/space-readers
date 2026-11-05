import type { Rank } from '../types';
import { RANK_THRESHOLDS } from '../types';

export const RANK_COLORS: Record<Rank, { stroke: string; fill: string; glow: string }> = {
  Recruit: { stroke: '#67e8f9', fill: '#164e63', glow: '#22d3ee' },
  Cadet: { stroke: '#00f5ff', fill: '#0e3d4a', glow: '#00f5ff' },
  Pilot: { stroke: '#22c55e', fill: '#052e16', glow: '#4ade80' },
  Commander: { stroke: '#fbbf24', fill: '#422006', glow: '#fbbf24' },
  Captain: { stroke: '#fb923c', fill: '#431407', glow: '#fdba74' },
  Admiral: { stroke: '#e879f9', fill: '#4a044e', glow: '#f0abfc' }
};

/** How full the current-rank bar is, 0–99, before it crosses into `toRank`. */
export function rankBarPercent(fuel: number, fromRank: Rank, toRank: Rank): number {
  const lo = RANK_THRESHOLDS[fromRank];
  const hi = RANK_THRESHOLDS[toRank];
  if (hi <= lo) return 100;
  const raw = ((fuel - lo) / (hi - lo)) * 100;
  return Math.max(0, Math.min(99, raw));
}
