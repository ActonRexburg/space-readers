/**
 * Kid-sized read-aloud control.
 *
 * 44px+ speaker button. Tapping plays the app voice; tapping again stops.
 * Never used for graphemes — those stay on phoneme clips.
 */

import { useCallback, useEffect, useId, useState, type MouseEvent, type PointerEvent } from 'react';
import { getAudioService } from '../services/audio';

interface SpeakButtonProps {
  text: string;
  autoPlay?: boolean;
  onWord?: (charIndex: number) => void;
  onStart?: () => void;
  onEnd?: () => void;
  className?: string;
  label?: string;
}

let activePlayId: string | null = null;
const playListeners = new Set<() => void>();

function notifyPlay() {
  playListeners.forEach((fn) => fn());
}

export function SpeakButton({
  text,
  autoPlay = false,
  onWord,
  onStart,
  onEnd,
  className = '',
  label
}: SpeakButtonProps) {
  const id = useId();
  const [, setTick] = useState(0);
  const isPlaying = activePlayId === id;

  useEffect(() => {
    const listener = () => setTick((t) => t + 1);
    playListeners.add(listener);
    return () => {
      playListeners.delete(listener);
      if (activePlayId === id) {
        getAudioService().stop();
        activePlayId = null;
        notifyPlay();
      }
    };
  }, [id]);

  const play = useCallback(async () => {
    const trimmed = text.replace(/\s+/g, ' ').trim();
    if (!trimmed) return;

    const audio = getAudioService();
    audio.stop();
    activePlayId = id;
    notifyPlay();
    onStart?.();

    try {
      await audio.speakText(trimmed, {
        onWord: onWord
          ? (charIndex) => {
              if (activePlayId === id) onWord(charIndex);
            }
          : undefined
      });
    } catch {
      // Speech errors are non-fatal for kids UI
    } finally {
      if (activePlayId === id) {
        activePlayId = null;
        notifyPlay();
        onEnd?.();
      }
    }
  }, [id, text, onWord, onStart, onEnd]);

  const toggle = useCallback(
    (e: MouseEvent | PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (activePlayId === id) {
        getAudioService().stop();
        activePlayId = null;
        notifyPlay();
        onEnd?.();
        return;
      }
      void play();
    },
    [id, play, onEnd]
  );

  useEffect(() => {
    if (!autoPlay) return;
    void play();
    // Speak when the line first appears, not on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay, text]);

  return (
    <button
      type="button"
      onClick={toggle}
      className={`speak-btn ${isPlaying ? 'speak-btn-playing' : ''} ${className}`}
      aria-label={isPlaying ? 'Stop reading' : 'Read aloud'}
      title={isPlaying ? 'Stop' : 'Play'}
    >
      <span aria-hidden="true" className="text-2xl leading-none">
        {isPlaying ? '⏹' : '🔊'}
      </span>
      {label && <span className="text-lg font-semibold">{label}</span>}
    </button>
  );
}

interface SpokenLineProps {
  text: string;
  autoPlay?: boolean;
  className?: string;
  textClassName?: string;
}

export function SpokenLine({
  text,
  autoPlay = false,
  className = '',
  textClassName = 'text-lg leading-snug'
}: SpokenLineProps) {
  if (!text.trim()) return null;

  return (
    <div className={`flex items-start gap-2 ${className}`}>
      <SpeakButton text={text} autoPlay={autoPlay} className="shrink-0" />
      <p className={`flex-1 min-w-0 ${textClassName}`}>{text}</p>
    </div>
  );
}
