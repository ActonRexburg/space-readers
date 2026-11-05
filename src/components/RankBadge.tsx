/**
 * Illustrated rank insignia — SVG, Tron neon, one mark per rank.
 */

import { useId } from 'react';
import type { Rank } from '../types';
import { RANK_COLORS } from '../data/ranks';

interface RankBadgeProps {
  rank: Rank;
  size?: 'sm' | 'lg';
  className?: string;
}

export function RankBadge({ rank, size = 'sm', className = '' }: RankBadgeProps) {
  const uid = useId().replace(/:/g, '');
  const colors = RANK_COLORS[rank];
  const px = size === 'lg' ? 132 : 44;

  return (
    <svg
      viewBox="0 0 80 80"
      width={px}
      height={px}
      className={`rank-badge-svg ${className}`}
      data-testid={`rank-badge-${rank}`}
      data-rank={rank}
      aria-hidden="true"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={`${uid}-g`} x1="10" y1="8" x2="70" y2="72">
          <stop offset="0%" stopColor={colors.fill} />
          <stop offset="100%" stopColor="#050510" />
        </linearGradient>
      </defs>
      <circle cx="40" cy="40" r="36" fill={`url(#${uid}-g)`} stroke={colors.stroke} strokeWidth="2.2" />
      <circle cx="40" cy="40" r="31" stroke={colors.glow} strokeWidth="0.8" opacity="0.45" />
      {rankMark(rank, colors.stroke, colors.glow)}
    </svg>
  );
}

function rankMark(rank: Rank, stroke: string, glow: string) {
  switch (rank) {
    case 'Recruit':
      return (
        <path
          d="M24 48 L40 28 L56 48"
          stroke={stroke}
          strokeWidth="4"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      );
    case 'Cadet':
      return (
        <g stroke={stroke} strokeWidth="3.6" strokeLinejoin="round" strokeLinecap="round" fill="none">
          <path d="M24 36 L40 20 L56 36" />
          <path d="M24 52 L40 36 L56 52" />
        </g>
      );
    case 'Pilot':
      return (
        <g>
          <path d="M14 42 L40 22 L66 42 L54 42 L40 32 L26 42 Z" fill={glow} fillOpacity="0.25" stroke={stroke} strokeWidth="2" />
          <circle cx="40" cy="48" r="6" fill={glow} stroke={stroke} strokeWidth="1.6" />
        </g>
      );
    case 'Commander':
      return (
        <g>
          <polygon
            points="40,18 48,34 66,36 52,48 56,64 40,55 24,64 28,48 14,36 32,34"
            fill={glow}
            fillOpacity="0.28"
            stroke={stroke}
            strokeWidth="2"
          />
        </g>
      );
    case 'Captain':
      return (
        <g stroke={stroke} fill={glow} fillOpacity="0.3">
          <rect x="18" y="36" width="44" height="8" rx="1.5" strokeWidth="1.8" />
          <polygon points="40,14 46,34 40,30 34,34" strokeWidth="2" />
          <polygon points="40,66 46,46 40,50 34,46" strokeWidth="2" />
        </g>
      );
    case 'Admiral':
      return (
        <g>
          <polygon
            points="40,14 44,32 62,24 50,40 68,48 48,48 52,66 40,54 28,66 32,48 12,48 30,40 18,24 36,32"
            fill={glow}
            fillOpacity="0.28"
            stroke={stroke}
            strokeWidth="1.8"
          />
          <circle cx="40" cy="40" r="7" fill="#050510" stroke={stroke} strokeWidth="2" />
        </g>
      );
  }
}
