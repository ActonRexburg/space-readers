/**
 * Profile Card Component
 * 
 * Displays a child profile with avatar for selection.
 */

import type { Profile } from '../types';
import { getAvatarById, DEFAULT_AVATAR } from '../data/avatars';

interface ProfileCardProps {
  profile: Profile;
  onClick: () => void;
  isSelected?: boolean;
}

export function ProfileCard({ profile, onClick, isSelected }: ProfileCardProps) {
  const avatar = getAvatarById(profile.avatarId) || DEFAULT_AVATAR;

  return (
    <button
      onClick={onClick}
      className={`
        flex flex-col items-center p-4 rounded-2xl
        transition-all duration-200 touch-button
        ${isSelected 
          ? 'bg-star-gold/30 scale-105 glow-gold' 
          : 'bg-white/10 hover:bg-white/20 hover:scale-105'}
        active:scale-95
      `}
      style={{ 
        borderColor: avatar.color,
        borderWidth: '3px'
      }}
    >
      {/* Avatar */}
      <div 
        className="w-20 h-20 rounded-full flex items-center justify-center text-5xl mb-3"
        style={{ backgroundColor: `${avatar.color}30` }}
      >
        {avatar.emoji}
      </div>
      
      {/* Name */}
      <span className="text-lg font-semibold text-white truncate max-w-full">
        {profile.name}
      </span>
    </button>
  );
}

// Add Profile Card (the + button)
export function AddProfileCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`
        flex flex-col items-center justify-center p-4 rounded-2xl
        bg-white/5 border-2 border-dashed border-white/30
        hover:bg-white/10 hover:border-white/50
        transition-all duration-200 touch-button
        min-h-[140px]
      `}
    >
      <div className="w-20 h-20 rounded-full flex items-center justify-center text-4xl mb-3 bg-white/10">
        ➕
      </div>
      <span className="text-lg font-semibold text-white/70">
        Add Player
      </span>
    </button>
  );
}
