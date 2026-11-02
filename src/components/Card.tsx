/**
 * Space Card Component (Tron Style)
 * 
 * Neon-bordered cards with grid pattern overlay.
 */

import { type ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  glow?: 'gold' | 'green' | 'cyan' | 'magenta' | 'none';
  padding?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'gold';
}

export function Card({
  children,
  className = '',
  onClick,
  glow = 'none',
  padding = 'md',
  variant = 'default'
}: CardProps) {
  const paddingStyles = {
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6'
  };

  const glowStyles = {
    gold: 'neon-border-gold',
    green: 'glow-green border-alien-green',
    cyan: 'glow-cyan border-neon-cyan',
    magenta: 'glow-magenta border-neon-magenta',
    none: ''
  };

  const variantStyles = {
    default: 'space-card',
    gold: 'space-card-gold'
  };

  const interactiveStyles = onClick
    ? 'cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all duration-200'
    : '';

  return (
    <div
      className={`${variantStyles[variant]} ${paddingStyles[padding]} ${glowStyles[glow]} ${interactiveStyles} ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
    >
      {children}
    </div>
  );
}
