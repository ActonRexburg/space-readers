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
  
  // Device settings
  settings: DeviceSettings;
  
  // Adult gate state
  isAdultGateOpen: boolean;
  
  // Actions
  initialize: () => Promise<void>;
  
  // Profile management
  selectProfile: (profileId: string) => Promise<void>;
  createProfile: (name: string, avatarId: string, interests: string[]) => Promise<Profile>;
  updateProfile: (profile: Profile) => Promise<void>;
  deleteProfile: (profileId: string) => Promise<void>;
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
  completeMission: (missionId: MissionId, fuelReward: number, starReward: number) => Promise<void>;
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
  settings: {
    parentPin: '1234',
    audioEnabled: true,
    speechRate: 1.0
  },
  isAdultGateOpen: false,

  initialize: async () => {
    try {
      const [profiles, settings] = await Promise.all([
        storageService.getProfiles(),
        storageService.getSettings()
      ]);

      // If there was a previously active profile, try to restore it
      let activeProfile: Profile | null = null;
      let activeProgress: ProfileProgress | null = null;

      if (settings.activeProfileId) {
        activeProfile = profiles.find(p => p.id === settings.activeProfileId) ?? null;
        if (activeProfile) {
          activeProgress = await storageService.getProgress(activeProfile.id);
        }
      }

      set({
        profiles,
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

  selectProfile: async (profileId: string) => {
    const { profiles, settings } = get();
    const profile = profiles.find(p => p.id === profileId);
    
    if (!profile) {
      console.error('Profile not found:', profileId);
      return;
    }

    // Update last active time
    const updatedProfile = { ...profile, lastActiveAt: Date.now() };
    await storageService.saveProfile(updatedProfile);

    // Get or create progress
    let progress = await storageService.getProgress(profileId);
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
      profiles: get().profiles.map(p => p.id === profileId ? updatedProfile : p)
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
    
    const { activeProfile, settings } = get();
    const newProfiles = get().profiles.filter(p => p.id !== profileId);
    
    // If we deleted the active profile, clear it
    if (activeProfile?.id === profileId) {
      const newSettings = { ...settings, activeProfileId: undefined };
      await storageService.saveSettings(newSettings);
      
      set({
        profiles: newProfiles,
        activeProfile: null,
        activeProgress: null,
        settings: newSettings
      });
    } else {
      set({ profiles: newProfiles });
    }
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
    const { activeProgress } = get();
    if (!activeProgress) return;

    const normalizedWord = word.toLowerCase();
    const newProgress: ProfileProgress = {
      ...activeProgress,
      wordHelpCount: {
        ...activeProgress.wordHelpCount,
        [normalizedWord]: (activeProgress.wordHelpCount[normalizedWord] || 0) + 1
      },
      totalWordsDecoded: activeProgress.totalWordsDecoded + 1
    };

    await storageService.saveProgress(newProgress);
    set({ activeProgress: newProgress });
  },

  completeStory: async (storyId: StoryId, wordsDecoded: string[], durationMs: number) => {
    const { activeProgress, calculateRank } = get();
    if (!activeProgress) return;

    const sessionRecord: SessionRecord = {
      date: Date.now(),
      storyId,
      durationMs,
      wordsDecoded,
      completed: true
    };

    // Award fuel credits for completion (base + bonus for words decoded)
    const fuelEarned = 10 + wordsDecoded.length * 2;

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
    set({ activeProgress: newProgress });
  },

  completeMission: async (missionId: MissionId, fuelReward: number, starReward: number) => {
    const { activeProgress, calculateRank } = get();
    if (!activeProgress) return;

    const newFuelCredits = activeProgress.fuelCredits + fuelReward;

    const newProgress: ProfileProgress = {
      ...activeProgress,
      missionsCompleted: activeProgress.missionsCompleted.includes(missionId)
        ? activeProgress.missionsCompleted
        : [...activeProgress.missionsCompleted, missionId],
      fuelCredits: newFuelCredits,
      starCredits: activeProgress.starCredits + starReward,
      currentRank: calculateRank(newFuelCredits)
    };

    await storageService.saveProgress(newProgress);
    set({ activeProgress: newProgress });
  },

  addAlienWord: async (word: string) => {
    const { activeProgress } = get();
    if (!activeProgress) return;

    const normalizedWord = word.toLowerCase();
    if (activeProgress.alienLearnedWords.includes(normalizedWord)) return;

    const newProgress: ProfileProgress = {
      ...activeProgress,
      alienLearnedWords: [...activeProgress.alienLearnedWords, normalizedWord]
    };

    await storageService.saveProgress(newProgress);
    set({ activeProgress: newProgress });
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
