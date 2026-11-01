/**
 * Main App Component
 * 
 * Sets up routing and initializes the application state.
 */

import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAppStore } from './stores/appStore';
import { ProfilePicker } from './pages/ProfilePicker';
import { Bridge } from './pages/Bridge';
import { Mission } from './pages/Mission';

// Protected route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { activeProfile, isLoading } = useAppStore();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-space-dark">
        <div className="text-2xl animate-pulse">Loading...</div>
      </div>
    );
  }

  if (!activeProfile) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export function App() {
  const { initialize, isInitialized } = useAppStore();

  // Initialize app on mount
  useEffect(() => {
    if (!isInitialized) {
      initialize();
    }
  }, [initialize, isInitialized]);

  return (
    <BrowserRouter>
      <Routes>
        {/* Profile picker / home */}
        <Route path="/" element={<ProfilePicker />} />
        
        {/* Ship bridge (requires profile) */}
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
