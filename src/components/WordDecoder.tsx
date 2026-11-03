/**
 * Word Decoder Popup
 * 
 * The core reading feature. Shows a word broken into graphemes
 * with a slider that highlights each sound unit as the child drags.
 * Based on how reading.com does word decoding.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { DecodableWord } from '../types';
import { getAudioService } from '../services/audio';
import { Button } from './Button';

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
  const audioService = useRef(getAudioService());
  const lastSpokenIndex = useRef(-1);

  // Reset state when word changes
  useEffect(() => {
    if (isOpen) {
      setSliderValue(0);
      setIsComplete(false);
      setHasStarted(false);
      setMissCount(0);
      setHasTriggeredKeepTrying(false);
      lastSpokenIndex.current = -1;
    }
  }, [isOpen, word.word]);

  // Track incomplete slider attempts as "misses"
  // If user drags but doesn't complete, count as a miss
  const handleSliderRelease = useCallback(() => {
    if (hasStarted && !isComplete && sliderValue > 10 && sliderValue < 90) {
      const newMissCount = missCount + 1;
      setMissCount(newMissCount);
      
      // Trigger keep_trying after 2+ misses (once per word)
      if (newMissCount >= 2 && !hasTriggeredKeepTrying && onKeepTrying) {
        setHasTriggeredKeepTrying(true);
        onKeepTrying();
      }
    }
  }, [hasStarted, isComplete, sliderValue, missCount, hasTriggeredKeepTrying, onKeepTrying]);

  // Calculate which grapheme is currently highlighted based on slider position
  const getActiveGraphemeIndex = useCallback((value: number): number => {
    const graphemeCount = word.graphemes.length;
    if (value === 0) return -1;
    if (value === 100) return graphemeCount;
    
    // Divide slider into equal segments for each grapheme
    const segmentSize = 100 / graphemeCount;
    return Math.floor(value / segmentSize);
  }, [word.graphemes.length]);

  const activeIndex = getActiveGraphemeIndex(sliderValue);

  // Handle slider change
  const handleSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    setSliderValue(value);
    setHasStarted(true);

    const newActiveIndex = getActiveGraphemeIndex(value);
    
    // Speak the grapheme when we enter a new segment
    if (newActiveIndex !== lastSpokenIndex.current && newActiveIndex >= 0 && newActiveIndex < word.graphemes.length) {
      lastSpokenIndex.current = newActiveIndex;
      
      // Speak the phoneme
      audioService.current.speakPhoneme(word.graphemes[newActiveIndex]);
    }
    
    // Check if slider reached the end (lowered to 90 for easier touch completion)
    if (value >= 90 && !isComplete) {
      setIsComplete(true);
    }
  }, [getActiveGraphemeIndex, word.graphemes, isComplete]);

  // Handle touch/mouse input to mark complete when dragged to end
  const handleSliderInput = useCallback((e: React.FormEvent<HTMLInputElement>) => {
    const value = parseInt((e.target as HTMLInputElement).value, 10);
    if (value >= 90 && !isComplete) {
      setIsComplete(true);
    }
  }, [isComplete]);

  // Handle completion (checkmark press)
  const handleComplete = useCallback(async () => {
    // Stop any current speech
    audioService.current.stop();
    
    // Speak the whole word
    await audioService.current.speakWord(word.word.replace(/[^a-zA-Z]/g, ''));
    
    // Notify parent
    onComplete();
    onClose();
  }, [word.word, onComplete, onClose]);

  // Get grapheme style based on position relative to slider
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

  // Handle sight words differently
  if (word.isSightWord) {
    return (
      <div 
        className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <div className="decoder-popup p-6 max-w-md w-full">
          <h3 className="text-xl font-semibold text-center text-neon-cyan mb-4">
            Memory Word
          </h3>
          
          <div className="text-5xl font-bold text-center text-star-gold text-glow-gold mb-4 reading-text">
            {word.word}
          </div>
          
          <p className="text-center text-cyan-200/70 mb-6">
            This is a special word to remember by heart!
          </p>
          
          <div className="flex gap-3">
            <Button variant="ghost" onClick={onClose} className="flex-1">
              Close
            </Button>
            <Button 
              variant="success" 
              onClick={async () => {
                await audioService.current.speakWord(word.word);
                onComplete();
                onClose();
              }}
              glow
              className="flex-1"
            >
              Hear It 🔊
            </Button>
          </div>
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
        {/* Header */}
        <h3 className="text-xl font-semibold text-center text-neon-cyan text-glow-cyan mb-2">
          Sound It Out!
        </h3>
        <p className="text-center text-sm text-cyan-200/60 mb-4">
          Drag the slider to hear each sound
        </p>

        {/* Graphemes Display */}
        <div className="flex justify-center flex-wrap gap-2 mb-6 min-h-[80px] items-center">
          {word.graphemes.map((grapheme, index) => (
            <span
              key={`${grapheme.text}-${index}`}
              className={`grapheme ${getGraphemeStyle(index)}`}
            >
              {grapheme.text}
            </span>
          ))}
        </div>

        {/* Slider with animated hint */}
        <div className="relative mb-6 px-2">
          {/* Animated hand hint when not started */}
          {!hasStarted && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
              <div className="animate-bounce-x text-4xl">
                👆
              </div>
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
            aria-label="Sound out slider - drag to hear each sound"
            style={{ touchAction: 'none' }}
          />
          
          {/* Visual indicators */}
          <div className="flex justify-between px-2 mt-2 text-sm">
            <span className="text-neon-cyan">Start</span>
            <span className={`font-bold ${isComplete ? 'text-alien-green' : 'text-star-gold'}`}>
              {isComplete ? '✓ Done!' : '→ Drag all the way →'}
            </span>
            <span className="text-alien-green">End</span>
          </div>
        </div>

        {/* Progress indicator */}
        <div className="flex justify-center gap-1 mb-4">
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

        {/* Instructions or completion */}
        {!hasStarted && (
          <p className="text-center text-star-gold mb-4 text-lg">
            Drag the slider from start to end!
          </p>
        )}
        
        {hasStarted && !isComplete && (
          <p className="text-center text-fuel-orange mb-4">
            Keep going! Drag all the way to the right →
          </p>
        )}
        
        {isComplete && (
          <p className="text-center text-alien-green mb-4 text-lg font-semibold">
            ✨ Great job! Now tap the green button!
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <Button variant="ghost" onClick={onClose} className="flex-1 py-4">
            Close
          </Button>
          
          <Button 
            variant="success" 
            onClick={handleComplete}
            disabled={!isComplete}
            glow={isComplete}
            className="flex-1 py-4 text-lg"
          >
            {isComplete ? '🔊 Say the Word!' : 'Finish sliding first'}
          </Button>
        </div>

        {/* Hint for struggling readers */}
        <button 
          className="w-full mt-3 text-sm text-slate-400 hover:text-slate-300"
          onClick={async () => {
            await audioService.current.speakWord(word.word.replace(/[^a-zA-Z]/g, ''));
          }}
        >
          Need help? Hear the word 🔊
        </button>
      </div>
    </div>
  );
}
