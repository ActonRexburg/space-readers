/**
 * Star-map mission path: dotted teal trail, planet nodes, and the
 * current-planet dock for the ship + Zib hero.
 */
import { useId, type ReactNode } from 'react';
import type { MissionMapNode } from '../data/missions';

interface StarMapProps {
  nodes: MissionMapNode[];
  docked: ReactNode;
  onOpenMission: (missionId: string) => void;
}

export function StarMap({ nodes, docked, onOpenMission }: StarMapProps) {
  const completed = nodes.filter((n) => n.status === 'completed');
  const current = nodes.find((n) => n.status === 'current');
  const upcoming = nodes.filter((n) => n.status === 'locked');

  return (
    <div className="star-map" data-testid="bridge-star-map">
      <svg
        className="star-map-path star-map-path-h"
        viewBox="0 0 1000 400"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="M 70 230 C 220 310, 360 150, 500 200 S 760 90, 940 150"
          fill="none"
          stroke="rgba(0,245,255,0.55)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="7 11"
        />
      </svg>
      <svg
        className="star-map-path star-map-path-v"
        viewBox="0 0 400 1000"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="M 200 70 C 150 250, 260 430, 200 520 S 140 780, 200 930"
          fill="none"
          stroke="rgba(0,245,255,0.55)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="7 11"
        />
      </svg>

      <div className="star-map-upcoming">
        {upcoming.map((node) => (
          <PlanetNode
            key={node.mission.id}
            node={node}
            onOpen={onOpenMission}
          />
        ))}
      </div>

      <div className="star-map-current">
        {current && (
          <div className="star-map-hero" data-testid="bridge-ship-card">
            <div className="hero-dock">{docked}</div>
            <div className="hero-planet">
              <PlanetGlyph planetId={current.mission.planetId} />
              {current.completed && <CheckMark />}
              {!current.playable && !current.completed && <LockMark />}
            </div>
          </div>
        )}
      </div>

      <div className="star-map-done">
        {completed.map((node) => (
          <PlanetNode
            key={node.mission.id}
            node={node}
            onOpen={onOpenMission}
          />
        ))}
      </div>
    </div>
  );
}

function PlanetNode({
  node,
  onOpen
}: {
  node: MissionMapNode;
  onOpen: (missionId: string) => void;
}) {
  const clickable = node.completed || node.playable;
  const label = node.completed
    ? `${node.mission.title}, complete`
    : node.playable
      ? node.mission.title
      : `${node.mission.title}, locked`;

  return (
    <button
      type="button"
      className={`planet-node planet-node-${node.status}`}
      data-testid={`planet-node-${node.mission.planetId}`}
      aria-label={label}
      disabled={!clickable}
      onClick={() => {
        if (clickable) onOpen(node.mission.id);
      }}
    >
      <PlanetGlyph planetId={node.mission.planetId} />
      {node.completed && <CheckMark />}
      {node.status === 'locked' && <LockMark />}
    </button>
  );
}

