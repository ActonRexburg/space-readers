/**
 * Zib - The Alien Character
 * 
 * A friendly alien who the player teaches to read.
 * Shows expressions and learned words.
 */

import { useState, useEffect } from 'react';

interface ZibProps {
  expression?: 'happy' | 'thinking' | 'excited' | 'curious' | 'learning';
  dialogue?: string;
  learnedWordsCount?: number;
  animate?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function Zib({
  expression = 'happy',
  dialogue,
  learnedWordsCount = 0,
  animate = true,
  size = 'md'
}: ZibProps) {
  const [isBlinking, setIsBlinking] = useState(false);

  // Random blinking animation
  useEffect(() => {
    if (!animate) return;
    
    const blink = () => {
      setIsBlinking(true);
      setTimeout(() => setIsBlinking(false), 150);
    };

    const interval = setInterval(() => {
      if (Math.random() > 0.7) blink();
    }, 2000);

    return () => clearInterval(interval);
  }, [animate]);

  const sizeClasses = {
    sm: 'w-16 h-16 text-2xl',
    md: 'w-24 h-24 text-4xl',
    lg: 'w-32 h-32 text-6xl'
  };

  const bodyColor = 'bg-gradient-to-b from-alien-green/80 to-emerald-600/80';

  return (
    <div className="flex flex-col items-center">
      {/* Zib's body */}
      <div 
        className={`
          ${sizeClasses[size]} ${bodyColor} rounded-full
          flex items-center justify-center relative
          ${animate ? 'float' : ''}
          border-4 border-alien-green
          glow-green
        `}
      >
        {/* Eyes */}
        <div className="flex gap-2 absolute top-1/4">
          <div className={`
            w-3 h-4 bg-black rounded-full
            ${isBlinking ? 'scale-y-0' : 'scale-y-100'}
            transition-transform duration-100
          `}>
            <div className="w-1.5 h-1.5 bg-white rounded-full mt-0.5 ml-0.5" />
          </div>
          <div className={`
            w-3 h-4 bg-black rounded-full
            ${isBlinking ? 'scale-y-0' : 'scale-y-100'}
            transition-transform duration-100
          `}>
            <div className="w-1.5 h-1.5 bg-white rounded-full mt-0.5 ml-0.5" />
          </div>
        </div>

        {/* Antennae */}
        <div className="absolute -top-4 left-1/3">
          <div className="w-1 h-4 bg-alien-green rounded-full" />
          <div className="w-2 h-2 bg-star-gold rounded-full -mt-1 -ml-0.5 pulse-glow" />
        </div>
        <div className="absolute -top-3 right-1/3">
          <div className="w-1 h-3 bg-alien-green rounded-full" />
          <div className="w-2 h-2 bg-star-gold rounded-full -mt-1 -ml-0.5 pulse-glow" />
        </div>

        {/* Mouth based on expression */}
        <div className="absolute bottom-1/4 text-lg">
          {expression === 'happy' && '⌣'}
          {expression === 'thinking' && '○'}
          {expression === 'excited' && '◡'}
          {expression === 'curious' && '?'}
          {expression === 'learning' && '•'}
        </div>
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
