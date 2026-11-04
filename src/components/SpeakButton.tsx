/**
 * Kid-sized read-aloud control.
 *
 * 44px+ speaker button. Tapping plays the app voice; tapping again stops.
 * HTMLAudioElement.play() must start in this click turn (no await fetch).
 * Do not create an AudioContext here — a live context ducks TTS + HTML
 * on Chrome/Windows. Pre-#8 🔊 was speechSynthesis only and had sound.
 *
 * Bind onClick only — pointerdown + click both firing would start then
 * immediately stop (toggle sees isPlaying). stopPropagation so a parent
 * does not call stop().
 */

import { useCallback, useEffect, useId, useState, type MouseEvent, type PointerEvent } from 'react';
import { getAudioService } from '../services/audio';
import type { VoiceKind } from '../utils/voice';

interface SpeakButtonProps {
  text: string;
  autoPlay?: boolean;
  onWord?: (charIndex: number) => void;
  onStart?: () => void;
  onEnd?: () => void;
  className?: string;
  label?: string;
  /** zib = BrianNeural bubbles; control = Andrew UI/briefing; story = Andrew read-aloud. */
  voice?: VoiceKind;
}

let activePlayId: string | null = null;
const playListeners = new Set<() => void>();
/** Track mounted SpeakButtons so Strict Mode remount does not stop() the clip we just started. */
const mountedSpeakIds = new Set<string>();

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
  label,
  voice = 'control'
}: SpeakButtonProps) {
  const id = useId();
  const [, setTick] = useState(0);
  const isPlaying = activePlayId === id;

  useEffect(() => {
    mountedSpeakIds.add(id);
    const listener = () => setTick((t) => t + 1);
    playListeners.add(listener);
    return () => {
      playListeners.delete(listener);
      mountedSpeakIds.delete(id);
      const playId = id;
      // Strict Mode unmounts then remounts in the same turn. A sync stop()
      // here cancelled TTS/HTML the autoPlay/click just started (Brian heard
      // nothing). Wait a macrotask: remount re-adds the same useId().
      window.setTimeout(() => {
        if (!mountedSpeakIds.has(playId) && activePlayId === playId) {
          getAudioService().stop();
          activePlayId = null;
          notifyPlay();
        }
      }, 0);
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
        voice,
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
  }, [id, text, voice, onWord, onStart, onEnd]);

  const toggle = useCallback(
    (e: MouseEvent | PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const audio = getAudioService();
      if (activePlayId === id) {
        audio.stop();
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
  voice?: VoiceKind;
}

export function SpokenLine({
  text,
  autoPlay = false,
  className = '',
  textClassName = 'text-lg leading-snug',
  voice = 'control'
}: SpokenLineProps) {
  if (!text.trim()) return null;

  // Speaker + text stay one centered inline group so the 🔊 never floats
  // off to the side of a stretched heading.
  return (
    <div className={`flex justify-center ${className}`}>
      <div className="inline-flex items-center gap-2 max-w-full">
        <SpeakButton text={text} autoPlay={autoPlay} voice={voice} className="shrink-0" />
        <p className={`min-w-0 ${textClassName}`}>{text}</p>
      </div>
    </div>
  );
}
