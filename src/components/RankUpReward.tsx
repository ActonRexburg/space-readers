/**
 * Rank-up sequence: 2s bar fill, then a calm badge flip/reveal.
 * One Mission Control line + one Zib line, each with 🔊.
 */

import { useEffect, useState } from 'react';
import { Card } from './Card';
import { SpokenLine } from './SpeakButton';
import { RankBadge } from './RankBadge';
import type { Rank } from '../types';
import { rankBarPercent } from '../data/ranks';
import {
  promotionConfirmedLine,
  promotedToLine,
  zibPromotionLine
} from '../data/voiceLines';
import { resolveAssetUrl } from '../utils/assets';

const FILL_MS = 2000;
const FLIP_MS = 700;

type RankPhase = 'filling' | 'flip' | 'revealed';

interface RankUpRewardProps {
  fromRank: Rank;
  toRank: Rank;
  fuelBefore: number;
  fuelAfter: number;
  starsBefore: number;
  starsAfter: number;
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
    void audio.play().catch(() => {});
  } catch {
    // optional
  }
}

export function RankUpReward({
  fromRank,
  toRank,
  fuelBefore,
  fuelAfter,
  starsBefore,
  starsAfter
}: RankUpRewardProps) {
  const reduced = prefersReducedMotion();
  const fromPct = rankBarPercent(fuelBefore, fromRank, toRank);
  const [phase, setPhase] = useState<RankPhase>(reduced ? 'revealed' : 'filling');
  const [fill, setFill] = useState(reduced ? 100 : fromPct);
  const [fuel, setFuel] = useState(reduced ? fuelAfter : fuelBefore);
  const [stars, setStars] = useState(reduced ? starsAfter : starsBefore);
  const [snapFill, setSnapFill] = useState(reduced);

  useEffect(() => {
    if (reduced) {
      setPhase('revealed');
      setFill(100);
      setFuel(fuelAfter);
      setStars(starsAfter);
      return;
    }

    const timers: number[] = [];
    let raf = 0;
    let cancelled = false;

    setSnapFill(false);
    setFill(fromPct);
    setFuel(fuelBefore);
    setStars(starsBefore);
    timers.push(window.setTimeout(() => {
      setFill(100);
      playSoftChime();
    }, 80));

    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / FILL_MS);
      const eased = 1 - (1 - t) ** 3;
      setFuel(Math.round(fuelBefore + (fuelAfter - fuelBefore) * eased));
      setStars(Math.round(starsBefore + (starsAfter - starsBefore) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    timers.push(window.setTimeout(() => {
      if (cancelled) return;
      setPhase('flip');
      timers.push(window.setTimeout(() => {
        if (cancelled) return;
        setSnapFill(true);
        setPhase('revealed');
        setFuel(fuelAfter);
        setStars(starsAfter);
      }, FLIP_MS));
    }, FILL_MS + 160));

    return () => {
      cancelled = true;
      timers.forEach((id) => window.clearTimeout(id));
      cancelAnimationFrame(raf);
    };
  }, [fromPct, fuelBefore, fuelAfter, starsBefore, starsAfter, reduced]);

  const revealed = phase === 'revealed';
  const flipping = phase === 'flip';

  return (
    <div data-testid="rank-up-reward" className="space-y-6 text-center">
      <div className="rank-bar" data-testid="rank-progress-bar">
        <div className="rank-bar-track">
          <div
            className={`rank-bar-fill${snapFill ? ' rank-bar-fill-snap' : ''}`}
            data-testid="rank-progress-fill"
            style={{ transform: `scaleX(${fill / 100})` }}
          />
          {phase === 'filling' && !reduced && (
            <div className="ship-sparks" data-testid="rank-progress-sparks">
              {Array.from({ length: 6 }, (_, i) => (
                <span key={i} className="rank-spark" style={{ animationDelay: `${i * 0.22}s` }} />
              ))}
            </div>
          )}
        </div>
        <div className="mt-2 text-lg text-white/80">
          {fromRank} → {toRank}
        </div>
      </div>

      <div className="rank-badge-stage" data-testid="rank-badge-stage">
        {(flipping || revealed) && <div className="rank-warp-ring" aria-hidden="true" />}
        {revealed && <div className="rank-starburst" aria-hidden="true" />}
        <div
          className={`rank-badge-face rank-badge-from ${flipping || revealed ? 'rank-badge-out' : ''}`}
        >
          <RankBadge rank={fromRank} size="lg" />
        </div>
        <div
          className={`rank-badge-face rank-badge-to ${flipping || revealed ? 'rank-badge-in' : 'rank-badge-hidden'}`}
        >
          <RankBadge rank={toRank} size="lg" />
        </div>
      </div>

      {revealed && (
        <div data-testid="rank-promoted-message" className="space-y-3">
          <p className="text-3xl font-bold text-alien-green heading-text">
            {promotedToLine(toRank)}
          </p>
          <SpokenLine
            text={promotionConfirmedLine(toRank)}
            voice="control"
            autoPlay
            className="justify-center"
            textClassName="text-xl text-white font-semibold"
          />
          <SpokenLine
            text={zibPromotionLine(toRank)}
            voice="zib"
            className="justify-center"
            textClassName="text-xl text-cyan-100"
          />
        </div>
      )}

      <Card className="space-y-2">
        <div className="text-2xl font-bold text-fuel-orange" data-testid="rank-fuel-count">
          🔥 {fuel}
        </div>
        <div className="text-2xl font-bold text-star-gold" data-testid="rank-stars-count">
          ⭐ {stars}
        </div>
      </Card>
    </div>
  );
}
