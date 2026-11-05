/**
 * Mission Complete ship-energy sequence: 2s fill, optional upgrade beat.
 * One Mission Control line + one Zib line, each with 🔊. Soft chime.
 */

import { useEffect, useMemo, useState } from 'react';
import { Card } from './Card';
import { SpokenLine } from './SpeakButton';
import { ZibShip, type ShipMotionPhase } from './ZibShip';
import {
  SHIP_ENERGY_MAX,
  getShipPart,
  shipFillPlan,
  type ShipPartId
} from '../data/ship';
import { UI, ZIB } from '../data/voiceLines';
import { resolveAssetUrl } from '../utils/assets';

const FILL_MS = 2000;
const ENGINES_MS = 700;
const LIFTOFF_MS = 1400;

interface ShipRewardProps {
  fromEnergy: number;
  addedEnergy: number;
  partsBefore: readonly string[];
  partsAfter: readonly string[];
  starReward: number;
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function playSoftChime() {
  try {
    const audio = new Audio(resolveAssetUrl('audio/sfx/ship-chime.mp3'));
    audio.volume = 0.18;
    audio.preload = 'auto';
    void audio.play().catch(() => {
      // Optional — never block the reward if the file is missing or autoplay is blocked.
    });
  } catch {
    // ignore
  }
}

export function ShipReward({
  fromEnergy,
  addedEnergy,
  partsBefore,
  partsAfter,
  starReward
}: ShipRewardProps) {
  const plan = useMemo(
    () => shipFillPlan(fromEnergy, addedEnergy),
    [fromEnergy, addedEnergy]
  );
  const unlockedPart = useMemo(() => {
    if (!plan.willUpgrade) return null;
    return (partsAfter.find((id) => !partsBefore.includes(id)) as ShipPartId | undefined) ?? null;
  }, [plan.willUpgrade, partsAfter, partsBefore]);
  const partLabel = unlockedPart ? getShipPart(unlockedPart)?.label : undefined;

  const reduced = prefersReducedMotion();
  const [phase, setPhase] = useState<ShipMotionPhase>(
    reduced ? (plan.willUpgrade ? 'upgraded' : 'idle') : 'idle'
  );
  const [fill, setFill] = useState(reduced ? plan.leftover : plan.from);
  const [snapFill, setSnapFill] = useState(reduced);
  const [stars, setStars] = useState(reduced ? starReward : 0);

  useEffect(() => {
    const timers: number[] = [];
    let raf = 0;
    let cancelled = false;

    if (reduced || plan.added <= 0) {
      setSnapFill(true);
      setFill(plan.leftover);
      setStars(starReward);
      setPhase(plan.willUpgrade ? 'upgraded' : 'idle');
      return;
    }

    setFill(plan.from);
    setStars(0);
    timers.push(window.setTimeout(() => {
      setPhase('filling');
      setFill(plan.fillTo);
      playSoftChime();
    }, 80));

    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / FILL_MS);
      const eased = 1 - (1 - t) ** 3;
      setStars(Math.round(starReward * eased));
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      }
    };
    raf = requestAnimationFrame(tick);

    timers.push(window.setTimeout(() => {
      if (cancelled) return;
      if (!plan.willUpgrade) {
        setPhase('idle');
        setStars(starReward);
        return;
      }
      setPhase('full');
      timers.push(window.setTimeout(() => {
        if (cancelled) return;
        setPhase('liftoff');
        timers.push(window.setTimeout(() => {
          if (cancelled) return;
          setSnapFill(true);
          setPhase('upgraded');
          setFill(plan.leftover);
          setStars(starReward);
        }, LIFTOFF_MS));
      }, ENGINES_MS));
    }, FILL_MS + 120));

    return () => {
      cancelled = true;
      timers.forEach((id) => window.clearTimeout(id));
      cancelAnimationFrame(raf);
    };
  }, [plan, reduced, starReward]);

  const controlLine = phase === 'upgraded' || (reduced && plan.willUpgrade)
    ? UI.shipUpgraded
    : UI.shipEnergyRising;
  const showUpgrade = phase === 'upgraded' || (reduced && plan.willUpgrade);
  const parts = showUpgrade ? partsAfter : partsBefore;

  return (
    <Card className="text-center space-y-4">
      <div data-testid="ship-reward" className="space-y-4">
      <ZibShip
        energy={fill}
        parts={parts}
        phase={phase}
        size="lg"
        showParticles={phase === 'filling' && !reduced}
        snapFill={snapFill}
      />

      <div
        className="text-xl font-bold text-neon-cyan"
        data-testid="ship-energy-label"
      >
        {Math.round(Math.min(fill, SHIP_ENERGY_MAX))} / {SHIP_ENERGY_MAX}
      </div>

      <div
        className="text-2xl font-bold text-star-gold"
        data-testid="ship-stars-count"
      >
        ⭐ {stars}
      </div>

      <SpokenLine
        text={controlLine}
        voice="control"
        className="justify-center"
        textClassName="text-xl text-white font-semibold"
      />
      <SpokenLine
        text={ZIB.shipPower}
        voice="zib"
        className="justify-center"
        textClassName="text-xl text-cyan-100"
      />

      {showUpgrade && (
        <div
          className="rounded-lg border border-alien-green/40 bg-alien-green/10 px-4 py-3"
          data-testid="ship-upgrade-message"
        >
          <p className="text-2xl font-bold text-alien-green">Ship upgraded!</p>
          {partLabel && (
            <p className="text-lg text-white mt-1">{partLabel} unlocked.</p>
          )}
        </div>
      )}
      </div>
    </Card>
  );
}
