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
  const isNew = !profile.hasCompletedInterests;

  return (
    <button
      onClick={onClick}
      data-testid={`profile-card-${profile.id}`}
      className={`
        profile-card flex flex-col items-center py-6
        ${isSelected ? 'profile-card-selected' : ''}
        ${isNew ? 'pulse-idle' : ''}
      `}
    >
      <div
        className="w-24 h-24 rounded-full flex items-center justify-center text-5xl mb-4 relative"
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

      <span className="text-xl font-semibold text-white truncate max-w-full">
        {profile.name}
      </span>
    </button>
  );
}

export function AddProfileCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="profile-card flex flex-col items-center justify-center min-h-[160px] border-dashed"
    >
      <div className="w-24 h-24 rounded-full flex items-center justify-center text-5xl mb-4 bg-neon-cyan/10 border border-neon-cyan/30">
        <span className="text-neon-cyan">+</span>
      </div>
      <span className="text-xl font-semibold text-neon-cyan/80">
        Add Player
      </span>
    </button>
  );
}
