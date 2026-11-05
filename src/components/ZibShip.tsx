/**
 * Illustrated ship for Zib — SVG, Tron neon, teal/green accents.
 * Unlocked parts stay on the hull. Motion is CSS transform/opacity only.
 */

import { useId } from 'react';
import type { ShipPartId } from '../data/ship';
import { SHIP_ENERGY_MAX } from '../data/ship';

export type ShipMotionPhase = 'idle' | 'filling' | 'full' | 'liftoff' | 'upgraded';

interface ZibShipProps {
  energy: number;
  parts: readonly string[];
  phase?: ShipMotionPhase;
  size?: 'sm' | 'lg';
  showParticles?: boolean;
  /** Snap the gauge with no 2s fill (used when the meter resets after upgrade). */
  snapFill?: boolean;
}

function hasPart(parts: readonly string[], id: ShipPartId): boolean {
  return parts.includes(id);
}

export function ZibShip({
  energy,
  parts,
  phase = 'idle',
  size = 'sm',
  showParticles = false,
  snapFill = false
}: ZibShipProps) {
  const uid = useId().replace(/:/g, '');
  const fill = Math.max(0, Math.min(SHIP_ENERGY_MAX, energy));
  const enginesOn = phase === 'full' || phase === 'liftoff' || phase === 'upgraded';
  const lift = phase === 'liftoff';
  const wide = size === 'lg';

  return (
    <div
      className={`zib-ship ${wide ? 'zib-ship-lg' : 'zib-ship-sm'} ${lift ? 'ship-liftoff' : ''} ${enginesOn ? 'ship-engines-on' : ''}`}
      data-testid="zib-ship"
      data-ship-phase={phase}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 280 170"
        className="zib-ship-svg"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id={`${uid}-hull`} x1="40" y1="20" x2="250" y2="150">
            <stop offset="0%" stopColor="#0b2a33" />
            <stop offset="45%" stopColor="#12363c" />
            <stop offset="100%" stopColor="#0a1c28" />
          </linearGradient>
          <linearGradient id={`${uid}-glass`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#9efce8" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#22c55e" stopOpacity="0.35" />
          </linearGradient>
          <linearGradient id={`${uid}-engine`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#22c55e" stopOpacity="0" />
            <stop offset="50%" stopColor="#00f5ff" />
            <stop offset="100%" stopColor="#bbffe3" />
          </linearGradient>
          <filter id={`${uid}-soft`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.2" />
          </filter>
        </defs>

        {hasPart(parts, 'warp-ring') && (
          <ellipse
            className="ship-part-warp"
            cx="148"
            cy="92"
            rx="108"
            ry="34"
            stroke="#00f5ff"
            strokeWidth="2.2"
            strokeDasharray="10 8"
            opacity="0.75"
          />
        )}

        {hasPart(parts, 'wings') && (
          <g className="ship-part-wings" stroke="#22c55e" strokeWidth="2" fill="#0d2f28">
            <path d="M78 96 L18 128 L86 108 Z" />
            <path d="M78 88 L18 52 L86 78 Z" />
            <path d="M78 96 L18 128 L86 108 Z" fill="#22c55e" fillOpacity="0.12" />
            <path d="M78 88 L18 52 L86 78 Z" fill="#22c55e" fillOpacity="0.12" />
          </g>
        )}

        {hasPart(parts, 'boosters') && (
          <g className="ship-part-boosters">
            <rect x="48" y="70" width="28" height="16" rx="4" fill="#0d2a30" stroke="#00f5ff" strokeWidth="1.8" />
            <rect x="48" y="98" width="28" height="16" rx="4" fill="#0d2a30" stroke="#00f5ff" strokeWidth="1.8" />
            <rect
              className="ship-engine-flare"
              x="18"
              y="72"
              width="30"
              height="12"
              rx="6"
              fill={`url(#${uid}-engine)`}
            />
            <rect
              className="ship-engine-flare"
              x="18"
              y="100"
              width="30"
              height="12"
              rx="6"
              fill={`url(#${uid}-engine)`}
            />
          </g>
        )}

        <path
          d="M72 92 L118 58 L210 68 L248 92 L210 116 L118 126 Z"
          fill={`url(#${uid}-hull)`}
          stroke="#00f5ff"
          strokeWidth="2.4"
        />
        <path
          d="M118 58 L210 68 L198 92 L118 92 Z"
          fill="#00f5ff"
          fillOpacity="0.08"
          stroke="#22c55e"
          strokeWidth="1.2"
        />
        <path d="M92 92 L248 92" stroke="#22c55e" strokeWidth="1.4" opacity="0.7" />

        <ellipse
          cx="168"
          cy="92"
          rx="18"
          ry="12"
          fill={`url(#${uid}-glass)`}
          stroke="#9efce8"
          strokeWidth="1.6"
        />

        {hasPart(parts, 'canopy') && (
          <g className="ship-part-canopy">
            <path
              d="M148 70 Q168 48 196 70 L186 82 Q168 64 154 82 Z"
              fill={`url(#${uid}-glass)`}
              stroke="#00f5ff"
              strokeWidth="1.8"
            />
          </g>
        )}

        {hasPart(parts, 'antenna') && (
          <g className="ship-part-antenna" stroke="#00f5ff" strokeWidth="1.8" fill="#22c55e">
            <path d="M186 62 L198 28" />
            <circle cx="200" cy="24" r="4.5" />
          </g>
        )}

        <circle cx="132" cy="92" r="3" fill="#22c55e" />
        <circle cx="222" cy="92" r="2.4" fill="#00f5ff" />
      </svg>

      <div className="ship-gauge" data-testid="ship-energy-gauge">
        <div className="ship-gauge-track">
          <div
            className={`ship-gauge-fill${snapFill ? ' ship-gauge-fill-snap' : ''}`}
            data-testid="ship-energy-fill"
            style={{ transform: `scaleX(${fill / SHIP_ENERGY_MAX})` }}
          />
          {showParticles && (
            <div className="ship-sparks" data-testid="ship-energy-sparks">
              {Array.from({ length: 6 }, (_, i) => (
                <span key={i} className="ship-spark" style={{ animationDelay: `${i * 0.22}s` }} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
