/**
 * In-app confirmation dialog.
 *
 * Used instead of window.confirm, which Chromebook kiosk mode and some PWAs
 * suppress. Destructive actions (delete player, reset device) must go through
 * this modal so parents always get a Cancel / Delete choice they can tap.
 */

import { useEffect } from 'react';
import { OverlayPortal, OVERLAY_Z } from './OverlayPortal';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** When true, the confirm button is a prominent red destructive action. */
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  destructive = true,
  onConfirm,
  onCancel
}: ConfirmModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onCancel]);

  return (
    <OverlayPortal open={isOpen}>
      <div
        className={`fixed inset-0 ${OVERLAY_Z.nestedBackdrop} bg-black/80 backdrop-blur-sm`}
        data-overlay-backdrop="confirm"
        onClick={onCancel}
        aria-hidden="true"
      />
      <div
        className={`fixed inset-0 ${OVERLAY_Z.nestedDialog} flex items-center justify-center p-4`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        aria-describedby="confirm-modal-message"
        data-testid="confirm-modal"
        onClick={(e) => e.target === e.currentTarget && onCancel()}
      >
      <div className="space-card p-6 max-w-sm w-full border-red-500/30">
        <h2
          id="confirm-modal-title"
          className="text-2xl font-bold text-center mb-3 text-white"
        >
          {title}
        </h2>
        <p
          id="confirm-modal-message"
          className="text-center text-slate-300 text-lg mb-8"
        >
          {message}
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            autoFocus
            onClick={onCancel}
            className="flex-1 min-h-[48px] rounded-lg px-6 py-3 font-semibold
              bg-transparent border border-white/20 text-white/80
              hover:bg-white/10 hover:border-white/50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            data-testid="confirm-delete"
            onClick={onConfirm}
            className={
              destructive
                ? `flex-1 min-h-[48px] rounded-lg px-6 py-3 font-bold text-white
                   bg-red-600 hover:bg-red-500 border-2 border-red-400
                   shadow-[0_0_18px_rgba(239,68,68,0.45)]
                   active:bg-red-700`
                : `flex-1 min-h-[48px] rounded-lg px-6 py-3 font-semibold
                   bg-neon-cyan/20 border border-neon-cyan text-neon-cyan
                   hover:bg-neon-cyan/30`
            }
          >
            {confirmLabel}
          </button>
        </div>
      </div>
      </div>
    </OverlayPortal>
  );
}
