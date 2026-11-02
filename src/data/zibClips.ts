/**
 * Zib Clips Data
 * 
 * Defines the 9 Zib story clips that play throughout the app.
 * Assets are in public/zib-clips/ and lazy-loaded on demand.
 * Voice files can be swapped without code changes.
 */

export type ZibClipId = 
  | 'interest_picker_intro'
  | 'interests_done'
  | 'welcome_back'
  | 'story_start'
  | 'word_cracked'
  | 'keep_trying'
  | 'story_complete'
  | 'planet_unlocked'
  | 'rank_up';

export interface ZibClip {
  id: ZibClipId;
  videoUrl: string;
  posterUrl: string;
  voiceUrl: string;
  durationMs: number;
  voiceDurationMs: number;
  voiceStartsAtMs: number;
  caption: string;
  loopable: boolean;
}

// Base path for clip assets (relative to public/)
const CLIPS_BASE = '/zib-clips';

/**
 * All Zib clips indexed by ID.
 * Videos are lazy-loaded - only fetch when needed.
 */
export const ZIB_CLIPS: Record<ZibClipId, ZibClip> = {
  interest_picker_intro: {
    id: 'interest_picker_intro',
    videoUrl: `${CLIPS_BASE}/video/zib_interest_picker_intro.mp4`,
    posterUrl: `${CLIPS_BASE}/poster/zib_interest_picker_intro.jpg`,
    voiceUrl: `${CLIPS_BASE}/voice/zib_interest_picker_intro.mp3`,
    durationMs: 6340,
    voiceDurationMs: 5040,
    voiceStartsAtMs: 450,
    caption: "Cadet! I want to learn about Earth. Show me what you love! Pick ten things!",
    loopable: false
  },
  interests_done: {
    id: 'interests_done',
    videoUrl: `${CLIPS_BASE}/video/zib_interests_done.mp4`,
    posterUrl: `${CLIPS_BASE}/poster/zib_interests_done.jpg`,
    voiceUrl: `${CLIPS_BASE}/voice/zib_interests_done.mp3`,
    durationMs: 4930,
    voiceDurationMs: 3600,
    voiceStartsAtMs: 450,
    caption: "Wow! Earth is amazing! I can't wait to read about those!",
    loopable: false
  },
  welcome_back: {
    id: 'welcome_back',
    videoUrl: `${CLIPS_BASE}/video/zib_welcome_back.mp4`,
    posterUrl: `${CLIPS_BASE}/poster/zib_welcome_back.jpg`,
    voiceUrl: `${CLIPS_BASE}/voice/zib_welcome_back.mp3`,
    durationMs: 4530,
    voiceDurationMs: 3210,
    voiceStartsAtMs: 450,
    caption: "You're back, Cadet! Ready for today's mission?",
    loopable: false
  },
  story_start: {
    id: 'story_start',
    videoUrl: `${CLIPS_BASE}/video/zib_story_start.mp4`,
    posterUrl: `${CLIPS_BASE}/poster/zib_story_start.jpg`,
    voiceUrl: `${CLIPS_BASE}/voice/zib_story_start.mp3`,
    durationMs: 4500,
    voiceDurationMs: 2510,
    voiceStartsAtMs: 450,
    caption: "A new story! Let's crack the code together!",
    loopable: false
  },
  word_cracked: {
    id: 'word_cracked',
    videoUrl: `${CLIPS_BASE}/video/zib_word_cracked.mp4`,
    posterUrl: `${CLIPS_BASE}/poster/zib_word_cracked.jpg`,
    voiceUrl: `${CLIPS_BASE}/voice/zib_word_cracked.mp3`,
    durationMs: 4040,
    voiceDurationMs: 650,
    voiceStartsAtMs: 350,
    caption: "You cracked it!",
    loopable: true
  },
  keep_trying: {
    id: 'keep_trying',
    videoUrl: `${CLIPS_BASE}/video/zib_keep_trying.mp4`,
    posterUrl: `${CLIPS_BASE}/poster/zib_keep_trying.jpg`,
    voiceUrl: `${CLIPS_BASE}/voice/zib_keep_trying.mp3`,
    durationMs: 4500,
    voiceDurationMs: 2820,
    voiceStartsAtMs: 400,
    caption: "That one was tricky. Let's sound it out together!",
    loopable: false
  },
  story_complete: {
    id: 'story_complete',
    videoUrl: `${CLIPS_BASE}/video/zib_story_complete.mp4`,
    posterUrl: `${CLIPS_BASE}/poster/zib_story_complete.jpg`,
    voiceUrl: `${CLIPS_BASE}/voice/zib_story_complete.mp3`,
    durationMs: 4500,
    voiceDurationMs: 2270,
    voiceStartsAtMs: 450,
    caption: "You did it! Our ship has more fuel!",
    loopable: false
  },
  planet_unlocked: {
    id: 'planet_unlocked',
    videoUrl: `${CLIPS_BASE}/video/zib_planet_unlocked.mp4`,
    posterUrl: `${CLIPS_BASE}/poster/zib_planet_unlocked.jpg`,
    voiceUrl: `${CLIPS_BASE}/voice/zib_planet_unlocked.mp3`,
    durationMs: 4500,
    voiceDurationMs: 2120,
    voiceStartsAtMs: 450,
    caption: "A new planet! Let's go explore!",
    loopable: false
  },
  rank_up: {
    id: 'rank_up',
    videoUrl: `${CLIPS_BASE}/video/zib_rank_up.mp4`,
    posterUrl: `${CLIPS_BASE}/poster/zib_rank_up.jpg`,
    voiceUrl: `${CLIPS_BASE}/voice/zib_rank_up.mp3`,
    durationMs: 4500,
    voiceDurationMs: 1410,
    voiceStartsAtMs: 500,
    caption: "Cadet, you've been promoted!",
    loopable: false
  }
};

/**
 * Get a clip by ID
 */
export function getZibClip(id: ZibClipId): ZibClip {
  return ZIB_CLIPS[id];
}
