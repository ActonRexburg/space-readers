/**
 * Hide Zib comm-link popups while a full-screen overlay (decoder, rank-up,
 * mission complete, intro video) is open so they never cover story text.
 */
import { useEffect } from 'react';
import { getZibClipService } from '../services/zibClips';

export function useZibOverlayLock(locked: boolean): void {
  useEffect(() => {
    if (!locked) return;
    const service = getZibClipService();
    service.lockOverlays();
    return () => service.unlockOverlays();
  }, [locked]);
}
