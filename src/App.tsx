/**
 * Main App Component
 * 
 * Sets up routing and initializes the application state.
 */

import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAppStore } from './stores/appStore';
import { getZibClipService } from './services/zibClips';
import { getAudioService } from './services/audio';
import { injectOpenDyslexicFont } from './utils/opendyslexic';
import { ProfilePicker } from './pages/ProfilePicker';
import { Bridge } from './pages/Bridge';
import { Mission } from './pages/Mission';
import { Onboarding } from './pages/Onboarding';
import { ZibClip } from './components/ZibClip';

// Protected route wrapper - redirects to onboarding if not completed
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { activeProfile, isLoading } = useAppStore();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-space-dark">
        <div className="text-2xl text-neon-cyan">Loading...</div>
      </div>
    );
  }

  if (!activeProfile) {
    return <Navigate to="/" replace />;
  }

  // Check if onboarding is complete
  const needsOnboarding = !activeProfile.hasWatchedIntro || !activeProfile.hasCompletedInterests;
  if (needsOnboarding) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}

// Onboarding route wrapper - only for profiles that need it
function OnboardingRoute() {
  const { activeProfile, isLoading } = useAppStore();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-space-dark">
        <div className="text-2xl text-neon-cyan">Loading...</div>
      </div>
    );
  }

  if (!activeProfile) {
    return <Navigate to="/" replace />;
  }

  // If onboarding is already complete, go to bridge
  if (activeProfile.hasWatchedIntro && activeProfile.hasCompletedInterests) {
    return <Navigate to="/bridge" replace />;
  }

  return <Onboarding />;
}

export function App() {
  const { initialize, isInitialized, settings } = useAppStore();

  // Initialize app on mount
  useEffect(() => {
    if (!isInitialized) {
      initialize();
    }
  }, [initialize, isInitialized]);

  // Sync Zib clips enabled setting with the service
  useEffect(() => {
    const service = getZibClipService();
    service.setEnabled(settings.zibClipsEnabled !== false);
  }, [settings.zibClipsEnabled]);

  // Device-wide OpenDyslexic for reading text. Headings stay Fredoka.
  useEffect(() => {
    injectOpenDyslexicFont();
    document.documentElement.classList.toggle('dyslexia-font', settings.dyslexiaFont === true);
  }, [settings.dyslexiaFont]);

  // Preload voice clips before the first 🔊 tap. Do NOT create an
  // AudioContext on pointerdown — that ducks speechSynthesis + HTMLAudio
  // on Chrome/Windows (pre-#8 TTS had no context and worked).
  useEffect(() => {
    void getAudioService().preloadManifest();
  }, []);

  // Get basename from Vite's BASE_URL (e.g., "/space-readers/")
  // Remove trailing slash for react-router compatibility
  const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/';

  return (
    <BrowserRouter basename={basename}>
      {/* Zib popup sits bottom-left (above reader nav) so it never covers story text. Overlays at z-50 hide it. */}
      <ZibClip position="bottom-left" />
      
      <Routes>
        {/* Profile picker / home */}
        <Route path="/" element={<ProfilePicker />} />
        
        {/* Onboarding (intro video + interest picker) */}
        <Route path="/onboarding" element={<OnboardingRoute />} />
        
        {/* Ship bridge (requires profile + completed onboarding) */}
        <Route 
          path="/bridge" 
          element={
            <ProtectedRoute>
              <Bridge />
            </ProtectedRoute>
          } 
        />
        
        {/* Mission page (requires profile) */}
        <Route 
          path="/mission/:missionId" 
          element={
            <ProtectedRoute>
              <Mission />
            </ProtectedRoute>
          } 
        />
        
        {/* Catch-all redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
