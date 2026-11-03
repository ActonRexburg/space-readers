/**
 * Zib - The Alien Character
 *
 * A friendly alien who the player teaches to read.
 * Shows the actual Zib poster image from the clips.
 */

import { resolveAssetUrl } from '../utils/assets';
import { SpeakButton } from './SpeakButton';

const ZIB_IMAGE = resolveAssetUrl('zib-clips/poster/zib_interest_picker_intro.jpg');

interface ZibProps {
  expression?: 'happy' | 'thinking' | 'excited' | 'curious' | 'learning';
  dialogue?: string;
  learnedWordsCount?: number;
  animate?: boolean;
  size?: 'sm' | 'md' | 'lg';
  autoSpeak?: boolean;
}

export function Zib({
  dialogue,
  size = 'md',
  autoSpeak = false
}: ZibProps) {
  // `animate` remains on ZibProps for callers; looping float was removed
  // so only the screen's primary CTA uses idle-glow.
  const sizeClasses = {
    sm: 'w-16 h-16',
    md: 'w-24 h-24',
    lg: 'w-32 h-32'
  };

  return (
    <div className="flex flex-col items-center">
      <div
        className={`
          ${sizeClasses[size]} rounded-full
          overflow-hidden relative
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

      {dialogue && (
        <div className="mt-3 relative max-w-xs flex items-start gap-2">
          <SpeakButton text={dialogue} autoPlay={autoSpeak} voice="zib" />
          <div className="bg-white/20 rounded-lg p-3 text-lg text-center flex-1">
            {dialogue}
          </div>
        </div>
      )}
    </div>
  );
}

export function ZibIcon({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-block ${className}`}>
      👽
    </span>
  );
}
