/**
 * Audio Service
 *
 * Playback order for words (Say Word / Hear It / UI lines):
 *   1. Pre-generated clip in public/audio/voice (hash lookup via manifest)
 *   2. speechSynthesis with the best male en-US voice (Andrew/Guy/Davis)
 *
 * Decoder slider is silent — never phoneme clips, never letter names.
 * "Say Word" / "Hear It" still play the whole-word story clip.
 *
 * Chromebook/ChromeOS: never await a fetch between a tap and audio.play().
 * Awaiting ensureManifest() inside the click handler drops user-gesture
 * activation and play() throws NotAllowedError. Preload the manifest on
 * app start; on tap, play() (or speechSynthesis.speak) runs in the same turn.
 *
 * Voice kinds (see src/utils/voice.ts):
 *   zib     — Zib speech bubbles
 *   control — instructions, briefing, UI labels
 *   story   — Say Word / Hear It only (never whole story sentences)
 *
 * Speak diagnostics use console.info so Chromebook/production consoles show them.
 */

import type { TTSConfig } from '../types';
import { resolveAssetUrl } from '../utils/assets';
import {
  pickMaleFallbackVoice,
  stripLetterNames,
  voiceLookupKey,
  type VoiceKind,
  type VoiceManifest,
  type VoiceClipMeta,
  type VoiceWordTiming
} from '../utils/voice';
import { UI, ZIB } from '../data/voiceLines';

export interface SpeakTextOptions {
  onWord?: (charIndex: number) => void;
  voice?: VoiceKind;
}

export interface AudioTestResult {
  zib: string;
  control: string;
}

const DEFAULT_TTS_CONFIG: TTSConfig = {
  engine: 'prerecorded',
  rate: 0.95,
  pitch: 1.0
};

/** Tiny silent WAV so the first tap can unlock Chrome's autoplay gate. */
const SILENT_WAV =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

export interface AudioService {
  speakWord(word: string, options?: SpeakTextOptions): Promise<void>;
  speakText(text: string, options?: SpeakTextOptions): Promise<void>;
  stop(): void;
  isSpeaking(): boolean;
  setConfig(config: Partial<TTSConfig>): void;
  getVoices(): SpeechSynthesisVoice[];
  /** Fetch voice manifest on app start — do not wait for the first 🔊 tap. */
  preloadManifest(): Promise<VoiceManifest | null>;
  /** Play a silent buffer; call from the first pointerdown. */
  unlock(): void;
  /** Parent Settings: play one Zib clip and one Mission Control clip. */
  runAudioTest(): Promise<AudioTestResult>;
}

class WebSpeechAudioService implements AudioService {
  private synth: SpeechSynthesis;
  private config: TTSConfig;
  private speaking = false;
  private selectedVoice: SpeechSynthesisVoice | null = null;
  private clipAudio: HTMLAudioElement | null = null;
  private clipTimer: ReturnType<typeof setInterval> | null = null;
  private manifest: VoiceManifest | null = null;
  private manifestPromise: Promise<VoiceManifest | null> | null = null;
  private generation = 0;
  private unlocked = false;

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

