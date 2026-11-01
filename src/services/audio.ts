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

  constructor(config: TTSConfig = DEFAULT_TTS_CONFIG) {
    this.synth = window.speechSynthesis;
    this.config = config;
    
    // Load voices when they become available
    this.loadVoices();
    if (typeof window !== 'undefined') {
      window.speechSynthesis.onvoiceschanged = () => this.loadVoices();
    }
  }

  private loadVoices(): void {
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
    const utterance = this.createUtterance(word);
    // Slightly slower for individual words to help with comprehension
    utterance.rate = Math.max(0.7, this.config.rate - 0.1);
    return this.speak(utterance);
  }

  async speakPhoneme(grapheme: Grapheme): Promise<void> {
    // For phonemes, we use the text representation
    // Phase 2 can use grapheme.audioKey for prerecorded sounds
    const utterance = this.createUtterance(grapheme.text);
    // Very slow for individual sounds
    utterance.rate = 0.5;
    return this.speak(utterance);
  }

  async speakText(text: string): Promise<void> {
    const utterance = this.createUtterance(text);
    return this.speak(utterance);
  }

  stop(): void {
    this.synth.cancel();
    this.speaking = false;
  }

  isSpeaking(): boolean {
    return this.speaking || this.synth.speaking;
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
    return this.synth.getVoices();
  }
}

// Factory function to create the appropriate audio service
// In Phase 2, this can check config and return different implementations
export function createAudioService(config?: TTSConfig): AudioService {
  // Check if Web Speech API is available
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    return new WebSpeechAudioService(config);
  }
  
  // Return a no-op service if speech is not available
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

// Utility function for phoneme pronunciation hints
// Maps common graphemes to pronunciation-friendly text
export const PHONEME_HINTS: Record<string, string> = {
  'sh': 'shh',
  'ch': 'chuh',
  'th': 'thh',
  'wh': 'wuh',
  'ck': 'k',
  'ng': 'ng',
  'qu': 'kwuh',
  'ph': 'f',
  'wr': 'r',
  'kn': 'n',
  'gn': 'n',
  'mb': 'm',
  'a': 'ah',
  'e': 'eh',
  'i': 'ih',
  'o': 'oh',
  'u': 'uh',
  'a_e': 'ay',  // Magic e patterns
  'i_e': 'eye',
  'o_e': 'oh',
  'u_e': 'you',
  'e_e': 'ee',
  'ai': 'ay',
  'ay': 'ay',
  'ea': 'ee',
  'ee': 'ee',
  'ie': 'eye',
  'oa': 'oh',
  'ow': 'oh',
  'oo': 'oo',
  'ou': 'ow',
  'oi': 'oy',
  'oy': 'oy',
  'ar': 'ar',
  'er': 'er',
  'ir': 'er',
  'or': 'or',
  'ur': 'er',
  'aw': 'aw',
  'au': 'aw',
  'ew': 'oo',
  'igh': 'eye'
};
