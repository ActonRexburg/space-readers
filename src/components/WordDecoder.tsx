/**
 * Word Decoder Popup
 *
 * Shows a word broken into graphemes with a slider that highlights
 * each sound. Heart/sight words use this same silent slider — they also
 * keep the story pink-dot marker, the heart-word line, and Hear It.
 * The slider is silent — no phoneme clips, no letter names.
 * "Say Word" / "Hear It" play the whole-word story clip.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { DecodableWord } from '../types';
import { getAudioService } from '../services/audio';
import { Button } from './Button';
import { SpokenLine } from './SpeakButton';
import { useZibOverlayLock } from '../hooks/useZibOverlayLock';
import { UI } from '../data/voiceLines';
import { useIdleGlow } from '../hooks/useIdleGlow';

interface WordDecoderProps {
  word: DecodableWord;
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  onKeepTrying?: () => void;
}

export function WordDecoder({ word, isOpen, onClose, onComplete, onKeepTrying }: WordDecoderProps) {
  const [sliderValue, setSliderValue] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [missCount, setMissCount] = useState(0);
  const [hasTriggeredKeepTrying, setHasTriggeredKeepTrying] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  /** Finger hint: one across-and-back demo, then gone. Hidden immediately on drag. */
  const [showHint, setShowHint] = useState(true);
  const audioService = useRef(getAudioService());

  // Decoder is a full-screen overlay — never let a Zib popup sit on top of it.
  useZibOverlayLock(isOpen);
  // Heart-word Hear It is always the extra CTA. Regular Say Word waits for the slider.
  const idleGlow = useIdleGlow(isOpen && (word.isSightWord || isComplete));

  useEffect(() => {
    if (isOpen) {
      setSliderValue(0);
      setIsComplete(false);
      setHasStarted(false);
      setMissCount(0);
      setHasTriggeredKeepTrying(false);
      setIsClosing(false);
      setShowHint(true);
      audioService.current.stop();
    }
  }, [isOpen, word.word]);

  const COMPLETE_AT = 85;

  const handleSliderRelease = useCallback(() => {
    if (sliderValue >= COMPLETE_AT) {
      setSliderValue(100);
      setIsComplete(true);
      return;
    }

    if (hasStarted && !isComplete && sliderValue > 10 && sliderValue < COMPLETE_AT) {
      const newMissCount = missCount + 1;
      setMissCount(newMissCount);

      if (newMissCount >= 2 && !hasTriggeredKeepTrying && onKeepTrying) {
        setHasTriggeredKeepTrying(true);
        onKeepTrying();
      }
    }
  }, [hasStarted, isComplete, sliderValue, missCount, hasTriggeredKeepTrying, onKeepTrying]);

  const getActiveGraphemeIndex = useCallback((value: number): number => {
    const graphemeCount = word.graphemes.length;
    if (value === 0) return -1;
    if (value === 100) return graphemeCount;

    const segmentSize = 100 / graphemeCount;
    return Math.floor(value / segmentSize);
  }, [word.graphemes.length]);

  const activeIndex = getActiveGraphemeIndex(sliderValue);

  const dismissHint = useCallback(() => {
    setShowHint(false);
  }, []);

  const handleSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    setSliderValue(value);
    setHasStarted(true);
    setShowHint(false);
    // Visual highlight only — Brian found phoneme clips unhelpful / wrong,
    // and we never speak letter names. Say Word at the end plays the whole word.

    if (value >= COMPLETE_AT && !isComplete) {
      setIsComplete(true);
    }
  }, [isComplete]);

  const handleSliderInput = useCallback((e: React.FormEvent<HTMLInputElement>) => {
    const value = parseInt((e.target as HTMLInputElement).value, 10);
    if (value >= COMPLETE_AT && !isComplete) {
      setIsComplete(true);
    }
  }, [isComplete]);

  const handleComplete = useCallback(async () => {
    if (isClosing) return;
    setIsClosing(true);

    audioService.current.stop();
    await audioService.current.speakWord(word.word.replace(/[^a-zA-Z]/g, ''), { voice: 'story' });

    onComplete();
    onClose();
  }, [word.word, onComplete, onClose, isClosing]);

  const getGraphemeStyle = (index: number): string => {
    if (isComplete || (hasStarted && index < activeIndex)) {
      return 'grapheme-complete';
    }
    if (index === activeIndex) {
      return 'grapheme-active';
    }
    return 'grapheme-inactive';
  };

  const handleHearIt = useCallback(async () => {
    if (isClosing) return;
    setIsClosing(true);
    // Count as taught/practiced immediately — don't wait for audio,
    // or Hear It never lands in Zib's word list / practiced words.
    const spoken = word.word.replace(/[^a-zA-Z]/g, '');
    onComplete();
    audioService.current.stop();
    await audioService.current.speakWord(spoken, { voice: 'story' });
    onClose();
  }, [word.word, onComplete, onClose, isClosing]);

  if (!isOpen) return null;

  const isHeart = word.isSightWord;
  const graphemes = word.graphemes.length > 0
    ? word.graphemes
    : [{ text: word.word.replace(/[^a-zA-Z]/g, '') || word.word, phoneme: '' }];

  return (
    <div
      className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="decoder-popup p-6 max-w-lg w-full" data-testid="word-decoder">
        <SpokenLine
          text={UI.slideToSound}
          voice="control"
          className="justify-center mb-4"
          textClassName="text-xl text-white font-semibold"
        />

        {isHeart && (
          <div className="flex flex-col items-center gap-2 mb-4">
            <span className="text-3xl" aria-hidden="true">❤️</span>
            <SpokenLine
              text={UI.heartWord}
              voice="control"
              className="justify-center"
              textClassName="text-xl text-white leading-snug"
            />
          </div>
        )}

        <div className="flex justify-center flex-wrap gap-2 mb-8 min-h-[80px] items-center">
          {graphemes.map((grapheme, index) => (
            <span
              key={`${grapheme.text}-${index}`}
              className={`grapheme ${getGraphemeStyle(index)}`}
            >
              {grapheme.text}
            </span>
          ))}
        </div>

        <div className="relative mb-8 px-2">
          {showHint && (
            <div
              data-testid="slider-hand-hint"
              className="animate-slide-hand text-5xl z-10"
              aria-hidden="true"
              onAnimationEnd={(event) => {
                if (event.animationName === 'slide-hand' || event.animationName === 'hint-fade-out') {
                  setShowHint(false);
                }
              }}
            >
              👆
            </div>
          )}

          <input
            type="range"
            min="0"
            max="100"
            value={sliderValue}
            onChange={handleSliderChange}
            onInput={handleSliderInput}
            onPointerDown={dismissHint}
            onMouseUp={handleSliderRelease}
            onTouchEnd={handleSliderRelease}
            className="decoder-slider decoder-slider-large w-full h-12 cursor-grab active:cursor-grabbing"
            aria-label="Sound out slider"
            style={{ touchAction: 'none' }}
          />
        </div>

        <div className="flex justify-center gap-1 mb-6">
          {graphemes.map((_, index) => (
            <div
              key={index}
              className={`w-4 h-2 rounded-full transition-colors ${
                isComplete || (hasStarted && index < activeIndex)
                  ? 'bg-alien-green'
                  : index === activeIndex
                    ? 'bg-star-gold'
                    : 'bg-white/20'
              }`}
            />
          ))}
        </div>

        {isHeart && (
          <Button
            variant="success"
            onClick={handleHearIt}
            glow
            className={`w-full mb-3 text-xl ${idleGlow}`}
          >
            🔊 Hear It
          </Button>
        )}

        <div className="flex gap-3 items-center">
          <button
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] px-4 rounded-lg text-lg text-white/70 hover:bg-white/10"
            aria-label="Close"
          >
            ✕
          </button>

          <Button
            variant="success"
            onClick={handleComplete}
            disabled={!isComplete}
            glow={isComplete && !isHeart}
            className={`flex-1 py-4 text-xl ${isComplete && !isHeart ? idleGlow : ''}`}
          >
            🔊 Say Word
          </Button>
        </div>
      </div>
    </div>
  );
}
