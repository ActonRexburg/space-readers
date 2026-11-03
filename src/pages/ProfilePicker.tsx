/**
 * Profile Picker Page
 *
 * Launch screen where kids tap their avatar to enter.
 * Parent dashboard / edit / delete live in ParentZone (math-gated).
 * Kid cards are play-only — no long-press delete on the picker itself.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../stores/appStore';
import { Starfield } from '../components/Starfield';
import { ProfileCard, AddProfileCard } from '../components/ProfileCard';
import { ProfileForm } from '../components/ProfileForm';
import { ParentZone } from '../components/ParentZone';
import { SpokenLine } from '../components/SpeakButton';
import { UI } from '../data/voiceLines';
import { useIdleGlow } from '../hooks/useIdleGlow';

export function ProfilePicker() {
  const navigate = useNavigate();
  const {
    profiles,
    isLoading,
    selectProfile,
    createProfile
  } = useAppStore();

  const [showProfileForm, setShowProfileForm] = useState(false);
  // Empty picker: Create Player is the only next action. With players, cards
  // are equally primary so none of them idle-glow.
  const idleGlow = useIdleGlow(profiles.length === 0 && !showProfileForm);

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

  const handleSaveProfile = async (name: string, avatarId: string, interests: string[]) => {
    const newProfile = await createProfile(name, avatarId, interests);
    setShowProfileForm(false);
    await selectProfile(newProfile.id);
    navigate('/onboarding');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-space-dark">
        <Starfield />
        <div className="text-2xl text-neon-cyan">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col relative bg-space-dark">
      <Starfield />

      {/* z-10 here used to trap Parent Zone overlays under the player grid.
          Overlays now portal to document.body (OverlayPortal). Keep z-10 only
          so the header/grid sit above the starfield. */}
      <header className="relative z-10 p-5 flex justify-between items-center border-b border-neon-cyan/20">
        <div className="flex items-center gap-3">
          <span className="text-4xl">🚀</span>
          <h1 className="text-2xl font-bold text-star-gold text-glow-gold">Space Readers</h1>
        </div>

        <ParentZone />
      </header>

      <main className="flex-1 relative z-10 flex flex-col items-center justify-center p-8">
        {profiles.length === 0 ? (
          <div className="text-center max-w-md space-card p-10">
            <div className="text-7xl mb-6">👽</div>
            <SpokenLine
              text={UI.tapToCreate}
              voice="control"
              autoPlay
              className="justify-center mb-6"
              textClassName="text-xl text-white"
            />
            <button
              onClick={() => setShowProfileForm(true)}
              className={`touch-button btn-neon-gold px-10 py-5 text-2xl font-bold ${idleGlow}`}
            >
              🚀 Create Player
            </button>
          </div>
        ) : (
          <div className="w-full max-w-2xl">
            <SpokenLine
              text={UI.whoIsPlaying}
              voice="control"
              autoPlay
              className="justify-center mb-8"
              textClassName="text-2xl text-neon-cyan text-glow-cyan"
            />
            <SpokenLine
              text={UI.tapYourName}
              voice="control"
              className="justify-center mb-6"
              textClassName="text-xl text-white"
            />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
              {profiles.map(profile => (
                <ProfileCard
                  key={profile.id}
                  profile={profile}
                  onClick={() => handleSelectProfile(profile.id)}
                />
              ))}
              <AddProfileCard onClick={() => setShowProfileForm(true)} />
            </div>
          </div>
        )}
      </main>

      <ProfileForm
        isOpen={showProfileForm}
        onClose={() => setShowProfileForm(false)}
        onSave={handleSaveProfile}
      />
    </div>
  );
}
