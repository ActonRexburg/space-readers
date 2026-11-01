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

  // Handle profile selection
  const handleSelectProfile = async (profileId: string) => {
    await selectProfile(profileId);
    navigate('/bridge');
  };

  // Handle add profile button (requires adult gate)
  const handleAddProfile = () => {
    setPendingAction('add');
    setShowAdultGate(true);
  };

  // Handle dashboard button (requires adult gate)
  const handleOpenDashboard = () => {
    setPendingAction('dashboard');
    setShowAdultGate(true);
  };

  // Handle edit profile (requires adult gate)
  const handleEditProfile = (profile: Profile) => {
    setEditingProfile(profile);
    setPendingAction('edit');
    setShowAdultGate(true);
  };

  // Adult gate success handler
  const handleAdultGateSuccess = () => {
    setShowAdultGate(false);
    
    if (pendingAction === 'add') {
      setShowProfileForm(true);
    } else if (pendingAction === 'dashboard') {
      setShowDashboard(true);
    } else if (pendingAction === 'edit') {
      setShowProfileForm(true);
    }
    
    setPendingAction(null);
  };

  // Save profile handler
  const handleSaveProfile = async (name: string, avatarId: string, interests: string[]) => {
    if (editingProfile) {
      await updateProfile({
        ...editingProfile,
        name,
        avatarId,
        interests
      });
      setEditingProfile(null);
    } else {
      await createProfile(name, avatarId, interests);
    }
    setShowProfileForm(false);
  };

  // Delete profile handler
  const handleDeleteProfile = async () => {
    if (editingProfile && confirm(`Delete ${editingProfile.name}'s profile? This cannot be undone.`)) {
      await deleteProfile(editingProfile.id);
      setEditingProfile(null);
      setShowProfileForm(false);
    }
  };

  // Change PIN handler
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

  // Get progress for dashboard
  const getProgress = (profileId: string) => {
    const state = useAppStore.getState();
    if (state.activeProgress?.profileId === profileId) {
      return state.activeProgress;
    }
    // For other profiles, we need to load from storage
    // This is a sync workaround - in a real app, we'd want async data fetching
    return null;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Starfield />
        <div className="text-2xl animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col relative">
      <Starfield />
      
      {/* Header */}
      <header className="relative z-10 p-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <span className="text-4xl">🚀</span>
          <div>
            <h1 className="text-2xl font-bold text-star-gold">Space Readers</h1>
            <p className="text-sm text-slate-400">Tap your name to begin!</p>
          </div>
        </div>
        
        {/* Parent dashboard button */}
        <button
          onClick={handleOpenDashboard}
          className="p-2 hover:bg-white/10 rounded-full text-2xl"
          aria-label="Parent dashboard"
          title="Parent Zone"
        >
          👤
        </button>
      </header>

      {/* Main content */}
      <main className="flex-1 relative z-10 flex flex-col items-center justify-center p-6">
        {profiles.length === 0 ? (
          // Empty state
          <div className="text-center max-w-md">
            <div className="text-6xl mb-4">👽</div>
            <h2 className="text-2xl font-bold mb-2">Welcome to Space Readers!</h2>
            <p className="text-slate-300 mb-6">
              Create a player profile to start your reading adventure across the galaxy!
            </p>
            <button
              onClick={handleAddProfile}
              className="touch-button bg-gradient-to-r from-alien-green to-emerald-600 text-white px-8 py-4 text-xl font-bold glow-green"
            >
              + Create Player
            </button>
          </div>
        ) : (
          // Profile grid
          <div className="w-full max-w-2xl">
            <h2 className="text-xl text-center mb-6">Who's playing today?</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
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

      {/* Footer */}
      <footer className="relative z-10 p-4 text-center text-sm text-slate-500">
        Made with 💜 for young readers
      </footer>

      {/* Adult Gate Modal */}
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

      {/* Profile Form Modal */}
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

      {/* Progress Dashboard */}
      {showDashboard && (
        <ProgressDashboard
          profiles={profiles}
          getProgress={getProgress}
          onClose={() => setShowDashboard(false)}
          onEditProfile={handleEditProfile}
          onChangePin={handleChangePin}
        />
      )}

      {/* PIN Change Modal */}
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
