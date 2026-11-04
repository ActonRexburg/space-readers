/**
 * Shared player avatar. Illustrated webp, circle-cropped, with a static
 * neon ring in the avatar's color. Emoji shows only if the image errors.
 * No looping pulse — idle-glow stays on the screen's one primary CTA.
 */

import { useState } from 'react';
import type { Avatar } from '../types';

const SIZE_CLASS = {
  sm: 'w-12 h-12 text-2xl',
  md: 'w-16 h-16 text-3xl',
  lg: 'w-24 h-24 text-5xl',
  fill: 'w-full h-full text-3xl'
} as const;

interface AvatarImageProps {
  avatar: Avatar;
  size?: keyof typeof SIZE_CLASS;
  className?: string;
  /** Thicker ring for the selected tile in the avatar chooser. */
  selected?: boolean;
  alt?: string;
}

export function AvatarImage({
  avatar,
  size = 'md',
  className = '',
  selected = false,
  alt
}: AvatarImageProps) {
  const [failed, setFailed] = useState(false);
  const ring = selected ? 3 : 2;

  return (
    <span
      className={`
        inline-flex items-center justify-center rounded-full overflow-hidden shrink-0
        ${SIZE_CLASS[size]} ${className}
      `}
      style={{
        backgroundColor: '#050510',
        border: `${ring}px solid ${avatar.color}`,
        boxShadow: selected
          ? `0 0 12px ${avatar.color}99, 0 0 4px ${avatar.color}`
          : `0 0 8px ${avatar.color}55`
      }}
      data-testid={`avatar-${avatar.id}`}
    >
      {failed || !avatar.image ? (
        <span aria-hidden="true">{avatar.emoji}</span>
      ) : (
        <img
          src={avatar.image}
          alt={alt ?? ''}
          className="w-full h-full object-cover"
          draggable={false}
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}