function CheckMark() {
  return (
    <span className="planet-check" aria-hidden="true">
      <svg viewBox="0 0 20 20" width="14" height="14">
        <path
          d="M4 10.5 L8 14.5 L16 6"
          fill="none"
          stroke="#052e16"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function LockMark() {
  return (
    <span className="planet-lock" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="16" height="16">
        <rect x="6" y="11" width="12" height="9" rx="2" fill="#94a3b8" />
        <path
          d="M8 11 V8 a4 4 0 0 1 8 0 v3"
          fill="none"
          stroke="#94a3b8"
          strokeWidth="2"
        />
      </svg>
    </span>
  );
}

function PlanetGlyph({ planetId }: { planetId: string }) {
  const uid = useId().replace(/:/g, '');
  if (planetId === 'moon') return <MoonPlanet uid={uid} />;
  if (planetId === 'mars') return <MarsPlanet uid={uid} />;
  return <EarthPlanet uid={uid} />;
}

function EarthPlanet({ uid }: { uid: string }) {
  return (
    <svg className="planet-glyph" viewBox="0 0 80 80" aria-hidden="true">
      <defs>
        <radialGradient id={`${uid}-ocean`} cx="32%" cy="28%">
          <stop offset="0%" stopColor="#7dd3fc" />
          <stop offset="55%" stopColor="#2563eb" />
          <stop offset="100%" stopColor="#0c4a6e" />
        </radialGradient>
        <radialGradient id={`${uid}-shade`} cx="30%" cy="30%">
          <stop offset="40%" stopColor="transparent" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.42)" />
        </radialGradient>
      </defs>
      <circle cx="40" cy="40" r="38" fill={`url(#${uid}-ocean)`} />
      <path
        fill="#22c55e"
        d="M14 28 C18 18 32 16 38 24 C44 20 50 24 52 30 C46 36 34 34 28 38 C20 42 14 38 14 28 Z"
      />
      <path
        fill="#4ade80"
        d="M44 36 C58 32 70 40 66 50 C58 56 48 50 42 46 C38 42 40 38 44 36 Z"
      />
      <path
        fill="#86efac"
        d="M22 48 C30 46 40 52 42 60 C34 66 22 62 18 56 C16 52 18 50 22 48 Z"
      />
      <circle cx="40" cy="40" r="38.6" fill="none" stroke="#7dd3fc" strokeWidth="1.4" opacity="0.45" />
      <circle cx="40" cy="40" r="38" fill={`url(#${uid}-shade)`} />
    </svg>
  );
}

function MoonPlanet({ uid }: { uid: string }) {
  return (
    <svg className="planet-glyph" viewBox="0 0 80 80" aria-hidden="true">
      <defs>
        <radialGradient id={`${uid}-rock`} cx="34%" cy="30%">
          <stop offset="0%" stopColor="#e2e8f0" />
          <stop offset="60%" stopColor="#94a3b8" />
          <stop offset="100%" stopColor="#475569" />
        </radialGradient>
        <radialGradient id={`${uid}-shade`} cx="30%" cy="30%">
          <stop offset="45%" stopColor="transparent" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.4)" />
        </radialGradient>
      </defs>
      <circle cx="40" cy="40" r="38" fill={`url(#${uid}-rock)`} />
      <circle cx="28" cy="30" r="7" fill="#64748b" opacity="0.45" />
      <circle cx="50" cy="26" r="4" fill="#64748b" opacity="0.4" />
      <circle cx="54" cy="48" r="9" fill="#475569" opacity="0.35" />
      <circle cx="32" cy="54" r="5" fill="#64748b" opacity="0.4" />
      <circle cx="40" cy="40" r="38" fill={`url(#${uid}-shade)`} />
    </svg>
  );
}

function MarsPlanet({ uid }: { uid: string }) {
  return (
    <svg className="planet-glyph" viewBox="0 0 80 80" aria-hidden="true">
      <defs>
        <radialGradient id={`${uid}-dust`} cx="34%" cy="28%">
          <stop offset="0%" stopColor="#fdba74" />
          <stop offset="50%" stopColor="#ea580c" />
          <stop offset="100%" stopColor="#7c2d12" />
        </radialGradient>
        <radialGradient id={`${uid}-shade`} cx="30%" cy="30%">
          <stop offset="40%" stopColor="transparent" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.4)" />
        </radialGradient>
      </defs>
      <circle cx="40" cy="40" r="38" fill={`url(#${uid}-dust)`} />
      <ellipse cx="30" cy="34" rx="10" ry="6" fill="#9a3412" opacity="0.35" />
      <ellipse cx="52" cy="50" rx="14" ry="7" fill="#7c2d12" opacity="0.3" />
      <circle cx="46" cy="28" r="4" fill="#fb923c" opacity="0.5" />
      <circle cx="40" cy="40" r="38" fill={`url(#${uid}-shade)`} />
    </svg>
  );
}
