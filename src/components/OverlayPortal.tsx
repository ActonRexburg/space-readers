/**
 * OverlayPortal
 *
 * Parent Zone used to live inside <header class="relative z-10">. That
 * header (and the Bridge header's backdrop-filter) creates a stacking
 * context. The player grid is a later sibling with the same z-10, so
 * real mouse/touch hits landed on player cards instead of the math
 * keypad / Manage / Delete — which is why Brian couldn't delete users.
 *
 * Always portal overlays to document.body so no ancestor transform,
 * filter, will-change, or z-index can trap them. Backdrop is z-[1000],
 * dialog is z-[1010] (nested overlays 1020/1030). While open, #root is
 * inert / aria-hidden / pointer-events:none and body scroll is locked.
 */

import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export const OVERLAY_Z = {
  baseBackdrop: 'z-[1000]',
  baseDialog: 'z-[1010]',
  nestedBackdrop: 'z-[1020]',
  nestedDialog: 'z-[1030]'
} as const;

let lockCount = 0;

function lockAppRoot(): void {
  lockCount += 1;
  if (lockCount !== 1) return;

  const root = document.getElementById('root');
  document.body.dataset.overlayLock = 'true';
  document.body.style.overflow = 'hidden';
  if (root) {
    root.setAttribute('aria-hidden', 'true');
    root.setAttribute('inert', '');
    (root as HTMLElement).inert = true;
    root.style.pointerEvents = 'none';
  }
}

function unlockAppRoot(): void {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount !== 0) return;

  const root = document.getElementById('root');
  delete document.body.dataset.overlayLock;
  document.body.style.overflow = '';
  if (root) {
    root.removeAttribute('aria-hidden');
    root.removeAttribute('inert');
    (root as HTMLElement).inert = false;
    root.style.pointerEvents = '';
  }
}

interface OverlayPortalProps {
  open: boolean;
  children: ReactNode;
}

export function OverlayPortal({ open, children }: OverlayPortalProps) {
  useEffect(() => {
    if (!open) return;
    lockAppRoot();
    return () => unlockAppRoot();
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(children, document.body);
}
