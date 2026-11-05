/**
 * Space Readers Type Definitions
 * 
 * Data models designed to scale from single-device localStorage
 * to multi-classroom/school backend database architecture.
 */

// Core entity identifiers - using UUIDs for future multi-device sync
export type ProfileId = string;
export type StoryId = string;
export type MissionId = string;
export type SchoolId = string;
export type ClassroomId = string;

// Represents an avatar option for profile selection
export interface Avatar {
  id: string;
  name: string;
  /** Illustrated character art (public/avatars/<id>.webp). */
  image: string;
  /** Fallback if the webp fails to load. */
  emoji: string;
  color: string;
}

// Child profile data model
// Designed to later support school/classroom associations
export interface Profile {
  id: ProfileId;
  name: string;
  avatarId: string;
  interests: string[];  // Used for AI story generation in Phase 2
  createdAt: number;    // Unix timestamp
  lastActiveAt: number;
  
  // Onboarding state tracking
  hasWatchedIntro: boolean;      // True after first intro video watch
  hasCompletedInterests: boolean; // True after selecting 10+ interests
  
  // Future multi-tenant fields (optional for Phase 1)
  schoolId?: SchoolId;
  classroomId?: ClassroomId;
}

// Gamification rank progression
export type Rank = 'Recruit' | 'Cadet' | 'Pilot' | 'Commander' | 'Captain' | 'Admiral';

export const RANK_ORDER: Rank[] = ['Recruit', 'Cadet', 'Pilot', 'Commander', 'Captain', 'Admiral'];

export const RANK_THRESHOLDS: Record<Rank, number> = {
  'Recruit': 0,
  'Cadet': 50,
  'Pilot': 150,
  'Commander': 300,
  'Captain': 500,
  'Admiral': 1000
};

// Gamification progress for a profile
export interface ProfileProgress {
  profileId: ProfileId;
  fuelCredits: number;           // Primary currency
  starCredits: number;           // Premium currency
  currentRank: Rank;
  totalWordsDecoded: number;     // Words the child sounded out
  storiesCompleted: StoryId[];
  missionsCompleted: MissionId[];
  planetsUnlocked: string[];     // Planet IDs for map progression
  
  // Tracks which words the alien "learned" from this child
  alienLearnedWords: string[];

  /** Current cycle fill, 0–99. 100 triggers an upgrade then resets. */
  shipEnergy: number;
  /** Illustrated parts unlocked after full energy cycles. */
  shipPartsUnlocked: string[];
  
  // Analytics for parent/teacher dashboard
  wordHelpCount: Record<string, number>;  // word -> times tapped for help
  sessionHistory: SessionRecord[];
}

// Record of a reading session
export interface SessionRecord {
  date: number;           // Unix timestamp
  storyId: StoryId;
  durationMs: number;     // Time spent reading
  wordsDecoded: string[]; // Words sounded out this session
  completed: boolean;
}

// Grapheme (sound unit) in a word
// e.g., "ship" -> ["sh", "i", "p"]
export interface Grapheme {
  text: string;           // The letters, e.g., "sh"
  phoneme: string;        // IPA or simplified sound representation
  audioKey?: string;      // Key for prerecorded audio (Phase 2+)
}

// Word with phonics breakdown
export interface DecodableWord {
  word: string;           // The full word
  graphemes: Grapheme[];  // Sound units
  isSightWord: boolean;   // True if should be memorized rather than decoded
  phonicsPatterns: string[]; // e.g., ["CVC", "digraph-sh"]
}

// Story content with metadata
export interface Story {
  id: StoryId;
  title: string;
  author?: string;
  
  // Story content - array of paragraphs, each containing words
  paragraphs: StoryParagraph[];
  
  // Phonics metadata for filtering/progression
  phonicsPatterns: string[];    // Patterns used in this story
  targetWords: string[];        // Key vocabulary words
  sightWords: string[];         // Sight words included
  difficultyLevel: number;      // 1-5 scale
  
  // Mission/framing context
  missionId?: MissionId;
  storyContext?: string;        // Brief narrative setup
  
  // AI generation metadata (for Phase 2)
  generatedFor?: {
    profileId: ProfileId;
    interests: string[];
    knownPatterns: string[];
    generatedAt: number;
  };
}

// A paragraph in a story
export interface StoryParagraph {
  id: string;
  words: DecodableWord[];
  // Original text for display purposes
  rawText: string;
}

// Mission with narrative framing
export interface Mission {
  id: MissionId;
  title: string;
  description: string;
  planetId: string;
  
  // Story context for the mission
  briefing: string;           // Opening narrative
  alienDialogue: string[];    // What Zib says
  completionMessage: string;  // Success message
  
  // Content
  storyIds: StoryId[];
  
  // Requirements
  requiredRank?: Rank;
  prerequisiteMissions?: MissionId[];
  
  // Rewards
  fuelReward: number;
  starReward: number;
  unlocksRank?: Rank;
  unlocksPlanet?: string;
}

// School entity for multi-tenant support
export interface School {
  id: SchoolId;
  name: string;
  createdAt: number;
}

// Classroom entity
export interface Classroom {
  id: ClassroomId;
  schoolId: SchoolId;
  name: string;
  teacherName: string;
  createdAt: number;
}

// App settings stored per device
export interface DeviceSettings {
  parentPin: string;          // PIN for adult-gated areas
  activeProfileId?: ProfileId;
  audioEnabled: boolean;
  speechRate: number;         // 0.5 to 2.0
  zibClipsEnabled: boolean;   // Parent toggle for Zib story clips
  /** Device-wide. Profiles have no settings bag; Parent Zone is one panel like Zib clips. */
  dyslexiaFont: boolean;
  lastSyncedAt?: number;      // For future cloud sync
}

// TTS configuration (abstracted for future audio swap)
export interface TTSConfig {
  engine: 'web-speech' | 'prerecorded' | 'cloud-tts';
  voice?: string;
  rate: number;
  pitch: number;
}

// AI Story Generation Request (Phase 2 stub)
export interface StoryGenerationRequest {
  profileId: ProfileId;
  interests: string[];
  knownPhonicsPatterns: string[];
  targetPhonicsPatterns: string[];
  difficultyLevel: number;
  wordCount?: number;
  theme?: string;
}

// AI Story Generation Response
export interface StoryGenerationResponse {
  success: boolean;
  story?: Story;
  error?: string;
}

// Progress summary for parent/teacher dashboard
export interface ProgressSummary {
  profileId: ProfileId;
  profileName: string;
  totalStoriesCompleted: number;
  totalWordsDecoded: number;
  currentRank: Rank;
  fuelCredits: number;
  totalReadingTimeMs: number;
  mostHelpedWords: Array<{ word: string; count: number }>;
  recentSessions: SessionRecord[];
  alienWordsLearned: number;
}
