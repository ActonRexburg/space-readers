/**
 * Audio Service
 *
 * Playback order for words (Say Word / Hear It / UI lines):
 *   1. Pre-generated clip in public/audio/voice (hash lookup via manifest)
 *   2. speechSynthesis with the best male en-US voice (Andrew/Guy/Davis)
 *
 * Phonemes on the decoder slider are ALWAYS isolated MP3s. Never TTS a letter
 * name ("bee"/"ay"/"tee"). Spelled sequences like M-U-G are stripped before
 * any speak() call.
 *
 * Voice kinds (see src/utils/voice.ts):
 *   zib     — Zib speech bubbles
 *   control — instructions, briefing, UI labels
 *   story   — Say Word / Hear It only (never whole story sentences)
 *
 * Speak diagnostics use console.info (not debug) so Chromebook/production
 * consoles actually show clip vs fallback-tts. debug is hidden by default.
 */

import type { Grapheme, TTSConfig } from '../types';
import { resolveAssetUrl } from '../utils/assets';
import { phonemeClipKey } from '../data/phonemes';
import {
  pickMaleFallbackVoice,
  stripLetterNames,
  voiceLookupKey,
  type VoiceKind,
  type VoiceManifest,
  type VoiceClipMeta,
  type VoiceWordTiming
} from '../utils/voice';

export interface SpeakTextOptions {
  onWord?: (charIndex: number) => void;
  voice?: VoiceKind;
}

const DEFAULT_TTS_CONFIG: TTSConfig = {
  engine: 'prerecorded',
  rate: 0.95,
  pitch: 1.0
};

export interface AudioService {
  speakWord(word: string, options?: SpeakTextOptions): Promise<void>;
  speakPhoneme(grapheme: Grapheme): Promise<void>;
  speakText(text: string, options?: SpeakTextOptions): Promise<void>;
  stop(): void;
  isSpeaking(): boolean;
  setConfig(config: Partial<TTSConfig>): void;
  getVoices(): SpeechSynthesisVoice[];
}

class WebSpeechAudioService implements AudioService {
  private synth: SpeechSynthesis;
  private config: TTSConfig;
  private speaking = false;
  private selectedVoice: SpeechSynthesisVoice | null = null;
  private phonemeAudio: HTMLAudioElement | null = null;
  private phonemeCache = new Map<string, HTMLAudioElement>();
  private clipAudio: HTMLAudioElement | null = null;
  private clipTimer: ReturnType<typeof setInterval> | null = null;
  private manifest: VoiceManifest | null = null;
  private manifestPromise: Promise<VoiceManifest | null> | null = null;
  private generation = 0;

  constructor(config: TTSConfig = DEFAULT_TTS_CONFIG) {
    this.synth = typeof window !== 'undefined' ? window.speechSynthesis : (null as unknown as SpeechSynthesis);
    this.config = config;

    if (this.synth) {
      this.loadVoices();
      this.synth.onvoiceschanged = () => this.loadVoices();
    }
  }

  private loadVoices(): void {
    if (!this.synth) return;
    this.selectedVoice = pickMaleFallbackVoice(this.synth.getVoices());
  }

  private async ensureManifest(): Promise<VoiceManifest | null> {
    if (this.manifest) return this.manifest;
    if (this.manifestPromise) return this.manifestPromise;

    this.manifestPromise = (async () => {
      const url = resolveAssetUrl('audio/voice/manifest.json');
      try {
        const res = await fetch(url, {
          cache: 'no-cache',
          headers: { Accept: 'application/json' }
        });
        const type = res.headers.get('content-type') || '';
        if (!res.ok) {
          console.info('[speak] manifest fetch failed', res.status, url);
          this.manifestPromise = null;
          return null;
        }
        // SW navigateFallback used to serve index.html here — reject HTML.
        if (type.includes('text/html')) {
          console.info('[speak] manifest was HTML (SW fallback?), skipping clips', url);
          this.manifestPromise = null;
          return null;
        }
        const data = (await res.json()) as VoiceManifest;
        if (!data?.clips || typeof data.clips !== 'object') {
          console.info('[speak] manifest missing clips map', url);
          this.manifestPromise = null;
          return null;
        }
        this.manifest = data;
        console.info('[speak] manifest loaded', Object.keys(data.clips).length, 'clips');
        return data;
      } catch (err) {
        console.info('[speak] manifest error', err);
        this.manifestPromise = null;
        return null;
      }
    })();

    return this.manifestPromise;
  }

  private lookupClip(kind: VoiceKind, text: string): VoiceClipMeta | null {
    if (!this.manifest) return null;
    return this.manifest.clips[voiceLookupKey(kind, text)] ?? null;
  }

  private createUtterance(text: string, kind: VoiceKind): SpeechSynthesisUtterance {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = kind === 'zib' ? 1.06 : this.config.rate;
    utterance.pitch = kind === 'zib' ? 1.15 : this.config.pitch;
    if (this.selectedVoice) {
      utterance.voice = this.selectedVoice;
    }
    return utterance;
  }

