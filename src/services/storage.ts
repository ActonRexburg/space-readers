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
import { hydrateShipProgress } from '../data/ship';

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
  zibClipsEnabled: true,
  dyslexiaFont: false
};

/**
 * Merge a stored settings blob onto defaults.
 *
 * getItem() used to return the raw JSON as-is. Older clients saved
 * `{ parentPin, volume: 0 }` or omitted `zibClipsEnabled` / `speechRate`.
 * Missing keys stay `undefined`; `volume: 0` is a leftover that must NEVER
 * be applied to media elements (NaN/0 = silence). We drop unknown keys and
 * clamp speechRate.
 */
export function mergeDeviceSettings(raw: unknown): DeviceSettings {
  const stored = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const rate = Number(stored.speechRate);
  const pin = typeof stored.parentPin === 'string' ? stored.parentPin.trim() : '';
  return {
    parentPin: pin || DEFAULT_SETTINGS.parentPin,
    audioEnabled: stored.audioEnabled !== false,
    speechRate: Number.isFinite(rate) && rate >= 0.5 && rate <= 2 ? rate : DEFAULT_SETTINGS.speechRate,
    zibClipsEnabled: stored.zibClipsEnabled !== false,
    dyslexiaFont: stored.dyslexiaFont === true,
    activeProfileId: typeof stored.activeProfileId === 'string' ? stored.activeProfileId : undefined,
    lastSyncedAt: typeof stored.lastSyncedAt === 'number' ? stored.lastSyncedAt : undefined
  };
}

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
    const stored = allProgress[profileId];
    return stored ? withShipProgress(stored) : null;
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
    const item = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!item) return { ...DEFAULT_SETTINGS };
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(item);
    } catch {
      console.warn('Failed to parse localStorage key: space_readers_settings');
      return { ...DEFAULT_SETTINGS };
    }
    const merged = mergeDeviceSettings(parsed);
    // Rewrite old blobs (volume: 0, missing keys) so they cannot come back.
    if (settingsNeedsHeal(parsed, merged)) {
      this.setItem(STORAGE_KEYS.SETTINGS, merged);
    }
    return merged;
  }

  async saveSettings(settings: DeviceSettings): Promise<void> {
    this.setItem(STORAGE_KEYS.SETTINGS, mergeDeviceSettings(settings));
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

function settingsNeedsHeal(raw: unknown, merged: DeviceSettings): boolean {
  if (!raw || typeof raw !== 'object') return true;
  const stored = raw as Record<string, unknown>;
  if ('volume' in stored || 'muted' in stored) return true;
  if (
    !('audioEnabled' in stored) ||
    !('speechRate' in stored) ||
    !('zibClipsEnabled' in stored) ||
    !('dyslexiaFont' in stored)
  ) {
    return true;
  }
  if (stored.audioEnabled !== merged.audioEnabled) return true;
  if (Number(stored.speechRate) !== merged.speechRate) return true;
  if (stored.zibClipsEnabled !== merged.zibClipsEnabled) return true;
  if (stored.dyslexiaFont !== merged.dyslexiaFont) return true;
  return false;
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
    shipEnergy: 0,
    shipPartsUnlocked: [],
    wordHelpCount: {},
    sessionHistory: []
  };
}

export function withShipProgress(progress: ProfileProgress): ProfileProgress {
  const ship = hydrateShipProgress(progress);
  if (
    progress.shipEnergy === ship.shipEnergy
    && Array.isArray(progress.shipPartsUnlocked)
    && progress.shipPartsUnlocked.length === ship.shipPartsUnlocked.length
    && progress.shipPartsUnlocked.every((id, i) => id === ship.shipPartsUnlocked[i])
  ) {
    return progress;
  }
  return {
    ...progress,
    shipEnergy: ship.shipEnergy,
    shipPartsUnlocked: ship.shipPartsUnlocked
  };
}

// Export for potential future backend implementation
export type { LocalStorageService };
