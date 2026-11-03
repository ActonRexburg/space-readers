/**
 * Word Decoder Popup
 *
 * Shows a word broken into graphemes with a slider that highlights
 * each sound. Instruction copy is visual (hand hint + glowing button).
 * Phonemes play from clips — never letter names.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { DecodableWord } from '../types';
import { getAudioService } from '../services/audio';
import { Button } from './Button';
import { SpeakButton, SpokenLine } from './SpeakButton';
import { useZibOverlayLock } from '../hooks/useZibOverlayLock';
import { UI } from '../data/voiceLines';

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
  const audioService = useRef(getAudioService());
  const lastSpokenIndex = useRef(-1);

  // Decoder is a full-screen overlay — never let a Zib popup sit on top of it.
  useZibOverlayLock(isOpen);

  useEffect(() => {
    if (isOpen) {
      setSliderValue(0);
      setIsComplete(false);
      setHasStarted(false);
      setMissCount(0);
      setHasTriggeredKeepTrying(false);
      setIsClosing(false);
      lastSpokenIndex.current = -1;
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

  const handleSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    setSliderValue(value);
    setHasStarted(true);

    const newActiveIndex = getActiveGraphemeIndex(value);

    if (newActiveIndex !== lastSpokenIndex.current && newActiveIndex >= 0 && newActiveIndex < word.graphemes.length) {
      lastSpokenIndex.current = newActiveIndex;
      audioService.current.speakPhoneme(word.graphemes[newActiveIndex]);
    }

    if (value >= COMPLETE_AT && !isComplete) {
      setIsComplete(true);
    }
  }, [getActiveGraphemeIndex, word.graphemes, isComplete]);

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

  if (!isOpen) return null;

  const cleanWord = word.word.replace(/[^a-zA-Z]/g, '');

  if (word.isSightWord) {
    return (
      <div
        className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <div className="decoder-popup p-8 max-w-md w-full text-center space-y-6">
          <div className="flex items-center justify-center gap-3">
            <div className="text-5xl font-bold text-star-gold text-glow-gold reading-text">
              {word.word}
            </div>
            <SpeakButton text={cleanWord} voice="story" />
          </div>

          <Button
            variant="success"
            onClick={async () => {
              await audioService.current.speakWord(cleanWord, { voice: 'story' });
              onComplete();
              onClose();
            }}
            glow
            className="w-full pulse-action text-xl"
          >
            🔊 Hear It
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="decoder-popup p-6 max-w-lg w-full">
        <SpokenLine
          text={UI.slideToSound}
          voice="control"
          className="justify-center mb-4"
          textClassName="text-xl text-white font-semibold"
        />

        <div className="flex justify-center flex-wrap gap-2 mb-8 min-h-[80px] items-center">
          {word.graphemes.map((grapheme, index) => (
            <span
              key={`${grapheme.text}-${index}`}
              className={`grapheme ${getGraphemeStyle(index)}`}
            >
              {grapheme.text}
            </span>
          ))}
        </div>

        <div className="relative mb-8 px-2">
          {!hasStarted && (
            <div className="animate-slide-hand text-5xl z-10" aria-hidden="true">
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
            onMouseUp={handleSliderRelease}
            onTouchEnd={handleSliderRelease}
            className="decoder-slider decoder-slider-large w-full h-12 cursor-grab active:cursor-grabbing"
            aria-label="Sound out slider"
            style={{ touchAction: 'none' }}
          />
        </div>

        <div className="flex justify-center gap-1 mb-6">
          {word.graphemes.map((_, index) => (
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
            glow={isComplete}
            className={`flex-1 py-4 text-xl ${isComplete ? 'pulse-action' : ''}`}
          >
            🔊 Say Word
          </Button>
        </div>
      </div>
    </div>
  );
}