  private speakUtterance(
    utterance: SpeechSynthesisUtterance,
    gen: number,
    onWord?: (charIndex: number) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      this.speaking = true;

      if (onWord) {
        utterance.onboundary = (event) => {
          if (event.name && event.name !== 'word') return;
          if (gen !== this.generation) return;
          onWord(event.charIndex);
        };
      }

      utterance.onend = () => {
        if (gen === this.generation) this.speaking = false;
        resolve();
      };

      utterance.onerror = (event) => {
        if (gen === this.generation) this.speaking = false;
        if (event.error === 'interrupted') {
          resolve();
        } else {
          reject(new Error(`Speech error: ${event.error}`));
        }
      };

      this.synth.cancel();
      this.synth.speak(utterance);
    });
  }

  private fireWordTimings(
    audio: HTMLAudioElement,
    words: VoiceWordTiming[],
    gen: number,
    onWord: (charIndex: number) => void
  ): () => void {
    let next = 0;
    const tick = () => {
      if (gen !== this.generation) return;
      const ms = audio.currentTime * 1000;
      while (next < words.length && words[next].offsetMs <= ms + 30) {
        onWord(words[next].charIndex);
        next += 1;
      }
    };
    const id = window.setInterval(tick, 40);
    this.clipTimer = id;
    audio.ontimeupdate = tick;
    return () => {
      window.clearInterval(id);
      if (this.clipTimer === id) this.clipTimer = null;
      audio.ontimeupdate = null;
    };
  }

  private playClip(
    clip: VoiceClipMeta,
    gen: number,
    onWord?: (charIndex: number) => void
  ): Promise<void> {
    return new Promise((resolve) => {
      const audio = new Audio(resolveAssetUrl(`audio/voice/${clip.file}`));
      audio.preload = 'auto';
      this.clipAudio = audio;
      this.speaking = true;

      let clearWords: (() => void) | null = null;
      if (onWord && clip.words.length > 0) {
        clearWords = this.fireWordTimings(audio, clip.words, gen, onWord);
      }

      const finish = () => {
        clearWords?.();
        if (this.clipAudio === audio) this.clipAudio = null;
        if (gen === this.generation) this.speaking = false;
        resolve();
      };

      audio.onended = finish;
      audio.onerror = finish;

      audio.play().catch(() => {
        finish();
      });
    });
  }

  async speakPhoneme(grapheme: Grapheme): Promise<void> {
    // Isolated clips only. NEVER speechSynthesis of the letter (that says "bee"/"ay"/"tee").
    this.synth?.cancel();
    this.stopPhoneme();
    this.stopClip();

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

  private stopClip(): void {
    if (this.clipTimer) {
      window.clearInterval(this.clipTimer);
      this.clipTimer = null;
    }
    if (this.clipAudio) {
      this.clipAudio.pause();
      this.clipAudio.src = '';
      this.clipAudio = null;
    }
  }

  async speakWord(word: string, options?: SpeakTextOptions): Promise<void> {
    return this.speakText(word, { ...options, voice: options?.voice ?? 'story' });
  }

  async speakText(text: string, options?: SpeakTextOptions): Promise<void> {
    const kind: VoiceKind = options?.voice ?? 'control';
    const trimmed = text.replace(/\s+/g, ' ').trim();
    if (!trimmed) return;

    // Never speak letter names — strip M-U-G / F-I-SH before lookup or fallback.
    const spoken = stripLetterNames(trimmed);
    if (!spoken) return;

    this.stop();
    const gen = this.generation;

    await this.ensureManifest();
    if (gen !== this.generation) return;

    const clip = this.lookupClip(kind, trimmed) ?? this.lookupClip(kind, spoken);
    if (clip) {
      console.info('[speak] clip', kind, clip.file, trimmed.slice(0, 60));
      await this.playClip(clip, gen, options?.onWord);
      return;
    }

    console.info(
      '[speak] fallback-tts',
      kind,
      this.manifest ? 'no-clip' : 'no-manifest',
      trimmed.slice(0, 60)
    );
    if (!this.synth) return;
    this.stopPhoneme();
    const utterance = this.createUtterance(spoken, kind);
    await this.speakUtterance(utterance, gen, options?.onWord);
  }

  stop(): void {
    this.generation += 1;
    this.synth?.cancel();
    this.stopPhoneme();
    this.stopClip();
    this.speaking = false;
  }

  isSpeaking(): boolean {
    return this.speaking || Boolean(this.synth?.speaking);
  }

  setConfig(config: Partial<TTSConfig>): void {
    this.config = { ...this.config, ...config };

    if (config.voice && this.synth) {
      const voices = this.synth.getVoices();
      const found = voices.find((v) => v.name === config.voice);
      if (found) {
        this.selectedVoice = found;
      }
    }
  }

  getVoices(): SpeechSynthesisVoice[] {
    return this.synth?.getVoices() ?? [];
  }
}

export function createAudioService(config?: TTSConfig): AudioService {
  if (typeof window !== 'undefined') {
    return new WebSpeechAudioService(config);
  }
  return createNoOpAudioService();
}

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

let audioServiceInstance: AudioService | null = null;

export function getAudioService(): AudioService {
  if (!audioServiceInstance) {
    audioServiceInstance = createAudioService();
  }
  return audioServiceInstance;
}
