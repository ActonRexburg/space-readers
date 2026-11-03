/**
 * Profile Picker Page
 *
 * Launch screen where kids tap their avatar to enter.
 * Includes adult-gated profile management.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../stores/appStore';
import { Starfield } from '../components/Starfield';
import { ProfileCard, AddProfileCard } from '../components/ProfileCard';
import { ProfileForm } from '../components/ProfileForm';
import { AdultGate } from '../components/AdultGate';
import { ProgressDashboard } from '../components/ProgressDashboard';
import type { Profile } from '../types';

export function ProfilePicker() {
  const navigate = useNavigate();
  const {
    profiles,
    settings,
    isLoading,
    selectProfile,
    createProfile,
    updateProfile,
    deleteProfile,
    updateSettings
  } = useAppStore();

  const [showAdultGate, setShowAdultGate] = useState(false);
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [pendingAction, setPendingAction] = useState<'add' | 'dashboard' | 'edit' | null>(null);
  const [showPinChange, setShowPinChange] = useState(false);
  const [newPin, setNewPin] = useState('');

  const handleSelectProfile = async (profileId: string) => {
    await selectProfile(profileId);

    const profile = profiles.find(p => p.id === profileId);
    const needsOnboarding = profile && (!profile.hasWatchedIntro || !profile.hasCompletedInterests);

    if (needsOnboarding) {
      navigate('/onboarding');
    } else {
      navigate('/bridge');
    }
  };

  const handleAddProfile = () => {
    setShowProfileForm(true);
  };

  const handleOpenDashboard = () => {
    setPendingAction('dashboard');
    setShowAdultGate(true);
  };

  const handleEditProfile = (profile: Profile) => {
    setEditingProfile(profile);
    setPendingAction('edit');
    setShowAdultGate(true);
  };

  const handleAdultGateSuccess = () => {
    setShowAdultGate(false);

    if (pendingAction === 'dashboard') {
      setShowDashboard(true);
    } else if (pendingAction === 'edit') {
      setShowProfileForm(true);
    }

    setPendingAction(null);
  };

  const handleSaveProfile = async (name: string, avatarId: string, interests: string[]) => {
    if (editingProfile) {
      await updateProfile({
        ...editingProfile,
        name,
        avatarId,
        interests
      });
      setEditingProfile(null);
      setShowProfileForm(false);
    } else {
      const newProfile = await createProfile(name, avatarId, interests);
      setShowProfileForm(false);

      await selectProfile(newProfile.id);
      navigate('/onboarding');
    }
  };

  const handleDeleteProfile = async () => {
    if (editingProfile && confirm(`Delete ${editingProfile.name}'s profile? This cannot be undone.`)) {
      await deleteProfile(editingProfile.id);
      setEditingProfile(null);
      setShowProfileForm(false);
    }
  };

  const handleChangePin = () => {
    setShowDashboard(false);
    setShowPinChange(true);
  };

  const handleSavePin = async () => {
    if (newPin.length === 4) {
      await updateSettings({ parentPin: newPin });
      setNewPin('');
      setShowPinChange(false);
      setShowDashboard(true);
    }
  };

  const getProgress = useAppStore(state => state.getProfileProgress);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-space-dark">
        <Starfield />
        <div className="text-2xl animate-pulse text-neon-cyan">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col relative bg-space-dark">
      <Starfield />

      <header className="relative z-10 p-5 flex justify-between items-center border-b border-neon-cyan/20">
        <div className="flex items-center gap-3">
          <span className="text-4xl float">🚀</span>
          <h1 className="text-2xl font-bold text-star-gold text-glow-gold">Space Readers</h1>
        </div>

        <button
          onClick={handleOpenDashboard}
          className="p-3 min-w-[44px] min-h-[44px] hover:bg-neon-cyan/10 rounded-lg border border-neon-cyan/30 hover:border-neon-cyan/60 transition-all"
          aria-label="Parent dashboard"
          title="Parent Zone"
        >
          <span className="text-xl">👤</span>
        </button>
      </header>

      <main className="flex-1 relative z-10 flex flex-col items-center justify-center p-8">
        {profiles.length === 0 ? (
          <div className="text-center max-w-md space-card p-10">
            <div className="text-7xl mb-6 float">👽</div>
            <button
              onClick={handleAddProfile}
              className="touch-button btn-neon-gold pulse-action px-10 py-5 text-2xl font-bold"
            >
              🚀 Create Player
            </button>
          </div>
        ) : (
          <div className="w-full max-w-2xl">
            <h2 className="text-2xl text-center mb-8 text-neon-cyan text-glow-cyan">Who's playing?</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
              {profiles.map(profile => (
                <ProfileCard
                  key={profile.id}
                  profile={profile}
                  onClick={() => handleSelectProfile(profile.id)}
                />
              ))}
              <AddProfileCard onClick={handleAddProfile} />
            </div>
          </div>
        )}
      </main>

      <AdultGate
        isOpen={showAdultGate}
        onSuccess={handleAdultGateSuccess}
        onCancel={() => {
          setShowAdultGate(false);
          setPendingAction(null);
          setEditingProfile(null);
        }}
        correctPin={settings.parentPin}
        mode="math"
      />

      <ProfileForm
        isOpen={showProfileForm}
        onClose={() => {
          setShowProfileForm(false);
          setEditingProfile(null);
        }}
        onSave={handleSaveProfile}
        onDelete={editingProfile ? handleDeleteProfile : undefined}
        editProfile={editingProfile}
      />

      {showDashboard && (
        <ProgressDashboard
          profiles={profiles}
          getProgress={getProgress}
          onClose={() => setShowDashboard(false)}
          onEditProfile={handleEditProfile}
          onChangePin={handleChangePin}
          onUpdateInterests={async (profile, interests) => {
            await updateProfile({ ...profile, interests });
          }}
          zibClipsEnabled={settings.zibClipsEnabled}
          onToggleZibClips={async (enabled) => {
            await updateSettings({ zibClipsEnabled: enabled });
          }}
        />
      )}

      {showPinChange && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="space-card p-6 max-w-sm w-full">
            <h2 className="text-xl font-bold text-center mb-4">Change Parent PIN</h2>
            <input
              type="password"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="Enter new 4-digit PIN"
              className="w-full bg-white/10 border-2 border-white/20 rounded-lg p-4 text-xl text-center
                focus:border-star-gold focus:outline-none mb-4"
              maxLength={4}
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowPinChange(false);
                  setNewPin('');
                  setShowDashboard(true);
                }}
                className="flex-1 touch-button bg-white/10 text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePin}
                disabled={newPin.length !== 4}
                className="flex-1 touch-button bg-alien-green text-white disabled:opacity-50"
              >
                Save PIN
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
