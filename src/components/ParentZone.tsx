/**
 * Parent Zone
 *
 * Adult-gated overlays shared by the profile picker AND the Bridge so
 * parents can open the dashboard without bouncing back to player select.
 *
 * Always uses the in-app ConfirmModal (never window.confirm) — Chromebook
 * kiosk mode and some PWAs swallow native dialogs, which is why Brian
 * couldn't delete players from the live parent page.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../stores/appStore';
import type { Profile } from '../types';
import { AdultGate } from './AdultGate';
import { ProgressDashboard } from './ProgressDashboard';
import { ProfileForm } from './ProfileForm';
import { OverlayPortal, OVERLAY_Z } from './OverlayPortal';

interface ParentZoneProps {
  /** Extra classes for the 👤 trigger button. */
  className?: string;
}

export function ParentZone({ className = '' }: ParentZoneProps) {
  const navigate = useNavigate();
  const {
    profiles,
    settings,
    deleteProfile,
    updateProfile,
    resetAllData,
    updateSettings
  } = useAppStore();
  const getProgress = useAppStore(state => state.getProfileProgress);

  const [showAdultGate, setShowAdultGate] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [showPinChange, setShowPinChange] = useState(false);
  const [newPin, setNewPin] = useState('');

  const handleDelete = async (profile: Profile) => {
    const wasActive = useAppStore.getState().activeProfile?.id === profile.id;
    await deleteProfile(profile.id);
    setEditingProfile(null);
    setShowProfileForm(false);

    // Clearing the active kid must land on the picker, not a stale Bridge.
    if (wasActive || useAppStore.getState().profiles.length === 0) {
      setShowDashboard(false);
      navigate('/');
    }
  };

  const handleResetAll = async () => {
    await resetAllData();
    setShowDashboard(false);
    setShowProfileForm(false);
    setEditingProfile(null);
    navigate('/');
  };

  const handleSavePin = async () => {
    if (newPin.length !== 4) return;
    await updateSettings({ parentPin: newPin });
    setNewPin('');
    setShowPinChange(false);
    setShowDashboard(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setShowAdultGate(true)}
        className={`p-3 min-w-[44px] min-h-[44px] hover:bg-neon-cyan/10 rounded-lg border border-neon-cyan/30 hover:border-neon-cyan/60 transition-all ${className}`}
        aria-label="Parent dashboard"
        title="Parent Zone"
        data-testid="parent-zone-button"
      >
        <span className="text-xl">👤</span>
      </button>

      <AdultGate
        isOpen={showAdultGate}
        onSuccess={() => {
          setShowAdultGate(false);
          setShowDashboard(true);
        }}
        onCancel={() => setShowAdultGate(false)}
        correctPin={settings.parentPin}
        mode="math"
      />

      {showDashboard && (
        <ProgressDashboard
          profiles={profiles}
          getProgress={getProgress}
          onClose={() => setShowDashboard(false)}
          onEditProfile={(profile) => {
            // Already behind the math gate — don't ask again for Edit.
            setEditingProfile(profile);
            setShowProfileForm(true);
          }}
          onDeleteProfile={handleDelete}
          onResetAllData={handleResetAll}
          onChangePin={() => {
            setShowDashboard(false);
            setShowPinChange(true);
          }}
          onUpdateInterests={async (profile, interests) => {
            await updateProfile({ ...profile, interests });
          }}
          zibClipsEnabled={settings.zibClipsEnabled}
          onToggleZibClips={async (enabled) => {
            await updateSettings({ zibClipsEnabled: enabled });
          }}
          dyslexiaFont={settings.dyslexiaFont === true}
          onToggleDyslexiaFont={async (enabled) => {
            await updateSettings({ dyslexiaFont: enabled });
          }}
        />
      )}

      <ProfileForm
        isOpen={showProfileForm}
        onClose={() => {
          setShowProfileForm(false);
          setEditingProfile(null);
        }}
        onSave={async (name, avatarId, interests) => {
          if (!editingProfile) return;
          await updateProfile({
            ...editingProfile,
            name,
            avatarId,
            interests
          });
          setEditingProfile(null);
          setShowProfileForm(false);
        }}
        onDelete={editingProfile ? () => handleDelete(editingProfile) : undefined}
        editProfile={editingProfile}
      />

      <OverlayPortal open={showPinChange}>
        <div
          className={`fixed inset-0 ${OVERLAY_Z.nestedBackdrop} bg-black/80`}
          data-overlay-backdrop="pin-change"
          aria-hidden="true"
        />
        <div className={`fixed inset-0 ${OVERLAY_Z.nestedDialog} flex items-center justify-center p-4`}>
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
      </OverlayPortal>
    </>
  );
}
