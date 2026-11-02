/**
 * InterestPicker Component
 * 
 * A kid-friendly grid of 50 interest tiles for AI book generation.
 * Features:
 * - Emoji icons (swappable for AI art later)
 * - Tapping speaks the label aloud
 * - Fuel gauge counter that fills to 10 minimum
 * - Launch button unlocks at 10+ selections
 */

import { useState, useCallback } from 'react';
import { INTEREST_OPTIONS, MIN_INTERESTS, type InterestOption } from '../data/interests';
import { getAudioService } from '../services/audio';
import { Button } from './Button';
import { Zib } from './Zib';

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

  const handleTileClick = useCallback((interest: InterestOption) => {
    // Speak the label
    audioService.speakWord(interest.label);

    // Toggle selection
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
    onComplete(Array.from(selectedInterests));
  }, [selectedInterests, onComplete]);

  const selectionCount = selectedInterests.size;
  const isReady = selectionCount >= MIN_INTERESTS;
  const gaugePercent = Math.min(100, (selectionCount / MIN_INTERESTS) * 100);

  return (
    <div className="min-h-screen flex flex-col bg-space-dark relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-space-dark via-space-deep to-space-purple" />
      
      {/* Header */}
      <header className="relative z-10 p-4 border-b border-cyan-500/20">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          {onBack && (
            <button 
              onClick={onBack}
              className="p-2 hover:bg-white/10 rounded-lg text-neon-cyan"
            >
              ← Back
            </button>
          )}
          <div className="flex-1 text-center">
            <h1 className="text-2xl font-bold text-glow-cyan">
              {isEditing ? '✏️ Edit Interests' : '🎯 Pick What You Love!'}
            </h1>
          </div>
          <div className="w-16" />
        </div>
      </header>

      {/* Zib helper */}
      <div className="relative z-10 px-4 py-3 bg-space-deep/50">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Zib expression="curious" size="sm" />
          <div className="flex-1 space-card p-3">
            <p className="text-sm text-cyan-200">
              {selectionCount === 0 
                ? "Help me learn what Earth kids love! Tap pictures to pick your favorites."
                : selectionCount < MIN_INTERESTS
                  ? `Great choices! Pick ${MIN_INTERESTS - selectionCount} more to fill up the fuel tank!`
                  : "Wow, so many cool things! Ready for liftoff when you are!"}
            </p>
          </div>
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 relative z-10 overflow-y-auto p-4">
        <div className="max-w-4xl mx-auto">
          {/* Interest grid */}
          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2 sm:gap-3">
            {INTEREST_OPTIONS.map((interest) => {
              const isSelected = selectedInterests.has(interest.id);
              return (
                <button
                  key={interest.id}
                  onClick={() => handleTileClick(interest)}
                  className={`
                    interest-tile
                    ${isSelected ? 'interest-tile-selected' : ''}
                    aspect-square
                  `}
                  aria-pressed={isSelected}
                  aria-label={`${interest.label}${isSelected ? ', selected' : ''}`}
                >
                  {/* Emoji icon */}
                  <span className="text-3xl sm:text-4xl" role="img" aria-hidden="true">
                    {interest.emoji}
                  </span>
                  {/* Label */}
                  <span className={`
                    text-xs font-medium text-center leading-tight
                    ${isSelected ? 'text-star-gold' : 'text-white/70'}
                  `}>
                    {interest.label}
                  </span>
                  {/* Selection indicator */}
                  {isSelected && (
                    <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-star-gold flex items-center justify-center">
                      <span className="text-xs text-space-dark">✓</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </main>

      {/* Bottom bar with fuel gauge and launch button */}
      <footer className="relative z-10 p-4 bg-space-deep/90 border-t border-cyan-500/20 safe-area-bottom">
        <div className="max-w-4xl mx-auto space-y-3">
          {/* Fuel gauge */}
          <div className="flex items-center gap-3">
            <span className="text-xl">🔥</span>
            <div className={`flex-1 fuel-gauge ${isReady ? 'fuel-gauge-ready' : ''}`}>
              <div 
                className="fuel-gauge-fill"
                style={{ width: `${gaugePercent}%` }}
              />
            </div>
            <span className={`
              font-bold text-lg min-w-[3rem] text-right
              ${isReady ? 'text-star-gold text-glow-gold' : 'text-white/60'}
            `}>
              {selectionCount}/{MIN_INTERESTS}
            </span>
          </div>

          {/* Helper text and launch button */}
          <div className="flex items-center justify-between gap-4">
            <p className={`text-sm ${isReady ? 'text-alien-green' : 'text-white/50'}`}>
              {isReady 
                ? '✨ Fuel tank full! Ready for launch!' 
                : `Pick at least ${MIN_INTERESTS} interests`}
            </p>
            <Button
              variant={isReady ? 'success' : 'secondary'}
              glow={isReady}
              disabled={!isReady && !isEditing}
              onClick={handleComplete}
              className={`
                ${isReady ? 'btn-neon-gold' : ''}
                min-w-[140px]
              `}
            >
              {isReady ? '🚀 Launch!' : `${MIN_INTERESTS - selectionCount} more`}
            </Button>
          </div>
        </div>
      </footer>
    </div>
  );
}
