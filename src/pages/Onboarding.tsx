/**
 * Onboarding Page
 * 
 * Handles the first-time experience for new profiles:
 * 1. Intro video (mission briefing)
 * 2. Interest picker (for AI story generation)
 * 3. Transition to Bridge
 */

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../stores/appStore';
import { IntroVideo } from '../components/IntroVideo';
import { InterestPicker } from '../components/InterestPicker';
import { Starfield } from '../components/Starfield';

type OnboardingStep = 'intro' | 'interests';

export function Onboarding() {
  const navigate = useNavigate();
  const { activeProfile, updateProfile } = useAppStore();
  
  // Determine starting step based on profile state
  const [step, setStep] = useState<OnboardingStep>(() => {
    if (!activeProfile) return 'intro';
    if (!activeProfile.hasWatchedIntro) return 'intro';
    if (!activeProfile.hasCompletedInterests) return 'interests';
    return 'intro'; // Shouldn't reach here
  });

  // Handle intro video completion
  const handleIntroComplete = useCallback(async () => {
    if (!activeProfile) return;
    
    await updateProfile({
      ...activeProfile,
      hasWatchedIntro: true
    });
    
    setStep('interests');
  }, [activeProfile, updateProfile]);

  // Handle intro skip
  const handleIntroSkip = useCallback(async () => {
    if (!activeProfile) return;
    
    await updateProfile({
      ...activeProfile,
      hasWatchedIntro: true
    });
    
    setStep('interests');
  }, [activeProfile, updateProfile]);

  // Handle interest picker completion
  const handleInterestsComplete = useCallback(async (interests: string[]) => {
    if (!activeProfile) return;
    
    await updateProfile({
      ...activeProfile,
      interests,
      hasCompletedInterests: true
    });
    
    // Navigate to bridge
    navigate('/bridge');
  }, [activeProfile, updateProfile, navigate]);

  // Redirect if no active profile
  if (!activeProfile) {
    navigate('/');
    return null;
  }

  return (
    <div className="min-h-screen relative">
      <Starfield />
      
      {step === 'intro' && (
        <IntroVideo
          onComplete={handleIntroComplete}
          onSkip={handleIntroSkip}
          showSkip={true}
        />
      )}

      {step === 'interests' && (
        <InterestPicker
          initialInterests={activeProfile.hasCompletedInterests ? activeProfile.interests : []}
          onComplete={handleInterestsComplete}
        />
      )}
    </div>
  );
}
