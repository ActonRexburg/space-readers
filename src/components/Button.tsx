/**
 * Touch-friendly Button Component (Tron Style)
 * 
 * Neon-styled buttons with glow effects.
 */

import { type ButtonHTMLAttributes, type ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  glow?: boolean;
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  glow = false,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const baseStyles = `
    touch-button inline-flex items-center justify-center gap-2 font-semibold
    transition-all duration-200
    disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none
  `;
  
  const variantStyles = {
    primary: `
      bg-gradient-to-r from-neon-cyan/20 to-neon-blue/20
      border border-neon-cyan text-neon-cyan
      hover:from-neon-cyan/30 hover:to-neon-blue/30
      hover:shadow-[0_0_20px_rgba(0,245,255,0.4)]
    `,
    secondary: `
      bg-white/5 border border-white/30 text-white/80
      hover:bg-white/10 hover:border-white/50
    `,
    success: `
      bg-gradient-to-r from-alien-green/20 to-emerald-600/20
      border border-alien-green text-alien-green
      hover:from-alien-green/30 hover:to-emerald-600/30
      hover:shadow-[0_0_20px_rgba(34,197,94,0.4)]
    `,
    danger: `
      bg-gradient-to-r from-red-500/20 to-rose-600/20
      border border-red-500 text-red-400
      hover:from-red-500/30 hover:to-rose-600/30
      hover:shadow-[0_0_20px_rgba(239,68,68,0.4)]
    `,
    ghost: `
      bg-transparent border border-white/20 text-white/70
      hover:bg-white/5 hover:border-neon-cyan/50 hover:text-neon-cyan
    `
  };
  
  const sizeStyles = {
    sm: 'text-sm py-2 px-4 min-h-[36px] rounded-md',
    md: 'text-base py-3 px-6 min-h-[48px] rounded-lg',
    lg: 'text-lg py-4 px-8 min-h-[56px] rounded-xl'
  };
  
  const glowStyle = glow 
    ? 'shadow-[0_0_15px_rgba(251,191,36,0.5)] border-star-gold text-star-gold bg-gradient-to-r from-star-gold/20 to-fuel-orange/20 hover:shadow-[0_0_25px_rgba(251,191,36,0.6)]' 
    : '';

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${glowStyle} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
