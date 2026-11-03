/**
 * Zib - The Alien Character
 * 
 * A friendly alien who the player teaches to read.
 * Shows the actual Zib poster image from the clips.
 */

import { resolveAssetUrl } from '../utils/assets';

// Use the real Zib poster image
const ZIB_IMAGE = resolveAssetUrl('zib-clips/poster/zib_interest_picker_intro.jpg');

interface ZibProps {
  expression?: 'happy' | 'thinking' | 'excited' | 'curious' | 'learning';
  dialogue?: string;
  learnedWordsCount?: number;
  animate?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function Zib({
  dialogue,
  learnedWordsCount = 0,
  animate = true,
  size = 'md'
}: ZibProps) {
  const sizeClasses = {
    sm: 'w-16 h-16',
    md: 'w-24 h-24',
    lg: 'w-32 h-32'
  };

  return (
    <div className="flex flex-col items-center">
      {/* Zib's image */}
      <div 
        className={`
          ${sizeClasses[size]} rounded-full
          overflow-hidden relative
          ${animate ? 'float' : ''}
          border-3 border-alien-green
          glow-green
        `}
      >
        <img 
          src={ZIB_IMAGE} 
          alt="Zib the alien"
          className="w-full h-full object-cover"
        />
      </div>

      {/* Name tag */}
      <div className="mt-2 px-3 py-1 bg-white/10 rounded-full text-sm font-semibold">
        Zib
      </div>

      {/* Dialogue bubble */}
      {dialogue && (
        <div className="mt-3 relative max-w-xs">
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0 
            border-l-8 border-r-8 border-b-8 
            border-l-transparent border-r-transparent border-b-white/20" />
          <div className="bg-white/20 rounded-lg p-3 text-sm text-center">
            {dialogue}
          </div>
        </div>
      )}

      {/* Learned words counter */}
      {learnedWordsCount > 0 && (
        <div className="mt-2 flex items-center gap-1 text-sm text-alien-green">
          <span>📖</span>
          <span>{learnedWordsCount} words learned</span>
        </div>
      )}
    </div>
  );
}

// Simple inline Zib for UI elements
export function ZibIcon({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-block ${className}`}>
      👽
    </span>
  );
}
