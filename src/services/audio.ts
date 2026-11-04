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
 * Two stacked reasons 🔊 was silent while Zib <video> had sound:
 *
 * 1. The voice catalog was digital silence. gen-voice applied
 *    `afade=t=out:d=0.04` WITHOUT st=, so ffmpeg faded to 0 at t=0 and
 *    left the rest of every clip at gain 0 (max_volume -91 dB). Decode
 *    succeeded, duration was real, HTML currentTime advanced, play()
 *    resolved — and nobody heard anything. TTS never ran because the
 *    clip "succeeded".
 *
 * 2. On Chrome/Windows the shared AudioContext can report state=running
 *    while currentTime barely moves (Brian: 0.05s in 600ms) and the
 *    analyser stays at 0. That context can also duck HTML/TTS. Video
 *    uses a different pipeline so it still has sound.
 *
 * Unlock used to play a WAV at volume=0.01 (throwaway, not reused).
 * Settings never applied a volume, but getSettings used to return raw
 * JSON (missing keys / leftover volume: 0).
 *
 * Robust path: Web Audio with an explicit GainNode at 1. After ~400ms, if
 * the context clock barely moved OR the analyser is silent, CLOSE the
 * context (stop ducking) and play a FRESH HTMLAudioElement with
 * volume=1, muted=false. Word timings then use element.currentTime.
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
import { mergeDeviceSettings } from './storage';
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
  beep: string;
  zib: string;
  control: string;
  settings: string;
}

const DEFAULT_TTS_CONFIG: TTSConfig = {
  engine: 'prerecorded',
  rate: 0.95,
  pitch: 1.0
};

/** Hard-coded output gain. Never read a volume from settings (0 / NaN = silence). */
const PLAYBACK_GAIN = 1;
const BEEP_GAIN = 0.3;
const WATCHDOG_MS = 400;
const MIN_CONTEXT_DELTA = 0.15;
const MIN_ANALYSER_PEAK = 2;

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
  /** Parent Settings: beep + one Zib clip + one Mission Control clip. */
  runAudioTest(): Promise<AudioTestResult>;
  /** 440Hz oscillator — does Web Audio reach the speakers at all? */
  runBeepTest(): Promise<string>;
}

class WebSpeechAudioService implements AudioService {
  private synth: SpeechSynthesis;
  private config: TTSConfig;
  private speaking = false;
  private selectedVoice: SpeechSynthesisVoice | null = null;
  private clipAudio: HTMLAudioElement | null = null;
  private clipSource: AudioBufferSourceNode | null = null;
  private outputGain: GainNode | null = null;
  private clipTimer: ReturnType<typeof setInterval> | null = null;
  private manifest: VoiceManifest | null = null;
  private manifestPromise: Promise<VoiceManifest | null> | null = null;
  private generation = 0;
  /** True only after Web Audio produced a moving clock AND analyser signal. */
  private webaudioOk = false;
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

  /**
   * Close a stalled/silent AudioContext so it cannot duck HTML audio or TTS.
   * Does NOT bump generation — the caller still wants to play via HTML.
   */
  private abandonWebAudio(reason: string): void {
    console.info('[speak] abandon webaudio', reason);
    this.stopClip();
    const ctx = this.ctx;
    this.ctx = null;
    this.outputGain = null;
    this.bufferCache.clear();
    if (ctx && ctx.state !== 'closed') {
      void ctx.suspend().then(() => ctx.close()).catch(() => {
        try {
          void ctx.close();
        } catch {
          /* already closed */
        }
      });
    }
  }

  unlock(): void {
    // App.tsx calls unlock() on the first pointerdown anywhere (math keypad,
    // parent 👤, …). That AudioContext can sit "running" with a stalled
    // clock on Chrome/Windows and then duck HTML/TTS. If we have never
    // actually heard Web Audio, recreate the context on this gesture.
    if (this.ctx && !this.webaudioOk) {
      this.abandonWebAudio('recreate ctx on unlock — never got a signal');
    }
    this.ensureCtx();
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }

    // Do NOT play a volume=0.01 HTML element. A 1-sample buffer at gain 1
    // resumes the graph without training Chrome to treat this tab as quiet.
    const ctx = this.ctx;
    if (ctx) {
      try {
        const buf = ctx.createBuffer(1, 1, ctx.sampleRate);
        const src = ctx.createBufferSource();
        const gain = ctx.createGain();
        gain.gain.value = PLAYBACK_GAIN;
        src.buffer = buf;
        src.connect(gain);
        gain.connect(ctx.destination);
        src.start(0);
        void ctx.resume();
        console.info('[speak] audio unlocked', ctx.state);
      } catch (err) {
        console.info('[speak] AudioContext unlock failed', err);
      }
    }
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
    utterance.volume = 1;
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
      exposeAudioDebug({
        currentTime: audio.currentTime,
        playing: true,
        engine: 'html',
        htmlVolume: audio.volume,
        htmlMuted: audio.muted
      });
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
   * fetch → decode → GainNode(1) → BufferSource. After WATCHDOG_MS, reject
   * if the clock stalled or the analyser is silent so the caller can close
   * this context and use HTML.
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

    const peakSample = bufferPeak(buffer);
    if (peakSample < 0.01) {
      throw new Error(`decoded buffer is silent peak=${peakSample.toFixed(4)}`);
    }

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    const gain = ctx.createGain();
    gain.gain.value = PLAYBACK_GAIN;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(gain);
    gain.connect(analyser);
    analyser.connect(ctx.destination);
    this.clipSource = source;
    this.outputGain = gain;
    this.speaking = true;
    const startedAt = ctx.currentTime;
    exposeAudioDebug({
      file: clip.file,
      error: null,
      playing: true,
      engine: 'webaudio',
      currentTime: 0,
      cache,
      duration: buffer.duration,
      gain: PLAYBACK_GAIN,
      bufferPeak: peakSample
    });

    const clearWords = this.fireWordTimingsCtx(startedAt, clip.words, gen, onWord);

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      let watchdog = 0;