  unlock(): void {
    if (this.unlocked) return;
    this.unlocked = true;

    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctx) {
        const ctx = new Ctx();
        const buf = ctx.createBuffer(1, 1, 22050);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(ctx.destination);
        src.start(0);
        void ctx.resume();
      }
    } catch (err) {
      console.info('[speak] AudioContext unlock failed', err);
    }

    const silent = new Audio(SILENT_WAV);
    silent.volume = 0.01;
    silent.play()
      .then(() => console.info('[speak] audio unlocked'))
      .catch((err: DOMException) => {
        console.info('[speak] silent unlock play() failed', err?.name, err?.message);
      });
  }

  async preloadManifest(): Promise<VoiceManifest | null> {
    return this.ensureManifest();
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
      if (!this.synth) {
        console.info('[speak] speechSynthesis unavailable');
        resolve();
        return;
      }
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
        console.info('[speak] tts error', event.error);
        if (event.error === 'interrupted' || event.error === 'canceled') {
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

  /**
   * Start clip playback in the current turn (no await before audio.play()).
   * Rejects on play() / element error so the caller can fall back to TTS.
   */
  private playClip(
    clip: VoiceClipMeta,
    gen: number,
    onWord?: (charIndex: number) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = resolveAssetUrl(`audio/voice/${clip.file}`);
      const audio = new Audio(url);
      audio.preload = 'auto';
      this.clipAudio = audio;
      this.speaking = true;
      exposeAudioDebug({ file: clip.file, error: null });

      let clearWords: (() => void) | null = null;
      if (onWord && clip.words.length > 0) {
        clearWords = this.fireWordTimings(audio, clip.words, gen, onWord);
      }

      let settled = false;
      const succeed = () => {
        if (settled) return;
        settled = true;
        clearWords?.();
        if (this.clipAudio === audio) this.clipAudio = null;
        if (gen === this.generation) this.speaking = false;
        exposeAudioDebug({ currentTime: audio.currentTime, error: null });
        resolve();
      };

      const fail = (reason: string) => {
        if (settled) return;
        settled = true;
        clearWords?.();
        if (this.clipAudio === audio) this.clipAudio = null;
        if (gen === this.generation) this.speaking = false;
        exposeAudioDebug({ currentTime: audio.currentTime, error: reason });
        reject(new Error(reason));
      };

      audio.onended = succeed;
      audio.onerror = () => {
        const mediaErr = audio.error;
        const reason = `audio element error ${mediaErr?.code ?? ''} ${mediaErr?.message ?? ''}`.trim();
        console.info('[speak] audio error', reason, clip.file);
        fail(reason);
      };

      // play() is called here, synchronously, before any await in the caller.
      const playPromise = audio.play();
      if (playPromise === undefined) return;
      playPromise
        .then(() => {
          exposeAudioDebug({ currentTime: audio.currentTime, error: null, playing: true });
        })
        .catch((err: DOMException) => {
          const reason = `${err?.name || 'PlayError'}: ${err?.message || 'audio.play() rejected'}`;
          console.info('[speak] play() failed', reason, clip.file);
          fail(reason);
        });
    });
  }

  private async fallbackTts(
    spoken: string,
    kind: VoiceKind,
    gen: number,
    onWord?: (charIndex: number) => void
  ): Promise<void> {
    if (!this.synth) {
      console.info('[speak] tts unavailable, giving up');
      return;
    }
    const utterance = this.createUtterance(spoken, kind);
    await this.speakUtterance(utterance, gen, onWord);
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

    // Kick off the fetch if needed, but do NOT await it. Awaiting a network
    // round-trip here is what made Chromebook taps silent (NotAllowedError).
    if (!this.manifest) {
      void this.ensureManifest();
    }

    const clip = this.lookupClip(kind, trimmed) ?? this.lookupClip(kind, spoken);
    if (clip) {
      console.info('[speak] clip', kind, clip.file, trimmed.slice(0, 60));
      try {
        await this.playClip(clip, gen, options?.onWord);
        return;
      } catch (err) {
        console.info(
          '[speak] falling back to tts after clip failure',
          kind,
          err instanceof Error ? err.message : err
        );
      }
    } else {
      console.info(
        '[speak] fallback-tts',
        kind,
        this.manifest ? 'no-clip' : 'no-manifest',
        trimmed.slice(0, 60)
      );
    }

    if (gen !== this.generation) return;
    await this.fallbackTts(spoken, kind, gen, options?.onWord);
  }

  async runAudioTest(): Promise<AudioTestResult> {
    this.unlock();
    await this.ensureManifest();

    const result: AudioTestResult = { zib: 'not run', control: 'not run' };

    const runOne = async (kind: VoiceKind, text: string, label: 'zib' | 'control') => {
      const clip = this.lookupClip(kind, text);
      try {
        this.stop();
        const gen = this.generation;
        if (clip) {
          await this.playClip(clip, gen);
          result[label] = `OK clip ${clip.file}`;
        } else {
          await this.fallbackTts(text, kind, gen);
          result[label] = this.manifest ? 'OK tts (no clip)' : 'OK tts (no manifest)';
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        result[label] = `error: ${msg}`;
        console.info('[speak] audio test failed', label, msg);
      }
    };

    await runOne('zib', ZIB.helloTeach, 'zib');
    await runOne('control', UI.whoIsPlaying, 'control');
    return result;
  }

  stop(): void {
    this.generation += 1;
    this.synth?.cancel();
    this.stopClip();
    this.speaking = false;
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

interface AudioDebugState {
  file?: string;
  currentTime?: number;
  error?: string | null;
  playing?: boolean;
}

function exposeAudioDebug(partial: AudioDebugState): void {
  if (typeof window === 'undefined') return;
  const w = window as unknown as { __srAudio?: AudioDebugState };
  w.__srAudio = { ...(w.__srAudio || {}), ...partial };
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
    speakText: async () => {},
    stop: () => {},
    isSpeaking: () => false,
    setConfig: () => {},
    getVoices: () => [],
    preloadManifest: async () => null,
    unlock: () => {},
    runAudioTest: async () => ({ zib: 'noop', control: 'noop' })
  };
}

let audioServiceInstance: AudioService | null = null;

export function getAudioService(): AudioService {
  if (!audioServiceInstance) {
    audioServiceInstance = createAudioService();
  }
  return audioServiceInstance;
}
