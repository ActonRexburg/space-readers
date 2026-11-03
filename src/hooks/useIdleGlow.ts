/**
 * Idle glow for the single primary CTA on a screen.
 *
 * After `--motion-idle-delay` (~4s) with no pointer/key/wheel activity, returns
 * the `idle-glow` class. Any interaction clears it and rearms the timer.
 * Box-shadow/opacity only (see index.css) — no scale or translate.
 * prefers-reduced-motion: never glow.
 *
 * Pass `enabled=false` when this screen has no primary next action yet
 * (e.g. decoder Say Word before the slider is complete).
 */
import { useEffect, useState } from 'react';

const FALLBACK_IDLE_DELAY_MS = 4000;

function readMotionIdleDelayMs(): number {
  if (typeof window === 'undefined') return FALLBACK_IDLE_DELAY_MS;
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue('--motion-idle-delay')
    .trim();
  if (!raw) return FALLBACK_IDLE_DELAY_MS;
  const ms = raw.endsWith('ms')
    ? parseFloat(raw)
    : raw.endsWith('s')
      ? parseFloat(raw) * 1000
      : parseFloat(raw);
  return Number.isFinite(ms) && ms > 0 ? ms : FALLBACK_IDLE_DELAY_MS;
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function useIdleGlow(enabled = true): string {
  const [glowing, setGlowing] = useState(false);
  const [prevEnabled, setPrevEnabled] = useState(enabled);

  // Reset when the CTA is no longer eligible (React "adjust state from props" pattern).
  if (prevEnabled !== enabled) {
    setPrevEnabled(enabled);
    if (!enabled) setGlowing(false);
  }

  useEffect(() => {
    if (!enabled || prefersReducedMotion()) {
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const delay = readMotionIdleDelayMs();

    const arm = (clearGlow: boolean) => {
      window.clearTimeout(timer);
      if (clearGlow) setGlowing(false);
      timer = setTimeout(() => {
        if (!cancelled && !prefersReducedMotion()) setGlowing(true);
      }, delay);
    };

    const onInteract = () => arm(true);

    arm(false);
    const opts: AddEventListenerOptions = { capture: true, passive: true };
    window.addEventListener('pointerdown', onInteract, opts);
    window.addEventListener('keydown', onInteract, opts);
    window.addEventListener('wheel', onInteract, opts);

    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onMotionChange = () => {
      if (mq.matches) {
        window.clearTimeout(timer);
        setGlowing(false);
      } else {
        arm(true);
      }
    };
    mq.addEventListener('change', onMotionChange);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.removeEventListener('pointerdown', onInteract, opts);
      window.removeEventListener('keydown', onInteract, opts);
      window.removeEventListener('wheel', onInteract, opts);
      mq.removeEventListener('change', onMotionChange);
    };
  }, [enabled]);

  return enabled && glowing ? 'idle-glow' : '';
}
