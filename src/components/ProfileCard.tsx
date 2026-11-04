/**
 * Profile Card Component (Tron Style)
 *
 * Displays a child profile with illustrated avatar for selection.
 */

import type { Profile } from '../types';
import { getAvatarById, DEFAULT_AVATAR } from '../data/avatars';
import { AvatarImage } from './AvatarImage';

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
      data-testid={`profile-card-${profile.id}`}
      className={`
        profile-card flex flex-col items-center py-6
        ${isSelected ? 'profile-card-selected' : ''}
      `}
    >
      <div className="mb-4">
        <AvatarImage avatar={avatar} size="lg" alt={profile.name} />
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
