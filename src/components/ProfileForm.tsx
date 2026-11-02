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

  // For new profiles, skip interests step (they'll pick in onboarding's InterestPicker)
  const isEditing = !!editProfile;

  // Reset form when opening/closing or when edit profile changes
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
        setInterests([]); // Always start with empty interests for new profiles
        setStep('name');
      }
      setError('');
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
        // Editing: go to interests step
        setStep('interests');
      } else {
        // New profile: skip interests (handled in Onboarding's InterestPicker)
        onSave(name.trim(), avatarId, []);
      }
    } else {
      // Save with selected interests (only reached when editing)
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

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 overflow-y-auto"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="space-card p-6 max-w-md w-full my-4">
        <h2 className="text-2xl font-bold text-center mb-6">
          {editProfile ? 'Edit Player' : title}
        </h2>

        {/* Step indicator */}
        <div className="flex justify-center gap-2 mb-6">
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

        {/* Step: Name */}
        {step === 'name' && (
          <div className="space-y-4">
            <p className="text-center text-slate-300">
              What's the player's name?
            </p>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError('');
              }}
              placeholder="Enter name..."
              className="w-full bg-white/10 border-2 border-white/20 rounded-lg p-4 text-xl text-center
                focus:border-star-gold focus:outline-none"
              autoFocus
              maxLength={20}
              onKeyDown={(e) => e.key === 'Enter' && handleNext()}
            />
            {error && (
              <p className="text-red-400 text-center">{error}</p>
            )}
          </div>
        )}

        {/* Step: Avatar Selection */}
        {step === 'avatar' && (
          <div className="space-y-4">
            <p className="text-center text-slate-300">
              Choose an avatar for {name}:
            </p>
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
                >
                  {avatar.emoji}
                </button>
              ))}
            </div>
            <p className="text-center text-star-gold text-lg font-semibold">
              {selectedAvatar.name}
            </p>
          </div>
        )}

        {/* Step: Interests */}
        {step === 'interests' && (
          <div className="space-y-4">
            <p className="text-center text-slate-300">
              What does {name} like? (Pick any!)
            </p>
            <p className="text-center text-sm text-slate-400">
              We'll use these for personalized stories later
            </p>
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
                  <span className="text-sm">{interest.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 mt-6">
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
            glow={step === 'interests'}
            className="flex-1"
          >
            {step === 'interests' ? (editProfile ? 'Save' : 'Create!') : 'Next'}
          </Button>
        </div>

        {/* Delete option for editing */}
        {editProfile && onDelete && (
          <button
            onClick={onDelete}
            className="w-full mt-4 text-red-400 hover:text-red-300 text-sm"
          >
            Delete this player
          </button>
        )}
      </div>
    </div>
  );
}
