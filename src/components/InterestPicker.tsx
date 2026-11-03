/**
 * InterestPicker Component
 *
 * A kid-friendly grid of interest tiles. Tapping speaks the label.
 * Fuel gauge fills to 10; Launch pulses when ready.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { INTEREST_OPTIONS, MIN_INTERESTS, type InterestOption } from '../data/interests';
import { getAudioService } from '../services/audio';
import { useZibClips } from './ZibClip';
import { Button } from './Button';
import { Zib } from './Zib';
import { SpeakButton } from './SpeakButton';

interface InterestPickerProps {
  initialInterests?: string[];
  onComplete: (interests: string[]) => void;
  onBack?: () => void;
  isEditing?: boolean;
}

export function InterestPicker({
  initialInterests = [],
  onComplete,
  onBack,
  isEditing = false
}: InterestPickerProps) {
  const [selectedInterests, setSelectedInterests] = useState<Set<string>>(
    new Set(initialInterests)
  );
  const audioService = getAudioService();
  const { triggerInterestPickerIntro, triggerInterestsDone } = useZibClips();
  const hasTriggeredIntro = useRef(false);

  useEffect(() => {
    if (!isEditing && !hasTriggeredIntro.current) {
      hasTriggeredIntro.current = true;
      setTimeout(() => {
        triggerInterestPickerIntro();
      }, 500);
    }
  }, [isEditing, triggerInterestPickerIntro]);

  const handleTileClick = useCallback((interest: InterestOption) => {
    audioService.speakWord(interest.label);

    setSelectedInterests(prev => {
      const newSet = new Set(prev);
      if (newSet.has(interest.id)) {
        newSet.delete(interest.id);
      } else {
        newSet.add(interest.id);
      }
      return newSet;
    });
  }, [audioService]);

  const handleComplete = useCallback(() => {
    const interests = Array.from(selectedInterests);

    const success = triggerInterestsDone({
      onComplete: () => {
        onComplete(interests);
      },
      onSkip: () => {
        onComplete(interests);
      }
    });

    if (!success) {
      onComplete(interests);
    }
  }, [selectedInterests, onComplete, triggerInterestsDone]);

  const selectionCount = selectedInterests.size;
  const isReady = selectionCount >= MIN_INTERESTS;
  const gaugePercent = Math.min(100, (selectionCount / MIN_INTERESTS) * 100);

  const zibLine = selectionCount === 0
    ? "Tap the pictures you love."
    : isReady
      ? "Fuel tank full. Tap Launch!"
      : `Pick ${MIN_INTERESTS - selectionCount} more.`;

  return (
    <div className="min-h-screen flex flex-col bg-space-dark relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-space-dark via-space-deep to-space-purple" />

      <header className="relative z-10 p-4 border-b border-cyan-500/20">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          {onBack ? (
            <button
              onClick={onBack}
              className="p-3 min-h-[44px] hover:bg-white/10 rounded-lg text-neon-cyan text-lg"
            >
              ← Back
            </button>
          ) : (
            <div className="w-16" />
          )}
          <h1 className="text-2xl font-bold text-glow-cyan text-center flex-1">
            {isEditing ? '✏️ Interests' : '🎯 Your Picks'}
          </h1>
          <div className="w-16" />
        </div>
      </header>

      <div className="relative z-10 px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-center gap-4">
          <Zib size="sm" />
          <SpeakButton text={zibLine} />
        </div>
      </div>

      <main className="flex-1 relative z-10 overflow-y-auto p-4 pb-36">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
            {INTEREST_OPTIONS.map((interest) => {
              const isSelected = selectedInterests.has(interest.id);
              return (
                <button
                  key={interest.id}
                  onClick={() => handleTileClick(interest)}
                  className={`
                    interest-tile aspect-square relative
                    ${isSelected
                      ? 'interest-tile-selected ring-2 ring-alien-green ring-offset-2 ring-offset-space-dark'
                      : ''}
                  `}
                  style={isSelected ? {
                    boxShadow: '0 0 20px rgba(76, 255, 153, 0.6), 0 0 40px rgba(76, 255, 153, 0.3)',
                    transform: 'scale(1.05)',
                  } : undefined}
                  aria-pressed={isSelected}
                  aria-label={`${interest.label}${isSelected ? ', selected' : ''}`}
                >
                  <span className="text-4xl sm:text-5xl" role="img" aria-hidden="true">
                    {interest.emoji}
                  </span>
                  <span className={`
                    kid-text font-medium text-center leading-tight
                    ${isSelected ? 'text-alien-green font-bold' : 'text-white'}
                  `}>
                    {interest.label}
                  </span>
                  {isSelected && (
                    <div
                      className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-alien-green flex items-center justify-center"
                      style={{ boxShadow: '0 0 10px rgba(76, 255, 153, 0.8)' }}
                    >
                      <span className="text-lg text-space-dark font-bold">✓</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 z-20 p-4 bg-space-deep/95 backdrop-blur-sm border-t border-cyan-500/20 safe-area-bottom">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <span className="text-2xl" aria-hidden="true">🔥</span>
          <div className={`flex-1 fuel-gauge ${isReady ? 'fuel-gauge-ready' : ''}`}>
            <div
              className="fuel-gauge-fill"
              style={{ width: `${gaugePercent}%` }}
            />
          </div>
          <span className={`
            font-bold text-xl min-w-[4rem] text-right
            ${isReady ? 'text-star-gold text-glow-gold' : 'text-white'}
          `}>
            {selectionCount}/{MIN_INTERESTS}
          </span>
          <Button
            variant={isReady ? 'success' : 'secondary'}
            glow={isReady}
            disabled={!isReady && !isEditing}
            onClick={handleComplete}
            className={`
              ${isReady ? 'btn-neon-gold pulse-action' : ''}
              min-w-[140px] text-xl
            `}
          >
            🚀 Launch
          </Button>
        </div>
      </footer>
    </div>
  );
}
