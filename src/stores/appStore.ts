/**
 * Application State Store
 * 
 * Centralized state management using Zustand.
 * Handles profiles, settings, and current session state.
 */

import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { 
  Profile, 
  ProfileProgress, 
  DeviceSettings, 
  Rank,
  SessionRecord,
  StoryId,
  MissionId
} from '../types';
import { storageService, createInitialProgress } from '../services/storage';
import { RANK_ORDER, RANK_THRESHOLDS } from '../types';

interface AppState {
  // Loading state
  isLoading: boolean;
  isInitialized: boolean;
  
  // Current session
  activeProfile: Profile | null;
  activeProgress: ProfileProgress | null;
  
  // All profiles on this device
  profiles: Profile[];
  
  // Progress cache for all profiles (for dashboard)
  allProgress: Record<string, ProfileProgress>;
  
  // Device settings
  settings: DeviceSettings;
  
  // Adult gate state
  isAdultGateOpen: boolean;
  
  // Actions
  initialize: () => Promise<void>;
  
  // Get progress for any profile (from cache)
  getProfileProgress: (profileId: string) => ProfileProgress | null;
  
  // Profile management
  selectProfile: (profileId: string) => Promise<void>;
  createProfile: (name: string, avatarId: string, interests: string[]) => Promise<Profile>;
  updateProfile: (profile: Profile) => Promise<void>;
  deleteProfile: (profileId: string) => Promise<void>;
  resetAllData: () => Promise<void>;
  logoutProfile: () => void;
  
  // Settings
  updateSettings: (settings: Partial<DeviceSettings>) => Promise<void>;
  verifyParentPin: (pin: string) => boolean;
  
  // Adult gate
  openAdultGate: () => void;
  closeAdultGate: () => void;
  
  // Progress updates
  recordWordHelp: (word: string) => Promise<void>;
  completeStory: (storyId: StoryId, wordsDecoded: string[], durationMs: number) => Promise<void>;
  completeMission: (missionId: MissionId, fuelReward: number, starReward: number, unlocksPlanet?: string) => Promise<void>;
  addAlienWord: (word: string) => Promise<void>;
  
  // Rank calculation
  calculateRank: (fuelCredits: number) => Rank;
}