      const succeed = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(watchdog);
        clearWords();
        if (this.clipSource === source) this.clipSource = null;
        if (this.outputGain === gain) this.outputGain = null;
        if (gen === this.generation) this.speaking = false;
        exposeAudioDebug({
          currentTime: ctx.currentTime - startedAt,
          playing: false,
          error: null,
          engine: 'webaudio'
        });
        resolve();
      };

      const fail = (reason: string) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(watchdog);
        clearWords();
        try {
          source.stop();
        } catch {
          /* already stopped */
        }
        if (this.clipSource === source) this.clipSource = null;
        if (this.outputGain === gain) this.outputGain = null;
        exposeAudioDebug({ error: reason, playing: false, engine: 'webaudio' });
        reject(new Error(reason));
      };

      source.onended = succeed;
      try {
        source.start(0);
      } catch (err) {
        fail(err instanceof Error ? err.message : String(err));
        return;
      }

      watchdog = window.setTimeout(() => {
        if (settled) return;
        const delta = ctx.currentTime - startedAt;
        const peak = analyserPeak(analyser);
        exposeAudioDebug({ contextDelta: delta, analyserPeak: peak });
        if (delta < MIN_CONTEXT_DELTA || peak < MIN_ANALYSER_PEAK) {
          fail(`webaudio silent delta=${delta.toFixed(2)} analyser=${peak}`);
        } else {
          this.webaudioOk = true;
        }
      }, WATCHDOG_MS);
    });
  }

  /**
   * Fresh HTMLAudioElement. Always volume=1, muted=false, never reused
   * after the old silent-unlock WAV. play() runs in the executor so it
   * stays in the same turn when this is the first path.
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
      audio.volume = 1;
      audio.muted = false;
      audio.setAttribute('playsinline', 'true');
      audio.setAttribute('data-sr-voice', '1');
      document.body.appendChild(audio);
      this.clipAudio = audio;
      this.speaking = true;
      exposeAudioDebug({
        file: clip.file,
        error: null,
        engine: 'html',
        playing: false,
        htmlVolume: audio.volume,
        htmlMuted: audio.muted
      });
      console.info('[speak] html play', clip.file, 'volume', audio.volume, 'muted', audio.muted);

      const clearWords = this.fireWordTimingsHtml(audio, clip.words, gen, onWord);

      const detach = () => {
        if (audio.parentNode) audio.parentNode.removeChild(audio);
      };

      let settled = false;
      const succeed = () => {
        if (settled) return;
        settled = true;
        clearWords();
        detach();
        if (this.clipAudio === audio) this.clipAudio = null;
        if (gen === this.generation) this.speaking = false;
        exposeAudioDebug({
          currentTime: audio.currentTime,
          error: null,
          engine: 'html',
          playing: false,
          htmlVolume: audio.volume,
          htmlMuted: audio.muted
        });
        resolve();
      };

      const fail = (reason: string) => {
        if (settled) return;
        settled = true;
        clearWords();
        detach();
        if (this.clipAudio === audio) this.clipAudio = null;
        if (gen === this.generation) this.speaking = false;
        exposeAudioDebug({
          currentTime: audio.currentTime,
          error: reason,
          engine: 'html',
          playing: false,
          htmlVolume: audio.volume,
          htmlMuted: audio.muted
        });
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
          exposeAudioDebug({
            currentTime: audio.currentTime,
            error: null,
            playing: true,
            engine: 'html',
            htmlVolume: audio.volume,
            htmlMuted: audio.muted
          });
        })
        .catch((err: DOMException) => {
          const reason = `${err?.name || 'PlayError'}: ${err?.message || 'audio.play() rejected'}`;
          console.info('[speak] play() failed', reason, clip.file);
          fail(reason);
        });
    });
  }

  /**
   * Try Web Audio. If the clock stalls or the analyser is silent, close the
   * context (it ducks HTML/TTS on Chrome Windows) and play a fresh <audio>.
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
        const reason = err instanceof Error ? err.message : String(err);
        console.info('[speak] webaudio failed', clip.file, reason);
        if (gen !== this.generation) return;
        // Silent decoded buffers are silent as HTML too — skip to TTS.
        if (/silent/i.test(reason)) {
          this.abandonWebAudio(reason);
          throw err;
        }
        this.abandonWebAudio(reason);
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
   * Real evidence for Brian — beep, buffer peak, gain, element volume/muted,
   * stored settings, fetch/decode, and whether playback advanced.
   */
  async runAudioTest(): Promise<AudioTestResult> {
    this.unlock();
    await this.ensureManifest();

    const result: AudioTestResult = {
      beep: 'not run',
      zib: 'not run',
      control: 'not run',
      settings: dumpSettings()
    };

    result.beep = await this.probeBeep();
    result.zib = await this.probeClip('zib', ZIB.helloTeach);
    result.control = await this.probeClip('control', UI.whoIsPlaying);
    result.settings = dumpSettings();

    exposeAudioDebug({ lastTest: result });
    return result;
  }

  async runBeepTest(): Promise<string> {
    this.unlock();
    return this.probeBeep();
  }

  /** 440Hz oscillator at 0.3 gain for 1s — does Web Audio reach the speakers? */
  private async probeBeep(): Promise<string> {
    const lines: string[] = ['440Hz sine gain=0.3 for 1s'];
    this.unlock();
    const ctx = this.ensureCtx();
    if (!ctx) return 'beep: FAIL no AudioContext';
    try {
      await ctx.resume();
    } catch (err) {
      lines.push(`resume: FAIL ${err instanceof Error ? err.message : String(err)}`);
    }
    lines.push(`ctx: ${ctx.state} sampleRate=${ctx.sampleRate} baseLatency=${ctx.baseLatency?.toFixed?.(4) ?? '?'}`);

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    const gain = ctx.createGain();
    gain.gain.value = BEEP_GAIN;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 440;
    osc.connect(gain);
    gain.connect(analyser);
    analyser.connect(ctx.destination);
    this.outputGain = gain;

    try {
      const t0 = ctx.currentTime;
      osc.start();
      await wait(1000);
      const delta = ctx.currentTime - t0;
      const peak = analyserPeak(analyser);
      try {
        osc.stop();
      } catch {
        /* already stopped */
      }
      const clockOk = delta > 0.3;
      const signalOk = peak > 2;
      lines.push(`gain: ${BEEP_GAIN}`);
      lines.push(
        `advanced: contextDelta=${delta.toFixed(2)}s ${clockOk ? 'PASS' : 'FAIL'} (need >0.3s after 1s)`
      );
      lines.push(`analyserPeak: ${peak} ${signalOk ? 'PASS signal' : 'WARN silent-or-no-sink'}`);
      if (!clockOk || !signalOk) {
        this.abandonWebAudio(`beep silent delta=${delta.toFixed(2)} analyser=${peak}`);
        lines.push('RESULT: FAIL (closed AudioContext so it cannot duck HTML)');
      } else {
        this.webaudioOk = true;
        lines.push('RESULT: PASS (you should have heard a beep)');
      }
      return lines.join('\n');
    } catch (err) {
      this.abandonWebAudio('beep threw');
      return `beep: FAIL ${err instanceof Error ? err.message : String(err)}`;
    }
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
    lines.push(`gain: ${PLAYBACK_GAIN}`);

    let raw: ArrayBuffer | null = null;
    try {
      const res = await fetch(url, { cache: 'no-store' });
      raw = await res.arrayBuffer();
      const bytes = raw.byteLength;
      const contentRange = res.headers.get('content-range');
      const contentType = res.headers.get('content-type') || '';
      lines.push(
        `fetch: ${res.status} ${bytes} bytes type=${contentType || '?'}` +
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
      const peakSample = bufferPeak(decoded);
      lines.push(
        `decode: OK duration=${decoded.duration.toFixed(2)}s ` +
          `channels=${decoded.numberOfChannels} rate=${decoded.sampleRate}`
      );
      lines.push(
        `bufferPeak: ${peakSample.toFixed(4)} ${peakSample > 0.01 ? 'PASS has audio' : 'FAIL silent buffer'}`
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
    const gain = ctx.createGain();
    gain.gain.value = PLAYBACK_GAIN;
    const source = ctx.createBufferSource();
    source.buffer = decoded;
    source.connect(gain);
    gain.connect(analyser);
    analyser.connect(ctx.destination);
    this.clipSource = source;
    this.outputGain = gain;
    this.speaking = true;
    exposeAudioDebug({
      file: clip.file,
      engine: 'webaudio',
      playing: true,
      duration: decoded.duration,
      gain: PLAYBACK_GAIN,
      bufferPeak: bufferPeak(decoded),
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
      peak = analyserPeak(analyser);
      lines.push('engine: webaudio');
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
        analyserPeak: peak,
        gain: PLAYBACK_GAIN
      });
    } catch (err) {
      lines.push(`play: FAIL ${err instanceof Error ? err.message : String(err)}`);
      this.abandonWebAudio('probe play threw');
      lines.push(await this.probeHtml(url));
      lines.push(await this.probeTts(text, kind));
      return lines.join('\n');
    }

    const silentOut = !advanced || peak < MIN_ANALYSER_PEAK;
    if (silentOut) {
      try {
        source.stop();
      } catch {
        /* already stopped */
      }
      this.abandonWebAudio(
        `probe silent delta=${delta.toFixed(2)} analyser=${peak}`
      );
      lines.push(await this.probeHtml(url));
      lines.push(await this.probeTts(text, kind));
      return lines.join('\n');
    }

    const remainingMs = Math.max(0, Math.min(decoded.duration * 1000 - 600, 10000));
    await Promise.race([ended, wait(remainingMs + 200)]);
    if (this.clipSource === source) this.clipSource = null;
    if (gen === this.generation) this.speaking = false;
    this.webaudioOk = true;
    lines.push('RESULT: PASS (clip played via webaudio)');
    return lines.join('\n');
  }

  private async probeHtml(url: string): Promise<string> {
    try {
      const audio = new Audio(url);
      audio.preload = 'auto';
      audio.volume = 1;
      audio.muted = false;
      audio.setAttribute('playsinline', 'true');
      document.body.appendChild(audio);
      this.clipAudio = audio;
      await audio.play();
      await wait(600);
      const t = audio.currentTime;
      const err = audio.error;
      const vol = audio.volume;
      const muted = audio.muted;
      const ok = t > 0.3 && !err && vol > 0.5 && !muted;
      // Keep playing so Brian actually hears it (do not pause at 600ms).
      const remain = Math.max(0, Math.min(((audio.duration || 3) - t) * 1000, 8000));
      await wait(remain);
      audio.pause();
      audio.src = '';
      if (audio.parentNode) audio.parentNode.removeChild(audio);
      if (this.clipAudio === audio) this.clipAudio = null;
      return (
        `html: currentTime=${t.toFixed(2)}s volume=${vol} muted=${muted} ` +
        `${ok ? 'PASS' : 'FAIL'}` +
        (err ? ` error=${err.code} ${err.message}` : '') +
        (ok ? ' RESULT: PASS (html fallback)' : '')
      );
    } catch (err) {
      const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      return `html: FAIL ${msg} volume=? muted=?`;
    }
  }

  private async probeTts(text: string, kind: VoiceKind): Promise<string> {
    if (!this.synth) return 'tts: UNAVAILABLE (no speechSynthesis)';
    const voices = this.synth.getVoices();
    const voiceName = this.selectedVoice?.name ?? 'default';
    try {
      const gen = this.generation;
      const utterance = this.createUtterance(text, kind);
      utterance.volume = 1;
      const spoken = new Promise<string>((resolve) => {
        utterance.onstart = () => resolve('started');
        utterance.onend = () => resolve('ended');
        utterance.onerror = (event) => resolve(`error ${event.error}`);
      });
      this.synth.cancel();
      this.synth.speak(utterance);
      const outcome = await Promise.race([spoken, wait(2000).then(() => 'timeout')]);
      const speaking = this.synth.speaking;
      // Give it a moment to be audible before we cancel for the next probe.
      if (speaking) await wait(800);
      this.synth.cancel();
      if (gen === this.generation) this.speaking = false;
      return `tts: ${outcome} speaking=${speaking} volume=1 voice=${voiceName} voices=${voices.length}`;
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
    if (this.outputGain) {
      try {
        this.outputGain.disconnect();
      } catch {
        /* already disconnected */
      }
      this.outputGain = null;
    }
    if (this.clipAudio) {
      this.clipAudio.pause();
      this.clipAudio.src = '';
      if (this.clipAudio.parentNode) this.clipAudio.parentNode.removeChild(this.clipAudio);
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
  gain?: number;
  bufferPeak?: number;
  htmlVolume?: number;
  htmlMuted?: boolean;
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

function bufferPeak(buffer: AudioBuffer): number {
  let peak = 0;
  for (let c = 0; c < buffer.numberOfChannels; c += 1) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < data.length; i += 1) {
      const v = Math.abs(data[i]);
      if (v > peak) peak = v;
    }
  }
  return peak;
}

function analyserPeak(analyser: AnalyserNode): number {
  const data = new Uint8Array(analyser.fftSize);
  analyser.getByteTimeDomainData(data);
  let peak = 0;
  for (let i = 0; i < data.length; i += 1) {
    peak = Math.max(peak, Math.abs(data[i] - 128));
  }
  return peak;
}

function dumpSettings(): string {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return 'settings: n/a';
  }
  let raw: unknown = null;
  try {
    raw = JSON.parse(localStorage.getItem('space_readers_settings') || 'null');
  } catch {
    raw = 'PARSE_ERROR';
  }
  const merged = mergeDeviceSettings(raw);
  return (
    `settings raw: ${JSON.stringify(raw)}\n` +
    `settings merged: ${JSON.stringify(merged)}`
  );
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
    runAudioTest: async () => ({
      beep: 'noop',
      zib: 'noop',
      control: 'noop',
      settings: 'noop'
    }),
    runBeepTest: async () => 'noop'
  };
}

let audioServiceInstance: AudioService | null = null;

export function getAudioService(): AudioService {
  if (!audioServiceInstance) {
    audioServiceInstance = createAudioService();
  }
  return audioServiceInstance;
}
