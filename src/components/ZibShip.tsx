/**
 * Illustrated ship for Zib — SVG, Tron neon, teal/green accents.
 * Unlocked parts stay on the hull. Motion is CSS transform/opacity only.
 *
 * Side layout is the Mission Complete reward. Upright layout is the Bridge
 * hero: nose-up rocket with the energy meter inside the hull.
 *
 * Both layouts share the same additive part set (SHIP_PARTS). Base
 * stabilizer fins are always on — later unlocks stack, they never replace
 * the fins. Unlocked parts are painted after the hull so they stay visible.
 */

import { useId } from 'react';
import type { ShipPartId } from '../data/ship';
import { SHIP_ENERGY_MAX } from '../data/ship';

export type ShipMotionPhase = 'idle' | 'filling' | 'full' | 'liftoff' | 'upgraded';

interface ZibShipProps {
  energy: number;
  parts: readonly string[];
  phase?: ShipMotionPhase;
  size?: 'sm' | 'lg' | 'hero';
  layout?: 'side' | 'upright';
  showParticles?: boolean;
  /** Snap the gauge with no 2s fill (used when the meter resets after upgrade). */
  snapFill?: boolean;
  className?: string;
}

function hasPart(parts: readonly string[], id: ShipPartId): boolean {
  return parts.includes(id);
}

export function ZibShip({
  energy,
  parts,
  phase = 'idle',
  size = 'sm',
  layout = 'side',
  showParticles = false,
  snapFill = false,
  className = ''
}: ZibShipProps) {
  const uid = useId().replace(/:/g, '');
  const fill = Math.max(0, Math.min(SHIP_ENERGY_MAX, energy));
  const enginesOn = phase === 'full' || phase === 'liftoff' || phase === 'upgraded';
  const lift = phase === 'liftoff';
  const upright = layout === 'upright';
  const sizeClass =
    size === 'hero' ? 'zib-ship-hero' : size === 'lg' ? 'zib-ship-lg' : 'zib-ship-sm';

  return (
    <div
      className={`zib-ship ${sizeClass} ${upright ? 'zib-ship-upright' : ''} ${lift ? 'ship-liftoff' : ''} ${enginesOn ? 'ship-engines-on' : ''} ${className}`}
      data-testid="zib-ship"
      data-ship-phase={phase}
      data-ship-layout={layout}
      data-ship-part-count={parts.length}
      aria-hidden="true"
    >
      {upright ? (
        <UprightShipSvg
          uid={uid}
          fill={fill}
          parts={parts}
          snapFill={snapFill}
        />
      ) : (
        <SideShipSvg uid={uid} parts={parts} />
      )}

      {!upright && (
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
      )}
    </div>
  );
}

