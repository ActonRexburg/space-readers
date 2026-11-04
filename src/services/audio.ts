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
 * WHY WEB AUDIO (not HTMLAudioElement) FOR VOICE MP3s:
 * Chrome media elements send Range: bytes=0- . GitHub Pages answers 206.
 * The old Workbox CacheFirst + RangeRequestsPlugin route for /audio/*.mp3
 * then cached or served that partial response (or a stale audio-cache*
 * entry from an older SW). play() still resolved, so the Parent Zone
 * "Audio test" printed "OK clip" while speakers stayed silent. Zib
 * comm-link <video> is NetworkOnly and was never on this path.
 *
 * Fix: fetch() the mp3 (no Range) → arrayBuffer → decodeAudioData →
 * BufferSource on a shared AudioContext resumed on the first user tap.
 * HTMLAudioElement is only a fallback. Word-timing callbacks are driven
 * from AudioContext.currentTime so they keep working.
 *
 * Chromebook/ChromeOS: never await a fetch between a tap and
 * HTMLAudioElement.play() — that drops user-gesture activation.
 * Web Audio is different: once the shared context is running, later
 * BufferSource.start() does not need a gesture, so fetch+decode is OK.
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
  /** Resume the shared AudioContext; call from the first pointerdown. */
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
  private clipSource: AudioBufferSourceNode | null = null;
  private clipTimer: ReturnType<typeof setInterval> | null = null;
  private manifest: VoiceManifest | null = null;
  private manifestPromise: Promise<VoiceManifest | null> | null = null;
  private generation = 0;
  private unlocked = false;
  /** Shared context — created/resumed on the first user tap, then reused. */
  private ctx: AudioContext | null = null;
  /** In-memory decoded clips so a second play is a cache hit (no refetch). */
  private bufferCache = new Map<string, AudioBuffer>();

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

  private audioContextCtor(): typeof AudioContext | null {
    if (typeof window === 'undefined') return null;
    return (
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ||
      null
    );
  }

  /**
   * Create (once) and resume the shared AudioContext. Must run inside a
   * user-gesture turn (pointerdown / click) so Chrome allows output.
   */
  private ensureCtx(): AudioContext | null {
    const Ctor = this.audioContextCtor();
    if (!Ctor) return null;
    if (!this.ctx || this.ctx.state === 'closed') {
      try {
        this.ctx = new Ctor();
      } catch (err) {
        console.info('[speak] AudioContext create failed', err);
        this.ctx = null;
        return null;
      }
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  unlock(): void {
    this.ensureCtx();
    if (this.unlocked) return;
    this.unlocked = true;

    const silent = new Audio(SILENT_WAV);
    silent.volume = 0.01;
    silent.play()
      .then(() => console.info('[speak] audio unlocked', this.ctx?.state ?? 'no-ctx'))
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

  /** Word timings from AudioContext.currentTime (Web Audio path). */
  private fireWordTimingsCtx(
    startedAt: number,
    words: VoiceWordTiming[],
    gen: number,
    onWord?: (charIndex: number) => void
  ): () => void {
    let next = 0;
    const tick = () => {
      if (gen !== this.generation || !this.ctx) return;
      const elapsed = this.ctx.currentTime - startedAt;
      exposeAudioDebug({ currentTime: elapsed, playing: true, engine: 'webaudio' });
      if (!onWord) return;
      const ms = elapsed * 1000;
      while (next < words.length && words[next].offsetMs <= ms + 30) {
        onWord(words[next].charIndex);
        next += 1;
      }
    };
    const id = window.setInterval(tick, 40);
    this.clipTimer = id;
    return () => {
      window.clearInterval(id);
      if (this.clipTimer === id) this.clipTimer = null;
    };
  }

  /** Word timings from HTMLAudioElement.currentTime (fallback path). */
  private fireWordTimingsHtml(
    audio: HTMLAudioElement,
    words: VoiceWordTiming[],
    gen: number,
    onWord?: (charIndex: number) => void
  ): () => void {
    let next = 0;
    const tick = () => {
      if (gen !== this.generation) return;
      exposeAudioDebug({ currentTime: audio.currentTime, playing: true, engine: 'html' });
      if (!onWord) return;
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

  private async decodeClip(url: string, file: string): Promise<{
    buffer: AudioBuffer;
    cache: 'memory' | 'network';
    status: number;
    bytes: number;
  }> {
    const cached = this.bufferCache.get(file);
    if (cached) {
      return { buffer: cached, cache: 'memory', status: 200, bytes: 0 };
    }
    if (!this.ctx) {
      throw new Error('no AudioContext');
    }
    // No Range header — this is the whole point vs HTMLAudioElement.
    const res = await fetch(url);
    const status = res.status;
    const bytesBuf = await res.arrayBuffer();
    const bytes = bytesBuf.byteLength;
    if (!res.ok || bytes < 100) {
      throw new Error(`fetch ${status} ${bytes} bytes`);
    }
    // decodeAudioData detaches the buffer in some engines — copy first.
    const buffer = await this.ctx.decodeAudioData(bytesBuf.slice(0));
    this.bufferCache.set(file, buffer);
    return { buffer, cache: 'network', status, bytes };
  }

  /**
   * fetch → decode → BufferSource. Safe to await: the shared context was
   * resumed on the first tap, so start() does not need a fresh gesture.
   */
  private async playClipWebAudio(
    clip: VoiceClipMeta,
    url: string,
    gen: number,
    onWord?: (charIndex: number) => void
  ): Promise<void> {
    const ctx = this.ctx;
    if (!ctx) throw new Error('no AudioContext');
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    if (ctx.state !== 'running') {
      throw new Error(`AudioContext state=${ctx.state}`);
    }

    const { buffer, cache } = await this.decodeClip(url, clip.file);
    if (gen !== this.generation) return;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    this.clipSource = source;
    this.speaking = true;
    const startedAt = ctx.currentTime;
    exposeAudioDebug({
      file: clip.file,
      error: null,
      playing: true,
      engine: 'webaudio',
      currentTime: 0,
      cache,
      duration: buffer.duration
    });

    const clearWords = this.fireWordTimingsCtx(startedAt, clip.words, gen, onWord);

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const succeed = () => {
        if (settled) return;
        settled = true;
        clearWords();
        if (this.clipSource === source) this.clipSource = null;
        if (gen === this.generation) this.speaking = false;
        exposeAudioDebug({
          currentTime: ctx.currentTime - startedAt,
          playing: false,
          error: null,
          engine: 'webaudio'
        });
        resolve();
      };
      source.onended = succeed;
      try {
        source.start(0);
      } catch (err) {
        if (settled) return;
        settled = true;
        clearWords();
        if (this.clipSource === source) this.clipSource = null;
        if (gen === this.generation) this.speaking = false;
        const reason = err instanceof Error ? err.message : String(err);
        exposeAudioDebug({ error: reason, playing: false, engine: 'webaudio' });
        reject(new Error(reason));
      }
    });
  }

  /**
   * HTMLAudioElement fallback. play() runs in the Promise executor so it
   * stays in the same turn as the caller when this is the first path.
   */
  private playClipHtml(
    clip: VoiceClipMeta,
    url: string,
    gen: number,
    onWord?: (charIndex: number) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const audio = new Audio(url);
      audio.preload = 'auto';
      this.clipAudio = audio;
      this.speaking = true;
      exposeAudioDebug({ file: clip.file, error: null, engine: 'html', playing: false });

      const clearWords = this.fireWordTimingsHtml(audio, clip.words, gen, onWord);

      let settled = false;
      const succeed = () => {
        if (settled) return;
        settled = true;
        clearWords();
        if (this.clipAudio === audio) this.clipAudio = null;
        if (gen === this.generation) this.speaking = false;
        exposeAudioDebug({ currentTime: audio.currentTime, error: null, engine: 'html', playing: false });
        resolve();
      };

      const fail = (reason: string) => {
        if (settled) return;
        settled = true;
        clearWords();
        if (this.clipAudio === audio) this.clipAudio = null;
        if (gen === this.generation) this.speaking = false;
        exposeAudioDebug({ currentTime: audio.currentTime, error: reason, engine: 'html', playing: false });
        reject(new Error(reason));
      };

      audio.onended = succeed;
      audio.onerror = () => {
        const mediaErr = audio.error;
        const reason = `audio element error ${mediaErr?.code ?? ''} ${mediaErr?.message ?? ''}`.trim();
        console.info('[speak] audio error', reason, clip.file);
        fail(reason);
      };

      const playPromise = audio.play();
      if (playPromise === undefined) return;
      playPromise
        .then(() => {
          exposeAudioDebug({ currentTime: audio.currentTime, error: null, playing: true, engine: 'html' });
        })
        .catch((err: DOMException) => {
          const reason = `${err?.name || 'PlayError'}: ${err?.message || 'audio.play() rejected'}`;
          console.info('[speak] play() failed', reason, clip.file);
          fail(reason);
        });
    });
  }

  /**
   * Prefer Web Audio when the shared context is already running (first tap
   * called unlock()). Otherwise start HTMLAudioElement.play() synchronously
   * so Chromebook autoplay-gesture rules still hold.
   */
  private playClip(
    clip: VoiceClipMeta,
    gen: number,
    onWord?: (charIndex: number) => void
  ): Promise<void> {
    const url = resolveAssetUrl(`audio/voice/${clip.file}`);
    exposeAudioDebug({ file: clip.file, error: null, playing: false });

    const ctx = this.ctx;
    if (ctx && ctx.state !== 'closed') {
      return this.playClipWebAudio(clip, url, gen, onWord).catch((err) => {
        console.info(
          '[speak] webaudio failed, html fallback',
          clip.file,
          err instanceof Error ? err.message : err
        );
        if (gen !== this.generation) return;
        return this.playClipHtml(clip, url, gen, onWord);
      });
    }
    return this.playClipHtml(clip, url, gen, onWord);
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

  /**
   * Real evidence for Brian — fetch status/bytes, decode, duration, and
   * whether playback advanced after 600ms. play() resolving is NOT enough.
   * On any failure, also try HTMLAudioElement + speechSynthesis.
   */
  async runAudioTest(): Promise<AudioTestResult> {
    this.unlock();
    await this.ensureManifest();

    const result: AudioTestResult = { zib: 'not run', control: 'not run' };

    result.zib = await this.probeClip('zib', ZIB.helloTeach);
    result.control = await this.probeClip('control', UI.whoIsPlaying);

    exposeAudioDebug({ lastTest: result });
    return result;
  }

  private async probeClip(kind: VoiceKind, text: string): Promise<string> {
    const lines: string[] = [];
    const clip = this.lookupClip(kind, text);
    if (!clip) {
      lines.push(`clip: MISSING (${this.manifest ? 'no-clip' : 'no-manifest'})`);
      lines.push(await this.probeTts(text, kind));
      return lines.join('\n');
    }

    const url = resolveAssetUrl(`audio/voice/${clip.file}`);
    lines.push(`file: ${clip.file}`);

    this.unlock();
    const ctx = this.ensureCtx();
    if (ctx && ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch (err) {
        lines.push(`resume: FAIL ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    lines.push(`ctx: ${ctx?.state ?? 'none'}`);

    let fetchStatus = 0;
    let bytes = 0;
    let raw: ArrayBuffer | null = null;
    try {
      // no-store so this report is a real network GET, not a stale SW cache.
      const res = await fetch(url, { cache: 'no-store' });
      fetchStatus = res.status;
      raw = await res.arrayBuffer();
      bytes = raw.byteLength;
      const contentRange = res.headers.get('content-range');
      const contentType = res.headers.get('content-type') || '';
      lines.push(
        `fetch: ${fetchStatus} ${bytes} bytes type=${contentType || '?'}` +
          (contentRange ? ` content-range=${contentRange}` : '')
      );
      if (!res.ok || bytes < 100) {
        throw new Error('empty or bad fetch');
      }
    } catch (err) {
      lines.push(`fetch: FAIL ${err instanceof Error ? err.message : String(err)}`);
      lines.push(await this.probeHtml(url));
      lines.push(await this.probeTts(text, kind));
      return lines.join('\n');
    }

    if (!ctx) {
      lines.push('decode: SKIP (no AudioContext)');
      lines.push(await this.probeHtml(url));
      lines.push(await this.probeTts(text, kind));
      return lines.join('\n');
    }

    let decoded: AudioBuffer;
    try {
      decoded = await ctx.decodeAudioData(raw.slice(0));
      this.bufferCache.set(clip.file, decoded);
      lines.push(
        `decode: OK duration=${decoded.duration.toFixed(2)}s ` +
          `channels=${decoded.numberOfChannels} rate=${decoded.sampleRate}`
      );
    } catch (err) {
      lines.push(`decode: FAIL ${err instanceof Error ? err.message : String(err)}`);
      lines.push(await this.probeHtml(url));
      lines.push(await this.probeTts(text, kind));
      return lines.join('\n');
    }

    this.stopClip();
    const gen = this.generation;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    const source = ctx.createBufferSource();
    source.buffer = decoded;
    source.connect(analyser);
    analyser.connect(ctx.destination);
    this.clipSource = source;
    this.speaking = true;
    exposeAudioDebug({
      file: clip.file,
      engine: 'webaudio',
      playing: true,
      duration: decoded.duration,
      error: null
    });

    const ended = new Promise<void>((resolve) => {
      source.onended = () => resolve();
    });

    let advanced = false;
    let delta = 0;
    let peak = 0;
    try {
      const t0 = ctx.currentTime;
      source.start(0);
      await wait(600);
      if (gen !== this.generation) {
        lines.push('play: STOPPED');
        return lines.join('\n');
      }
      delta = ctx.currentTime - t0;
      advanced = delta > 0.3;
      const data = new Uint8Array(analyser.fftSize);
      analyser.getByteTimeDomainData(data);
      for (let i = 0; i < data.length; i += 1) {
        peak = Math.max(peak, Math.abs(data[i] - 128));
      }
      lines.push(`engine: webaudio`);
      lines.push(
        `advanced: contextDelta=${delta.toFixed(2)}s ` +
          `${advanced ? 'PASS' : 'FAIL'} (need >0.3s after 600ms)`
      );
      lines.push(
        `analyserPeak: ${peak} ${peak > 2 ? 'PASS signal' : 'WARN silent-or-no-sink'}`
      );
      exposeAudioDebug({
        currentTime: delta,
        playing: true,
        engine: 'webaudio',
        contextDelta: delta,
        analyserPeak: peak
      });
    } catch (err) {
      lines.push(`play: FAIL ${err instanceof Error ? err.message : String(err)}`);
      lines.push(await this.probeHtml(url));
      lines.push(await this.probeTts(text, kind));
      return lines.join('\n');
    }

    if (!advanced) {
      try {
        source.stop();
      } catch {
        /* already stopped */
      }
      lines.push(await this.probeHtml(url));
      lines.push(await this.probeTts(text, kind));
      return lines.join('\n');
    }

    // Let the rest of the clip play so Brian actually hears it.
    const remainingMs = Math.max(0, Math.min(decoded.duration * 1000 - 600, 10000));
    await Promise.race([ended, wait(remainingMs + 200)]);
    if (this.clipSource === source) this.clipSource = null;
    if (gen === this.generation) this.speaking = false;
    lines.push(advanced ? 'RESULT: PASS (clip played)' : 'RESULT: FAIL');
    return lines.join('\n');
  }

  private async probeHtml(url: string): Promise<string> {
    try {
      const audio = new Audio(url);
      audio.preload = 'auto';
      this.clipAudio = audio;
      await audio.play();
      await wait(600);
      const t = audio.currentTime;
      const err = audio.error;
      audio.pause();
      audio.src = '';
      if (this.clipAudio === audio) this.clipAudio = null;
      const ok = t > 0.3 && !err;
      return (
        `html: currentTime=${t.toFixed(2)}s ${ok ? 'PASS' : 'FAIL'}` +
        (err ? ` error=${err.code} ${err.message}` : '')
      );
    } catch (err) {
      const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      return `html: FAIL ${msg}`;
    }
  }

  private async probeTts(text: string, kind: VoiceKind): Promise<string> {
    if (!this.synth) return 'tts: UNAVAILABLE (no speechSynthesis)';
    const voices = this.synth.getVoices();
    const voiceName = this.selectedVoice?.name ?? 'default';
    try {
      const gen = this.generation;
      const utterance = this.createUtterance(text, kind);
      const spoken = new Promise<string>((resolve) => {
        utterance.onstart = () => resolve('started');
        utterance.onend = () => resolve('ended');
        utterance.onerror = (event) => resolve(`error ${event.error}`);
      });
      this.synth.cancel();
      this.synth.speak(utterance);
      const outcome = await Promise.race([spoken, wait(1500).then(() => 'timeout')]);
      const speaking = this.synth.speaking;
      this.synth.cancel();
      if (gen === this.generation) this.speaking = false;
      return `tts: ${outcome} speaking=${speaking} voice=${voiceName} voices=${voices.length}`;
    } catch (err) {
      return `tts: FAIL ${err instanceof Error ? err.message : String(err)} voices=${voices.length}`;
    }
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
    if (this.clipSource) {
      try {
        this.clipSource.stop();
      } catch {
        /* already stopped */
      }
      try {
        this.clipSource.disconnect();
      } catch {
        /* already disconnected */
      }
      this.clipSource = null;
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
  engine?: 'webaudio' | 'html' | null;
  cache?: 'memory' | 'network';
  duration?: number;
  contextDelta?: number;
  analyserPeak?: number;
  lastTest?: AudioTestResult;
}

function exposeAudioDebug(partial: AudioDebugState): void {
  if (typeof window === 'undefined') return;
  const w = window as unknown as { __srAudio?: AudioDebugState };
  w.__srAudio = { ...(w.__srAudio || {}), ...partial };
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
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