export const useAppStore = create<AppState>((set, get) => ({
  isLoading: true,
  isInitialized: false,
  activeProfile: null,
  activeProgress: null,
  profiles: [],
  allProgress: {},
  settings: {
    parentPin: '1234',
    audioEnabled: true,
    speechRate: 1.0,
    zibClipsEnabled: true
  },
  isAdultGateOpen: false,

  initialize: async () => {
    try {
      const [profiles, settings] = await Promise.all([
        storageService.getProfiles(),
        storageService.getSettings()
      ]);

      // Load progress for all profiles (for dashboard)
      const allProgress: Record<string, ProfileProgress> = {};
      for (const profile of profiles) {
        const progress = await storageService.getProgress(profile.id);
        if (progress) {
          allProgress[profile.id] = progress;
        }
      }

      // If there was a previously active profile, try to restore it
      let activeProfile: Profile | null = null;
      let activeProgress: ProfileProgress | null = null;

      if (settings.activeProfileId) {
        activeProfile = profiles.find(p => p.id === settings.activeProfileId) ?? null;
        if (activeProfile) {
          activeProgress = allProgress[activeProfile.id] || await storageService.getProgress(activeProfile.id);
        }
      }

      set({
        profiles,
        allProgress,
        settings,
        activeProfile,
        activeProgress,
        isLoading: false,
        isInitialized: true
      });
    } catch (error) {
      console.error('Failed to initialize app store:', error);
      set({ isLoading: false, isInitialized: true });
    }
  },

  getProfileProgress: (profileId: string) => {
    const { allProgress, activeProgress } = get();
    // Return active progress if it's for this profile (most up-to-date)
    if (activeProgress?.profileId === profileId) {
      return activeProgress;
    }
    return allProgress[profileId] || null;
  },

  selectProfile: async (profileId: string) => {
    const { profiles, settings, allProgress } = get();
    const profile = profiles.find(p => p.id === profileId);
    
    if (!profile) {
      console.error('Profile not found:', profileId);
      return;
    }

    // Update last active time
    const updatedProfile = { ...profile, lastActiveAt: Date.now() };
    await storageService.saveProfile(updatedProfile);

    // Get or create progress
    let progress = allProgress[profileId] || await storageService.getProgress(profileId);
    if (!progress) {
      progress = createInitialProgress(profileId);
      await storageService.saveProgress(progress);
    }

    // Save active profile to settings
    const newSettings = { ...settings, activeProfileId: profileId };
    await storageService.saveSettings(newSettings);

    set({
      activeProfile: updatedProfile,
      activeProgress: progress,
      settings: newSettings,
      profiles: get().profiles.map(p => p.id === profileId ? updatedProfile : p),
      allProgress: { ...allProgress, [profileId]: progress }
    });
  },

  createProfile: async (name: string, avatarId: string, interests: string[]) => {
    const profile: Profile = {
      id: uuidv4(),
      name,
      avatarId,
      interests,
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
      hasWatchedIntro: false,
      hasCompletedInterests: false
    };

    await storageService.saveProfile(profile);
    
    // Create initial progress
    const progress = createInitialProgress(profile.id);
    await storageService.saveProgress(progress);

    set({ profiles: [...get().profiles, profile] });
    
    return profile;
  },

  updateProfile: async (profile: Profile) => {
    await storageService.saveProfile(profile);
    
    const { activeProfile } = get();
    set({
      profiles: get().profiles.map(p => p.id === profile.id ? profile : p),
      activeProfile: activeProfile?.id === profile.id ? profile : activeProfile
    });
  },

  deleteProfile: async (profileId: string) => {
    await storageService.deleteProfile(profileId);
    
    const { activeProfile, settings, allProgress } = get();
    const newProfiles = get().profiles.filter(p => p.id !== profileId);
    const restProgress = { ...allProgress };
    delete restProgress[profileId];
    
    // If we deleted the active profile, clear it so ProtectedRoute
    // sends the user back to the profile picker.
    if (activeProfile?.id === profileId) {
      const newSettings = { ...settings, activeProfileId: undefined };
      await storageService.saveSettings(newSettings);
      
      set({
        profiles: newProfiles,
        allProgress: restProgress,
        activeProfile: null,
        activeProgress: null,
        settings: newSettings
      });
    } else {
      set({
        profiles: newProfiles,
        allProgress: restProgress
      });
    }
  },

  resetAllData: async () => {
    await storageService.resetAllData();

    const { settings } = get();
    const newSettings = { ...settings, activeProfileId: undefined };
    await storageService.saveSettings(newSettings);

    set({
      profiles: [],
      allProgress: {},
      activeProfile: null,
      activeProgress: null,
      settings: newSettings
    });
  },

  logoutProfile: () => {
    set({
      activeProfile: null,
      activeProgress: null
    });
  },

  updateSettings: async (newSettings: Partial<DeviceSettings>) => {
    const settings = { ...get().settings, ...newSettings };
    await storageService.saveSettings(settings);
    set({ settings });
  },

  verifyParentPin: (pin: string) => {
    return get().settings.parentPin === pin;
  },

  openAdultGate: () => set({ isAdultGateOpen: true }),
  closeAdultGate: () => set({ isAdultGateOpen: false }),

  recordWordHelp: async (word: string) => {
    const { activeProgress, allProgress } = get();
    if (!activeProgress) return;

    const normalizedWord = word.toLowerCase().trim();
    if (!normalizedWord) return;
    const newProgress: ProfileProgress = {
      ...activeProgress,
      wordHelpCount: {
        ...activeProgress.wordHelpCount,
        [normalizedWord]: (activeProgress.wordHelpCount[normalizedWord] || 0) + 1
      },
      totalWordsDecoded: activeProgress.totalWordsDecoded + 1
    };

    await storageService.saveProgress(newProgress);
    set({ 
      activeProgress: newProgress,
      allProgress: { ...allProgress, [newProgress.profileId]: newProgress }
    });
  },

  completeStory: async (storyId: StoryId, wordsDecoded: string[], durationMs: number) => {
    const { activeProgress, allProgress, calculateRank } = get();
    if (!activeProgress) return;

    const cleanWords = wordsDecoded.filter(w => w && w.trim());

    const sessionRecord: SessionRecord = {
      date: Date.now(),
      storyId,
      durationMs,
      wordsDecoded: cleanWords,
      completed: true
    };

    // Award fuel credits for completion (base + bonus for words decoded)
    const fuelEarned = 10 + cleanWords.length * 2;

    const newProgress: ProfileProgress = {
      ...activeProgress,
      storiesCompleted: activeProgress.storiesCompleted.includes(storyId)
        ? activeProgress.storiesCompleted
        : [...activeProgress.storiesCompleted, storyId],
      fuelCredits: activeProgress.fuelCredits + fuelEarned,
      sessionHistory: [...activeProgress.sessionHistory, sessionRecord],
      currentRank: calculateRank(activeProgress.fuelCredits + fuelEarned)
    };

    await storageService.saveProgress(newProgress);
    set({ 
      activeProgress: newProgress,
      allProgress: { ...allProgress, [newProgress.profileId]: newProgress }
    });
  },

  completeMission: async (missionId: MissionId, fuelReward: number, starReward: number, unlocksPlanet?: string) => {
    const { activeProgress, allProgress, calculateRank } = get();
    if (!activeProgress) return;

    const newFuelCredits = activeProgress.fuelCredits + fuelReward;

    // Add planet to unlocked list if provided and not already unlocked
    const newPlanetsUnlocked = unlocksPlanet && !activeProgress.planetsUnlocked.includes(unlocksPlanet)
      ? [...activeProgress.planetsUnlocked, unlocksPlanet]
      : activeProgress.planetsUnlocked;

    const newProgress: ProfileProgress = {
      ...activeProgress,
      missionsCompleted: activeProgress.missionsCompleted.includes(missionId)
        ? activeProgress.missionsCompleted
        : [...activeProgress.missionsCompleted, missionId],
      fuelCredits: newFuelCredits,
      starCredits: activeProgress.starCredits + starReward,
      currentRank: calculateRank(newFuelCredits),
      planetsUnlocked: newPlanetsUnlocked
    };

    await storageService.saveProgress(newProgress);
    set({ 
      activeProgress: newProgress,
      allProgress: { ...allProgress, [newProgress.profileId]: newProgress }
    });
  },

  addAlienWord: async (word: string) => {
    const { activeProgress, allProgress } = get();
    if (!activeProgress) return;

    // Normalize and filter out empty/whitespace-only words
    const normalizedWord = word.toLowerCase().trim();
    if (!normalizedWord) return;
    if (activeProgress.alienLearnedWords.includes(normalizedWord)) return;

    const newProgress: ProfileProgress = {
      ...activeProgress,
      alienLearnedWords: [...activeProgress.alienLearnedWords, normalizedWord]
    };

    await storageService.saveProgress(newProgress);
    set({ 
      activeProgress: newProgress,
      allProgress: { ...allProgress, [newProgress.profileId]: newProgress }
    });
  },

  calculateRank: (fuelCredits: number): Rank => {
    let rank: Rank = 'Recruit';
    for (const r of RANK_ORDER) {
      if (fuelCredits >= RANK_THRESHOLDS[r]) {
        rank = r;
      }
    }
    return rank;
  }
}));
