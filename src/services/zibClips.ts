/**
 * Zib Clips Service
 * 
 * Manages triggering Zib story clips throughout the app.
 * Prevents stacking multiple clips, handles throttling for
 * frequently-fired triggers (like word_cracked), and
 * provides voice-only mode for quick reactions.
 */

import { ZIB_CLIPS, type ZibClipId, type ZibClip } from '../data/zibClips';

export type ClipMode = 'video' | 'voice';

export interface ClipTriggerOptions {
  mode?: ClipMode;
  onComplete?: () => void;
  onSkip?: () => void;
}

export interface PendingClip {
  clip: ZibClip;
  mode: ClipMode;
  onComplete?: () => void;
  onSkip?: () => void;
}

type ClipChangeListener = (clip: PendingClip | null) => void;

class ZibClipService {
  private currentClip: PendingClip | null = null;
  private listeners: Set<ClipChangeListener> = new Set();
  private enabled: boolean = true;
  
  // Throttling state for word_cracked
  private wordCrackedCount: number = 0;
  private wordCrackedStoryId: string | null = null;
  private lastWordCrackedTime: number = 0;
  
  // Session tracking for welcome_back
  private hasPlayedWelcomeBack: boolean = false;

  /**
   * Subscribe to clip changes
   */
  subscribe(listener: ClipChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify all listeners of clip change
   */
  private notify() {
    this.listeners.forEach(listener => listener(this.currentClip));
  }

  /**
   * Check if clips are enabled (parent setting)
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Enable or disable clips (parent setting)
   */
  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled && this.currentClip) {
      this.dismiss();
    }
  }

  /**
   * Check if a clip is currently showing
   */
  isShowing(): boolean {
    return this.currentClip !== null;
  }

  /**
   * Get the current clip (if any)
   */
  getCurrentClip(): PendingClip | null {
    return this.currentClip;
  }

  /**
   * Trigger a clip to play
   * Returns false if clips are disabled or another clip is already playing
   */
  trigger(clipId: ZibClipId, options: ClipTriggerOptions = {}): boolean {
    if (!this.enabled) return false;
    
    // Don't stack clips - if one is playing, don't interrupt
    if (this.currentClip) return false;

    const clip = ZIB_CLIPS[clipId];
    if (!clip) return false;

    this.currentClip = {
      clip,
      mode: options.mode || 'video',
      onComplete: options.onComplete,
      onSkip: options.onSkip
    };

    this.notify();
    return true;
  }

  /**
   * Dismiss the current clip (user tap or auto-complete)
   */
  dismiss(wasSkipped: boolean = false) {
    if (!this.currentClip) return;

    const { onComplete, onSkip } = this.currentClip;
    this.currentClip = null;
    this.notify();

    if (wasSkipped) {
      onSkip?.();
    } else {
      onComplete?.();
    }
  }

  /**
   * Mark the clip as completed (video ended naturally)
   */
  complete() {
    this.dismiss(false);
  }

  /**
   * Skip the current clip
   */
  skip() {
    this.dismiss(true);
  }

  // ============================================
  // Specialized trigger methods with throttling
  // ============================================

  /**
   * Trigger interest_picker_intro when the interest picker opens
   */
  triggerInterestPickerIntro(options?: ClipTriggerOptions): boolean {
    return this.trigger('interest_picker_intro', options);
  }

  /**
   * Trigger interests_done after 10+ picks are confirmed
   */
  triggerInterestsDone(options?: ClipTriggerOptions): boolean {
    return this.trigger('interests_done', options);
  }

  /**
   * Trigger welcome_back for returning cadets (once per session)
   */
  triggerWelcomeBack(options?: ClipTriggerOptions): boolean {
    if (this.hasPlayedWelcomeBack) return false;
    
    const success = this.trigger('welcome_back', options);
    if (success) {
      this.hasPlayedWelcomeBack = true;
    }
    return success;
  }

  /**
   * Reset the welcome_back flag (for testing or new day)
   */
  resetWelcomeBack() {
    this.hasPlayedWelcomeBack = false;
  }

  /**
   * Trigger story_start when a new story opens
   */
  triggerStoryStart(storyId: string, options?: ClipTriggerOptions): boolean {
    // Reset word cracked counter for new story
    this.wordCrackedStoryId = storyId;
    this.wordCrackedCount = 0;
    
    return this.trigger('story_start', options);
  }

  /**
   * Trigger word_cracked with smart throttling:
   * - First word in a story: always play video
   * - Every 5th word: play video
   * - Otherwise: play voice-only (quick celebration)
   * - Minimum 3 seconds between any word_cracked
   */
  triggerWordCracked(storyId: string, options?: ClipTriggerOptions): boolean {
    const now = Date.now();
    
    // Minimum cooldown between word_cracked triggers
    if (now - this.lastWordCrackedTime < 3000) {
      return false;
    }
    
    // Reset counter if different story
    if (storyId !== this.wordCrackedStoryId) {
      this.wordCrackedStoryId = storyId;
      this.wordCrackedCount = 0;
    }
    
    this.wordCrackedCount++;
    this.lastWordCrackedTime = now;
    
    // First word or every 5th word: full video
    // Otherwise: voice only
    const useVideo = this.wordCrackedCount === 1 || this.wordCrackedCount % 5 === 0;
    
    return this.trigger('word_cracked', {
      ...options,
      mode: useVideo ? 'video' : 'voice'
    });
  }

  /**
   * Trigger keep_trying after 2+ misses on a word
   */
  triggerKeepTrying(options?: ClipTriggerOptions): boolean {
    return this.trigger('keep_trying', options);
  }

  /**
   * Trigger story_complete when a story ends
   */
  triggerStoryComplete(options?: ClipTriggerOptions): boolean {
    return this.trigger('story_complete', options);
  }

  /**
   * Trigger planet_unlocked when a new planet is unlocked
   */
  triggerPlanetUnlocked(options?: ClipTriggerOptions): boolean {
    return this.trigger('planet_unlocked', options);
  }

  /**
   * Trigger rank_up on promotion
   */
  triggerRankUp(options?: ClipTriggerOptions): boolean {
    return this.trigger('rank_up', options);
  }
}

// Singleton instance
let instance: ZibClipService | null = null;

export function getZibClipService(): ZibClipService {
  if (!instance) {
    instance = new ZibClipService();
  }
  return instance;
}

// Export for testing
export { ZibClipService };
