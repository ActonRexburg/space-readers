/**
 * Space-themed card component
 */

import { type ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  glow?: 'gold' | 'green' | 'blue' | 'none';
  padding?: 'sm' | 'md' | 'lg';
}

export function Card({
  children,
  className = '',
  onClick,
  glow = 'none',
  padding = 'md'
}: CardProps) {
  const paddingStyles = {
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6'
  };

  const glowStyles = {
    gold: 'glow-gold',
    green: 'glow-green',
    blue: 'glow-blue',
    none: ''
  };

  const interactiveStyles = onClick
    ? 'cursor-pointer hover:scale-105 active:scale-95 transition-transform'
    : '';

  return (
    <div
      className={`space-card ${paddingStyles[padding]} ${glowStyles[glow]} ${interactiveStyles} ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
    >
      {children}
    </div>
  );
}
