/**
 * Audio Service Abstraction
 * 
 * Provides text-to-speech and audio playback capabilities.
 * Currently uses Web Speech API but designed to swap to:
 * - Prerecorded phoneme audio files
 * - Cloud TTS (Google, Amazon Polly, etc.)
 * 
 * The interface is designed to support both whole-word and
 * individual phoneme/grapheme pronunciation.
 */

import type { Grapheme, TTSConfig } from '../types';
import { resolveAssetUrl } from '../utils/assets';
import { phonemeClipKey } from '../data/phonemes';

// Default TTS configuration
const DEFAULT_TTS_CONFIG: TTSConfig = {
  engine: 'web-speech',
  rate: 0.9,  // Slightly slower for kids
  pitch: 1.0
};

// Interface for audio service operations
export interface AudioService {
  // Speak a complete word
  speakWord(word: string): Promise<void>;
  
  // Speak an individual phoneme/sound (for decoder slider)
  speakPhoneme(grapheme: Grapheme): Promise<void>;
  
  // Speak a phrase or sentence
  speakText(text: string): Promise<void>;
  
  // Stop any current speech
  stop(): void;
  
  // Check if speech is currently playing
  isSpeaking(): boolean;
  
  // Update configuration
  setConfig(config: Partial<TTSConfig>): void;
  
  // Get available voices
  getVoices(): SpeechSynthesisVoice[];
}

// Web Speech API implementation
class WebSpeechAudioService implements AudioService {
  private synth: SpeechSynthesis;
  private config: TTSConfig;
  private speaking: boolean = false;
  private selectedVoice: SpeechSynthesisVoice | null = null;
  private phonemeAudio: HTMLAudioElement | null = null;
  private phonemeCache = new Map<string, HTMLAudioElement>();

  constructor(config: TTSConfig = DEFAULT_TTS_CONFIG) {
    this.synth = typeof window !== 'undefined' ? window.speechSynthesis : (null as unknown as SpeechSynthesis);
    this.config = config;
    
    // Load voices when they become available
    if (this.synth) {
      this.loadVoices();
      this.synth.onvoiceschanged = () => this.loadVoices();
    }
  }

  private loadVoices(): void {
    if (!this.synth) return;
    const voices = this.synth.getVoices();
    
    // Prefer child-friendly US English voices
    const preferredVoices = [
      'Google US English',
      'Microsoft Zira',
      'Samantha',  // macOS
      'Alex'       // macOS fallback
    ];
    
    for (const preferred of preferredVoices) {
      const found = voices.find(v => v.name.includes(preferred));
      if (found) {
        this.selectedVoice = found;
        break;
      }
    }
    
    // Fallback to first English voice
    if (!this.selectedVoice) {
      this.selectedVoice = voices.find(v => v.lang.startsWith('en')) ?? voices[0];
    }
  }

  private createUtterance(text: string): SpeechSynthesisUtterance {
    const utterance = new SpeechSynthesisUtterance(text);
    
    utterance.rate = this.config.rate;
    utterance.pitch = this.config.pitch;
    
    if (this.selectedVoice) {
      utterance.voice = this.selectedVoice;
    }
    
    return utterance;
  }

  private speak(utterance: SpeechSynthesisUtterance): Promise<void> {
    return new Promise((resolve, reject) => {
      this.speaking = true;
      
      utterance.onend = () => {
        this.speaking = false;
        resolve();
      };
      
      utterance.onerror = (event) => {
        this.speaking = false;
        // Don't reject on interrupted - this is expected when stopping
        if (event.error === 'interrupted') {
          resolve();
        } else {
          reject(new Error(`Speech error: ${event.error}`));
        }
      };
      
      // Chrome bug workaround - cancel before speaking
      this.synth.cancel();
      this.synth.speak(utterance);
    });
  }

  async speakWord(word: string): Promise<void> {
    if (!this.synth) return;
    this.stopPhoneme();
    const utterance = this.createUtterance(word);
    // Slightly slower for individual words to help with comprehension
    utterance.rate = Math.max(0.7, this.config.rate - 0.1);
    return this.speak(utterance);
  }

  async speakPhoneme(grapheme: Grapheme): Promise<void> {
    // Isolated clips only. NEVER speechSynthesis of the letter (that says "bee"/"ay"/"tee").
    this.synth?.cancel();
    this.stopPhoneme();

    const key = grapheme.audioKey || phonemeClipKey(grapheme.phoneme, grapheme.text);
    if (!key) {
      return;
    }

    const url = resolveAssetUrl(`audio/phonemes/${key}.mp3`);
    let audio = this.phonemeCache.get(key);
    if (!audio) {
      audio = new Audio(url);
      audio.preload = 'auto';
      this.phonemeCache.set(key, audio);
    }

    audio.currentTime = 0;
    this.phonemeAudio = audio;

    try {
      await audio.play();
    } catch {
      // Missing file, decode error, or autoplay block — stay silent.
    }
  }

  private stopPhoneme(): void {
    if (this.phonemeAudio) {
      this.phonemeAudio.pause();
      this.phonemeAudio.currentTime = 0;
      this.phonemeAudio = null;
    }
  }

  async speakText(text: string): Promise<void> {
    if (!this.synth) return;
    const utterance = this.createUtterance(text);
    return this.speak(utterance);
  }

  stop(): void {
    this.synth?.cancel();
    this.stopPhoneme();
    this.speaking = false;
  }

  isSpeaking(): boolean {
    return this.speaking || Boolean(this.synth?.speaking);
  }

  setConfig(config: Partial<TTSConfig>): void {
    this.config = { ...this.config, ...config };
    
    if (config.voice) {
      const voices = this.synth.getVoices();
      const found = voices.find(v => v.name === config.voice);
      if (found) {
        this.selectedVoice = found;
      }
    }
  }

  getVoices(): SpeechSynthesisVoice[] {
    return this.synth?.getVoices() ?? [];
  }
}

// Factory function to create the appropriate audio service
// In Phase 2, this can check config and return different implementations
export function createAudioService(config?: TTSConfig): AudioService {
  // Phoneme clips use HTMLAudioElement and work without Web Speech.
  if (typeof window !== 'undefined') {
    return new WebSpeechAudioService(config);
  }
  return createNoOpAudioService();
}

// No-op implementation for environments without speech
function createNoOpAudioService(): AudioService {
  return {
    speakWord: async () => {},
    speakPhoneme: async () => {},
    speakText: async () => {},
    stop: () => {},
    isSpeaking: () => false,
    setConfig: () => {},
    getVoices: () => []
  };
}

// Export singleton instance
let audioServiceInstance: AudioService | null = null;

export function getAudioService(): AudioService {
  if (!audioServiceInstance) {
    audioServiceInstance = createAudioService();
  }
  return audioServiceInstance;
}
