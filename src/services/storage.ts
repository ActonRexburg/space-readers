/**
 * Storage Service Abstraction
 * 
 * Provides a clean interface for data persistence that can be swapped
 * from localStorage to a backend API without changing calling code.
 * 
 * Phase 1: localStorage implementation
 * Phase 2+: Swap to REST API / GraphQL backend
 */

import type {
  Profile,
  ProfileProgress,
  DeviceSettings,
  Story,
  ProfileId
} from '../types';

// Storage keys for localStorage
const STORAGE_KEYS = {
  PROFILES: 'space_readers_profiles',
  PROGRESS: 'space_readers_progress',
  SETTINGS: 'space_readers_settings',
  CUSTOM_STORIES: 'space_readers_custom_stories'
} as const;

// Default device settings
const DEFAULT_SETTINGS: DeviceSettings = {
  parentPin: '1234',
  audioEnabled: true,
  speechRate: 1.0,
  zibClipsEnabled: true
};

// Interface for storage operations
// This interface should be implemented by any storage backend
export interface StorageService {
  // Profile operations
  getProfiles(): Promise<Profile[]>;
  getProfile(id: ProfileId): Promise<Profile | null>;
  saveProfile(profile: Profile): Promise<void>;
  deleteProfile(id: ProfileId): Promise<void>;
  
  // Progress operations
  getProgress(profileId: ProfileId): Promise<ProfileProgress | null>;
  saveProgress(progress: ProfileProgress): Promise<void>;
  
  // Settings operations
  getSettings(): Promise<DeviceSettings>;
  saveSettings(settings: DeviceSettings): Promise<void>;
  
  // Custom stories (AI-generated in Phase 2)
  getCustomStories(profileId: ProfileId): Promise<Story[]>;
  saveCustomStory(profileId: ProfileId, story: Story): Promise<void>;

  // Wipe every profile and related local data on this device
  resetAllData(): Promise<void>;
}

// localStorage implementation of StorageService
class LocalStorageService implements StorageService {
  private getItem<T>(key: string, defaultValue: T): T {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch {
      console.warn(`Failed to parse localStorage key: ${key}`);
      return defaultValue;
    }
  }

  private setItem<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error(`Failed to save to localStorage: ${key}`, e);
    }
  }

  // Profile operations
  async getProfiles(): Promise<Profile[]> {
    return this.getItem<Profile[]>(STORAGE_KEYS.PROFILES, []);
  }

  async getProfile(id: ProfileId): Promise<Profile | null> {
    const profiles = await this.getProfiles();
    return profiles.find(p => p.id === id) ?? null;
  }

  async saveProfile(profile: Profile): Promise<void> {
    const profiles = await this.getProfiles();
    const existingIndex = profiles.findIndex(p => p.id === profile.id);
    
    if (existingIndex >= 0) {
      profiles[existingIndex] = profile;
    } else {
      profiles.push(profile);
    }
    
    this.setItem(STORAGE_KEYS.PROFILES, profiles);
  }

  async deleteProfile(id: ProfileId): Promise<void> {
    const profiles = await this.getProfiles();
    const filtered = profiles.filter(p => p.id !== id);
    this.setItem(STORAGE_KEYS.PROFILES, filtered);
    
    // Also delete associated progress (sessions live inside progress)
    const allProgress = this.getItem<Record<string, ProfileProgress>>(
      STORAGE_KEYS.PROGRESS, 
      {}
    );
    delete allProgress[id];
    this.setItem(STORAGE_KEYS.PROGRESS, allProgress);

    // And any custom stories generated for this player
    const allStories = this.getItem<Record<string, Story[]>>(
      STORAGE_KEYS.CUSTOM_STORIES,
      {}
    );
    delete allStories[id];
    this.setItem(STORAGE_KEYS.CUSTOM_STORIES, allStories);
  }

  // Progress operations
  async getProgress(profileId: ProfileId): Promise<ProfileProgress | null> {
    const allProgress = this.getItem<Record<string, ProfileProgress>>(
      STORAGE_KEYS.PROGRESS,
      {}
    );
    return allProgress[profileId] ?? null;
  }

  async saveProgress(progress: ProfileProgress): Promise<void> {
    const allProgress = this.getItem<Record<string, ProfileProgress>>(
      STORAGE_KEYS.PROGRESS,
      {}
    );
    allProgress[progress.profileId] = progress;
    this.setItem(STORAGE_KEYS.PROGRESS, allProgress);
  }

  // Settings operations
  async getSettings(): Promise<DeviceSettings> {
    return this.getItem<DeviceSettings>(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
  }

  async saveSettings(settings: DeviceSettings): Promise<void> {
    this.setItem(STORAGE_KEYS.SETTINGS, settings);
  }

  // Custom stories operations
  async getCustomStories(profileId: ProfileId): Promise<Story[]> {
    const allStories = this.getItem<Record<string, Story[]>>(
      STORAGE_KEYS.CUSTOM_STORIES,
      {}
    );
    return allStories[profileId] ?? [];
  }

  async saveCustomStory(profileId: ProfileId, story: Story): Promise<void> {
    const allStories = this.getItem<Record<string, Story[]>>(
      STORAGE_KEYS.CUSTOM_STORIES,
      {}
    );
    
    if (!allStories[profileId]) {
      allStories[profileId] = [];
    }
    
    allStories[profileId].push(story);
    this.setItem(STORAGE_KEYS.CUSTOM_STORIES, allStories);
  }

  // Parent Settings "Delete all players" — keeps PIN / audio prefs, wipes kids
  async resetAllData(): Promise<void> {
    this.setItem(STORAGE_KEYS.PROFILES, []);
    this.setItem(STORAGE_KEYS.PROGRESS, {});
    this.setItem(STORAGE_KEYS.CUSTOM_STORIES, {});
  }
}

// Export singleton instance
// In Phase 2+, this can be swapped to an API-backed implementation
export const storageService: StorageService = new LocalStorageService();

// Helper to create initial progress for a new profile
export function createInitialProgress(profileId: ProfileId): ProfileProgress {
  return {
    profileId,
    fuelCredits: 0,
    starCredits: 0,
    currentRank: 'Recruit',
    totalWordsDecoded: 0,
    storiesCompleted: [],
    missionsCompleted: [],
    planetsUnlocked: ['earth'],  // Start with Earth unlocked
    alienLearnedWords: [],
    wordHelpCount: {},
    sessionHistory: []
  };
}

// Export for potential future backend implementation
export type { LocalStorageService };
