/**
 * Profile Creation/Edit Form
 *
 * Modal form for creating or editing a child profile.
 * For NEW profiles: only name + avatar (interests are picked in onboarding)
 * For EDITING profiles: name + avatar + interests
 */

import { useState, useEffect } from 'react';
import type { Profile } from '../types';
import { AVATARS, getAvatarById, INTEREST_OPTIONS } from '../data/avatars';
import { Button } from './Button';
import { SpokenLine } from './SpeakButton';
import { ConfirmModal } from './ConfirmModal';
import { OverlayPortal, OVERLAY_Z } from './OverlayPortal';
import { UI } from '../data/voiceLines';

interface ProfileFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, avatarId: string, interests: string[]) => void;
  onDelete?: () => void;
  editProfile?: Profile | null;
  title?: string;
}

export function ProfileForm({
  isOpen,
  onClose,
  onSave,
  onDelete,
  editProfile,
  title = 'Create Player'
}: ProfileFormProps) {
  const [name, setName] = useState('');
  const [avatarId, setAvatarId] = useState(AVATARS[0].id);
  const [interests, setInterests] = useState<string[]>([]);
  const [step, setStep] = useState<'name' | 'avatar' | 'interests'>('name');
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isEditing = !!editProfile;

  useEffect(() => {
    if (isOpen) {
      if (editProfile) {
        setName(editProfile.name);
        setAvatarId(editProfile.avatarId);
        setInterests(editProfile.interests);
        setStep('name');
      } else {
        setName('');
        setAvatarId(AVATARS[0].id);
        setInterests([]);
        setStep('name');
      }
      setError('');
      setConfirmDelete(false);
    }
  }, [isOpen, editProfile]);

  const handleNext = () => {
    if (step === 'name') {
      if (!name.trim()) {
        setError('Please enter a name');
        return;
      }
      if (name.length > 20) {
        setError('Name is too long (max 20 characters)');
        return;
      }
      setError('');
      setStep('avatar');
    } else if (step === 'avatar') {
      if (isEditing) {
        setStep('interests');
      } else {
        onSave(name.trim(), avatarId, []);
      }
    } else {
      onSave(name.trim(), avatarId, interests);
    }
  };

  const handleBack = () => {
    if (step === 'avatar') {
      setStep('name');
    } else if (step === 'interests') {
      setStep('avatar');
    }
  };

  const toggleInterest = (interestId: string) => {
    setInterests(prev =>
      prev.includes(interestId)
        ? prev.filter(i => i !== interestId)
        : [...prev, interestId]
    );
  };

  const selectedAvatar = getAvatarById(avatarId) || AVATARS[0];

  const primaryLabel = step === 'interests'
    ? (editProfile ? '💾 Save' : '🚀 Create')
    : step === 'avatar' && !isEditing
      ? '🚀 Create'
      : 'Next →';

  return (
    <OverlayPortal open={isOpen}>
      <div
        className={`fixed inset-0 ${OVERLAY_Z.nestedBackdrop} bg-black/80`}
        data-overlay-backdrop="profile-form"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={`fixed inset-0 ${OVERLAY_Z.nestedDialog} flex items-center justify-center p-4 overflow-y-auto`}
        data-testid="profile-form"
      >
      <div className="space-card p-6 max-w-md w-full my-4">
        <h2 className="text-2xl font-bold text-center mb-6">
          {editProfile ? 'Edit Player' : title}
        </h2>

        <div className="flex justify-center gap-2 mb-8">
          {(isEditing ? ['name', 'avatar', 'interests'] : ['name', 'avatar']).map((s, i) => {
            const steps = isEditing ? ['name', 'avatar', 'interests'] : ['name', 'avatar'];
            return (
              <div
                key={s}
                className={`w-3 h-3 rounded-full ${
                  s === step ? 'bg-star-gold' :
                  steps.indexOf(step) > i ? 'bg-alien-green' : 'bg-white/20'
                }`}
              />
            );
          })}
        </div>

        {step === 'name' && (
          <div className="space-y-4">
            <SpokenLine
              text={UI.typeYourName}
              voice="control"
              autoPlay
              className="justify-center"
              textClassName="text-xl text-white"
            />
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError('');
              }}
              placeholder="Name"
              className="w-full bg-white/10 border-2 border-white/20 rounded-lg p-5 text-2xl text-center
                focus:border-star-gold focus:outline-none"
              autoFocus
              maxLength={20}
              onKeyDown={(e) => e.key === 'Enter' && handleNext()}
              aria-label="Player name"
            />
            {error && (
              <p className="text-red-400 text-center text-lg">{error}</p>
            )}
          </div>
        )}

        {step === 'avatar' && (
          <div className="space-y-5">
            <SpokenLine
              text={UI.pickAPicture}
              voice="control"
              autoPlay
              className="justify-center"
              textClassName="text-xl text-white"
            />
            <div className="grid grid-cols-4 gap-3">
              {AVATARS.map((avatar) => (
                <button
                  key={avatar.id}
                  onClick={() => setAvatarId(avatar.id)}
                  className={`
                    w-full aspect-square rounded-xl flex items-center justify-center text-3xl
                    transition-all duration-200
                    ${avatar.id === avatarId
                      ? 'bg-star-gold/30 scale-110 glow-gold'
                      : 'bg-white/10 hover:bg-white/20'}
                  `}
                  style={{ borderColor: avatar.color, borderWidth: avatar.id === avatarId ? '3px' : '1px' }}
                  aria-label={avatar.name}
                >
                  {avatar.emoji}
                </button>
              ))}
            </div>
            <p className="text-center text-star-gold text-xl font-semibold">
              {selectedAvatar.emoji} {selectedAvatar.name}
            </p>
          </div>
        )}

        {step === 'interests' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {INTEREST_OPTIONS.map((interest) => (
                <button
                  key={interest.id}
                  onClick={() => toggleInterest(interest.id)}
                  className={`
                    p-3 rounded-lg text-left flex items-center gap-2
                    transition-all duration-200
                    ${interests.includes(interest.id)
                      ? 'bg-alien-green/30 border-alien-green border-2'
                      : 'bg-white/10 border-transparent border-2 hover:bg-white/20'}
                  `}
                >
                  <span className="text-2xl">{interest.emoji}</span>
                  <span className="text-lg">{interest.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3 mt-8">
          {step !== 'name' ? (
            <Button variant="ghost" onClick={handleBack} className="flex-1">
              Back
            </Button>
          ) : (
            <Button variant="ghost" onClick={onClose} className="flex-1">
              Cancel
            </Button>
          )}

          <Button
            variant="primary"
            onClick={handleNext}
            glow
            className="flex-1 pulse-idle"
          >
            {primaryLabel}
          </Button>
        </div>

        {editProfile && onDelete && (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="w-full mt-4 text-red-400 hover:text-red-300 text-lg min-h-[44px]"
          >
            Delete this player
          </button>
        )}
      </div>

      <ConfirmModal
        isOpen={confirmDelete}
        title={editProfile ? `Delete ${editProfile.name}?` : 'Delete player?'}
        message="This removes all their progress and can't be undone."
        confirmLabel="Delete"
        onConfirm={() => {
          setConfirmDelete(false);
          onDelete?.();
        }}
        onCancel={() => setConfirmDelete(false)}
      />
      </div>
    </OverlayPortal>
  );
}
