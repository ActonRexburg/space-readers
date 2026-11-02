/**
 * Profile Card Component (Tron Style)
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
        profile-card flex flex-col items-center
        ${isSelected ? 'profile-card-selected' : ''}
      `}
    >
      {/* Avatar with neon ring */}
      <div 
        className="w-20 h-20 rounded-full flex items-center justify-center text-5xl mb-3 relative"
        style={{ 
          backgroundColor: `${avatar.color}20`,
          boxShadow: `0 0 15px ${avatar.color}40, inset 0 0 10px ${avatar.color}20`
        }}
      >
        <div 
          className="absolute inset-0 rounded-full"
          style={{ 
            border: `2px solid ${avatar.color}`,
            boxShadow: `0 0 10px ${avatar.color}60`
          }}
        />
        <span className="relative z-10">{avatar.emoji}</span>
      </div>
      
      {/* Name */}
      <span className="text-lg font-semibold text-white truncate max-w-full">
        {profile.name}
      </span>
      
      {/* Status indicator */}
      {!profile.hasCompletedInterests && (
        <span className="text-xs text-star-gold mt-1">New!</span>
      )}
    </button>
  );
}

// Add Profile Card (the + button)
export function AddProfileCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="profile-card flex flex-col items-center justify-center min-h-[140px] border-dashed"
    >
      <div className="w-20 h-20 rounded-full flex items-center justify-center text-4xl mb-3 bg-neon-cyan/10 border border-neon-cyan/30">
        <span className="text-neon-cyan">+</span>
      </div>
      <span className="text-lg font-semibold text-neon-cyan/70">
        Add Player
      </span>
    </button>
  );
}