function HullDefs({
  uid,
  upright
}: {
  uid: string;
  upright: boolean;
}) {
  if (upright) {
    return (
      <defs>
        <linearGradient id={`${uid}-uhull`} x1="70" y1="20" x2="140" y2="310">
          <stop offset="0%" stopColor="#1a4a55" />
          <stop offset="40%" stopColor="#0e2c34" />
          <stop offset="100%" stopColor="#07141c" />
        </linearGradient>
        <linearGradient id={`${uid}-uglass`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#9efce8" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#22c55e" stopOpacity="0.35" />
        </linearGradient>
        <linearGradient id={`${uid}-ugauge`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#00f5ff" />
          <stop offset="100%" stopColor="#4ade80" />
        </linearGradient>
        <linearGradient id={`${uid}-uengine`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#bbffe3" />
          <stop offset="50%" stopColor="#00f5ff" />
          <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
        </linearGradient>
      </defs>
    );
  }

  return (
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
    </defs>
  );
}

function SideShipSvg({ uid, parts }: { uid: string; parts: readonly string[] }) {
  return (
    <svg
      viewBox="0 0 280 170"
      className="zib-ship-svg"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <HullDefs uid={uid} upright={false} />

      {hasPart(parts, 'warp-ring') && (
        <ellipse
          className="ship-part-warp-ring"
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

      <g className="ship-part-base-fins" stroke="#00f5ff" strokeWidth="1.8" fill="#0a2830">
        <path d="M96 90 L46 52 L108 80 Z" />
        <path d="M96 94 L46 132 L108 104 Z" />
        <path d="M96 90 L46 52 L108 80 Z" fill="#22c55e" fillOpacity="0.12" />
        <path d="M96 94 L46 132 L108 104 Z" fill="#22c55e" fillOpacity="0.12" />
      </g>

      {hasPart(parts, 'boosters') && (
        <g className="ship-part-boosters">
          <rect x="36" y="68" width="30" height="16" rx="4" fill="#0d2a30" stroke="#00f5ff" strokeWidth="1.8" />
          <rect x="36" y="100" width="30" height="16" rx="4" fill="#0d2a30" stroke="#00f5ff" strokeWidth="1.8" />
          <rect
            className="ship-engine-flare"
            x="8"
            y="70"
            width="30"
            height="12"
            rx="6"
            fill={`url(#${uid}-engine)`}
          />
          <rect
            className="ship-engine-flare"
            x="8"
            y="102"
            width="30"
            height="12"
            rx="6"
            fill={`url(#${uid}-engine)`}
          />
        </g>
      )}

      {hasPart(parts, 'wings') && (
        <g className="ship-part-wings" stroke="#22c55e" strokeWidth="2" fill="#0d2f28">
          <path d="M86 98 L12 138 L94 112 Z" />
          <path d="M86 86 L12 46 L94 74 Z" />
          <path d="M86 98 L12 138 L94 112 Z" fill="#22c55e" fillOpacity="0.12" />
          <path d="M86 86 L12 46 L94 74 Z" fill="#22c55e" fillOpacity="0.12" />
        </g>
      )}

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
  );
}

function UprightShipSvg({
  uid,
  fill,
  parts,
  snapFill
}: {
  uid: string;
  fill: number;
  parts: readonly string[];
  snapFill: boolean;
}) {
  const ratio = fill / SHIP_ENERGY_MAX;

  return (
    <svg
      viewBox="0 0 200 340"
      className="zib-ship-svg"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <HullDefs uid={uid} upright />

      {hasPart(parts, 'warp-ring') && (
        <ellipse
          className="ship-part-warp-ring"
          cx="100"
          cy="175"
          rx="78"
          ry="118"
          stroke="#00f5ff"
          strokeWidth="2.2"
          strokeDasharray="10 8"
          opacity="0.7"
        />
      )}

      <path
        d="M100 28 L138 92 L138 248 Q100 278 62 248 L62 92 Z"
        fill={`url(#${uid}-uhull)`}
        stroke="#00f5ff"
        strokeWidth="2.6"
      />
      <path
        d="M100 28 L128 86 L72 86 Z"
        fill="#00f5ff"
        fillOpacity="0.12"
        stroke="#22c55e"
        strokeWidth="1.2"
      />
      <path d="M74 168 L126 168" stroke="#22c55e" strokeWidth="1.3" opacity="0.55" />
      <path d="M76 206 L124 206" stroke="#22c55e" strokeWidth="1.3" opacity="0.4" />

      <ellipse
        cx="100"
        cy="108"
        rx="16"
        ry="14"
        fill={`url(#${uid}-uglass)`}
        stroke="#9efce8"
        strokeWidth="1.7"
      />

      <g className="ship-hull-gauge" data-testid="ship-energy-gauge">
        <rect
          x="88"
          y="126"
          width="24"
          height="118"
          rx="8"
          fill="#041820"
          stroke="#00f5ff"
          strokeWidth="2"
        />
        {ratio > 0 && (
          <rect
            className={`ship-gauge-fill ship-gauge-fill-vert${snapFill ? ' ship-gauge-fill-snap' : ''}`}
            data-testid="ship-energy-fill"
            x="91"
            y={129 + 112 * (1 - ratio)}
            width="18"
            height={Math.max(6, 112 * ratio)}
            rx="6"
            fill={`url(#${uid}-ugauge)`}
          />
        )}
        {ratio <= 0 && (
          <rect
            data-testid="ship-energy-fill"
            x="91"
            y="241"
            width="18"
            height="0"
            rx="6"
            fill={`url(#${uid}-ugauge)`}
          />
        )}
      </g>

      <rect
        className="ship-engine-flare ship-engine-flare-down"
        x="86"
        y="270"
        width="28"
        height="32"
        rx="10"
        fill={`url(#${uid}-uengine)`}
      />

      <g className="ship-part-base-fins" stroke="#00f5ff" strokeWidth="2" fill="#0a2830">
        <path d="M64 204 L14 276 L70 244 Z" />
        <path d="M136 204 L186 276 L130 244 Z" />
        <path d="M64 204 L14 276 L70 244 Z" fill="#22c55e" fillOpacity="0.14" />
        <path d="M136 204 L186 276 L130 244 Z" fill="#22c55e" fillOpacity="0.14" />
      </g>

      {hasPart(parts, 'boosters') && (
        <g className="ship-part-boosters">
          <rect x="28" y="246" width="24" height="44" rx="6" fill="#0d2a30" stroke="#00f5ff" strokeWidth="1.8" />
          <rect x="148" y="246" width="24" height="44" rx="6" fill="#0d2a30" stroke="#00f5ff" strokeWidth="1.8" />
          <rect
            className="ship-engine-flare ship-engine-flare-down"
            x="32"
            y="288"
            width="16"
            height="28"
            rx="7"
            fill={`url(#${uid}-uengine)`}
          />
          <rect
            className="ship-engine-flare ship-engine-flare-down"
            x="152"
            y="288"
            width="16"
            height="28"
            rx="7"
            fill={`url(#${uid}-uengine)`}
          />
        </g>
      )}

      {hasPart(parts, 'wings') && (
        <g className="ship-part-wings" stroke="#22c55e" strokeWidth="2.2" fill="#0d2f28">
          <path d="M64 158 L4 228 L70 198 Z" />
          <path d="M136 158 L196 228 L130 198 Z" />
          <path d="M64 158 L4 228 L70 198 Z" fill="#22c55e" fillOpacity="0.16" />
          <path d="M136 158 L196 228 L130 198 Z" fill="#22c55e" fillOpacity="0.16" />
        </g>
      )}

      {hasPart(parts, 'canopy') && (
        <g className="ship-part-canopy">
          <path
            d="M78 86 Q100 58 122 86 L112 98 Q100 82 88 98 Z"
            fill={`url(#${uid}-uglass)`}
            stroke="#00f5ff"
            strokeWidth="1.8"
          />
        </g>
      )}

      {hasPart(parts, 'antenna') && (
        <g className="ship-part-antenna" stroke="#00f5ff" strokeWidth="1.8" fill="#22c55e">
          <path d="M100 28 L100 8" />
          <circle cx="100" cy="6" r="4.5" />
        </g>
      )}

      <circle cx="76" cy="152" r="3" fill="#22c55e" />
      <circle cx="124" cy="228" r="2.4" fill="#00f5ff" />
    </svg>
  );
}
