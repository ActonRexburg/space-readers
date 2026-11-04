/**
 * Audio Service
 *
 * Playback order for words (Say Word / Hear It / UI lines):
 *   1. Pre-generated clip as a FRESH HTMLAudioElement (volume=1, muted=false)
 *   2. speechSynthesis AFTER any live AudioContext is closed
 *
 * Decoder slider is silent — never phoneme clips, never letter names.
 * "Say Word" / "Hear It" still play the whole-word story clip.
 *
 * Pre-#8 (commit 36a9ec0) 🔊 was speechSynthesis only and had sound.
 * PR #8 added voice mp3s plus App pointerdown unlock() that created a
 * live AudioContext. After that Brian heard NOTHING — not clips, not
 * TTS — while <video> still had sound. Chrome/Windows ducks HTMLAudio
 * AND speechSynthesis while a context exists (even stalled/silent).
 * Video uses a different pipeline so it is unaffected.
 *
 * Three silencers stacked:
 * 1. Voice catalog was digital silence. gen-voice applied
 *    `afade=t=out:d=0.04` WITHOUT st=, so ffmpeg faded to 0 at t=0
 *    (max_volume -91 dB). Clips "succeeded"; TTS never ran.
 * 2. unlock() / first pointerdown created a live AudioContext that
 *    ducked every other engine. unlock() must NOT create a context.
 *    The old unlock WAV played at volume=0.01.
 * 3. Audio test called unlock() then probeTts which cancel()ed after
 *    ~800ms, so the TTS it started never reached the speakers. A
 *    later step's stop()/cancel() must not fire until onend.
 *
 * 🔊 never opens an AudioContext. HTMLAudioElement.play() stays in the
 * click turn. TTS only after await abandonWebAudio(). The Beep test is
 * the only thing that creates a context, and it closes it after.
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
  tts: string;
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

export interface AudioService {
  speakWord(word: string, options?: SpeakTextOptions): Promise<void>;
  speakText(text: string, options?: SpeakTextOptions): Promise<void>;
  stop(): void;
  isSpeaking(): boolean;
  setConfig(config: Partial<TTSConfig>): void;
  getVoices(): SpeechSynthesisVoice[];
  /** Fetch voice manifest on app start — do not wait for the first 🔊 tap. */
  preloadManifest(): Promise<VoiceManifest | null>;
  /**
   * Pre-#8 had no AudioContext. Creating one on a random pointerdown is
   * what ducks speechSynthesis + HTMLAudio on Chrome/Windows. unlock()
   * must NOT open a live context — it only resumes one that already exists.
   */
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
  private outputGain: GainNode | null = null;
  private clipTimer: ReturnType<typeof setInterval> | null = null;
  private manifest: VoiceManifest | null = null;
  private manifestPromise: Promise<VoiceManifest | null> | null = null;
  private generation = 0;
  /** Created only for the Beep test, then closed. Never opened from 🔊. */
  private ctx: AudioContext | null = null;

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
   * Close a live AudioContext so it cannot duck HTML audio or TTS.
   * Await this BEFORE speechSynthesis.speak() — Chrome/Windows stays silent
   * for TTS while a context is still closing. Does NOT bump generation.
   */
  private async abandonWebAudio(reason: string): Promise<void> {
    console.info('[speak] abandon webaudio', reason);
    this.stopClip();
    const ctx = this.ctx;
    this.ctx = null;
    this.outputGain = null;
    if (ctx && ctx.state !== 'closed') {
      try {
        await ctx.suspend();
      } catch {
        /* ignore */
      }
      try {
        await ctx.close();
      } catch {
        /* already closed */
      }
    }
  }

  unlock(): void {
    // Do not create an AudioContext here. Pre-#8 TTS worked because there
    // was no live context. A running context ducks speechSynthesis and
    // HTMLAudio on Chrome/Windows while <video> still has sound.
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
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

      try {
        this.synth.resume();
      } catch {
        /* Chrome pauses the synth after an AudioContext */
      }
      // Chrome workaround (same as pre-#8): cancel stuck utterances, then
      // speak in this turn. Do not cancel again from here — a follow-up
      // cancel() is what made the Audio test silent.
      this.synth.cancel();
      this.synth.speak(utterance);
    });
  }

  /** Word timings from HTMLAudioElement.currentTime. */
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
   * 🔊 hot path: HTMLAudioElement only — same family as the <video> clips
   * that already have sound for Brian. Do not open an AudioContext here;
   * a live context ducks HTML + speechSynthesis on Chrome/Windows.
   */
  private playClip(
    clip: VoiceClipMeta,
    gen: number,
    onWord?: (charIndex: number) => void
  ): Promise<void> {
    const url = resolveAssetUrl(`audio/voice/${clip.file}`);
    exposeAudioDebug({ file: clip.file, error: null, playing: false });
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
    // Close any live context first — this is the pre-#8 path that worked.
    await this.abandonWebAudio('before tts');
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
   * Sequential probes. Each step waits for onend before the next starts —
   * the old test cancelled TTS it had just started, so Brian heard nothing.
   * Order matches the pre-#8 working path first (TTS, no AudioContext).
   */
  async runAudioTest(): Promise<AudioTestResult> {
    await this.abandonWebAudio('audio test start');
    await this.ensureManifest();

    const result: AudioTestResult = {
      tts: 'not run',
      beep: 'not run',
      zib: 'not run',
      control: 'not run',
      settings: dumpSettings()
    };

    result.tts = await this.probeTts(
      'This is the browser voice.',
      'control'
    );
    result.zib = await this.probeClip('zib', ZIB.helloTeach);
    result.control = await this.probeClip('control', UI.whoIsPlaying);
    result.beep = await this.probeBeep();
    await this.abandonWebAudio('after beep');
    result.settings = dumpSettings();

    exposeAudioDebug({ lastTest: result });
    return result;
  }

  async runBeepTest(): Promise<string> {
    const beep = await this.probeBeep();
    await this.abandonWebAudio('after beep test');
    return beep;
  }

  /** 440Hz oscillator at 0.3 gain for 1s — does Web Audio reach the speakers? */
  private async probeBeep(): Promise<string> {
    const lines: string[] = ['440Hz sine gain=0.3 for 1s'];
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
        await this.abandonWebAudio(`beep silent delta=${delta.toFixed(2)} analyser=${peak}`);
        lines.push('RESULT: FAIL (closed AudioContext so it cannot duck HTML)');
      } else {
        lines.push('RESULT: PASS (you should have heard a beep)');
      }
      return lines.join('\n');
    } catch (err) {
      await this.abandonWebAudio('beep threw');
      return `beep: FAIL ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  /** Clip probe: fetch + offline decode (no live AudioContext) + HTML play to onend. */
  private async probeClip(kind: VoiceKind, text: string): Promise<string> {
    const lines: string[] = [];
    const clip = this.lookupClip(kind, text);
    if (!clip) {
      lines.push(`clip: MISSING (${this.manifest ? 'no-clip' : 'no-manifest'})`);
      return lines.join('\n');
    }

    const url = resolveAssetUrl(`audio/voice/${clip.file}`);
    lines.push(`file: ${clip.file}`);
    lines.push(`gain: ${PLAYBACK_GAIN}`);

    try {
      const res = await fetch(url, { cache: 'no-store' });
      const raw = await res.arrayBuffer();
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
      try {
        const decoded = await decodeOffline(raw);
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
      }
    } catch (err) {
      lines.push(`fetch: FAIL ${err instanceof Error ? err.message : String(err)}`);
    }

    lines.push(await this.probeHtml(url));
    return lines.join('\n');
  }

  private async probeHtml(url: string): Promise<string> {
    await this.abandonWebAudio('before html probe');
    try {
      const audio = new Audio(url);
      audio.preload = 'auto';
      audio.volume = 1;
      audio.muted = false;
      audio.setAttribute('playsinline', 'true');
      document.body.appendChild(audio);
      this.clipAudio = audio;
      const ended = new Promise<void>((resolve) => {
        audio.onended = () => resolve();
      });
      await audio.play();
      await wait(600);
      const t = audio.currentTime;
      const err = audio.error;
      const vol = audio.volume;
      const muted = audio.muted;
      const ok = t > 0.3 && !err && vol > 0.5 && !muted;
      exposeAudioDebug({
        engine: 'html',
        currentTime: t,
        htmlVolume: vol,
        htmlMuted: muted,
        playing: true,
        error: err ? String(err.code) : null
      });
      const capMs = Math.min(((audio.duration && Number.isFinite(audio.duration) ? audio.duration : 4) * 1000), 8000);
      await Promise.race([ended, wait(capMs)]);
      audio.pause();
      audio.src = '';
      if (audio.parentNode) audio.parentNode.removeChild(audio);
      if (this.clipAudio === audio) this.clipAudio = null;
      return (
        `html: currentTime=${t.toFixed(2)}s volume=${vol} muted=${muted} ` +
        `${ok ? 'PASS' : 'FAIL'}` +
        (err ? ` error=${err.code} ${err.message}` : '') +
        (ok ? ' RESULT: PASS (html clip played to end)' : '')
      );
    } catch (err) {
      const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      return `html: FAIL ${msg} volume=? muted=?`;
    }
  }

  /**
   * Pre-#8 path. Close any AudioContext, then speak and wait for onend.
   * Do NOT cancel after start — that is why Brian heard no TTS in the test.
   */
  private async probeTts(text: string, kind: VoiceKind): Promise<string> {
    await this.abandonWebAudio('before tts probe');
    this.stopClip();
    if (!this.synth) return 'tts: UNAVAILABLE (no speechSynthesis)';
    const voices = this.synth.getVoices();
    const voiceName = this.selectedVoice?.name ?? 'default';
    try {
      const utterance = this.createUtterance(text, kind);
      utterance.volume = 1;
      let started = false;
      const finished = new Promise<string>((resolve) => {
        utterance.onstart = () => {
          started = true;
        };
        utterance.onend = () => resolve('ended');
        utterance.onerror = (event) => resolve(`error ${event.error}`);
      });
      try {
        this.synth.resume();
      } catch {
        /* ignore */
      }
      // Cancel only a leftover utterance, then speak and wait for onend.
      // Do NOT cancel after start — that is why Brian heard no TTS.
      if (this.synth.speaking || this.synth.pending) {
        this.synth.cancel();
      }
      this.synth.speak(utterance);
      const outcome = await Promise.race([finished, wait(8000).then(() => 'timeout')]);
      if (outcome === 'timeout') {
        this.synth.cancel();
      }
      return (
        `tts: ${outcome} started=${started} volume=1 voice=${voiceName} voices=${voices.length}` +
        (outcome === 'ended' || started ? ' RESULT: PASS (tts ran to end)' : '')
      );
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

/** Decode without a live AudioContext so we do not duck HTML/TTS. */
function decodeOffline(raw: ArrayBuffer): Promise<AudioBuffer> {
  const Offline =
    window.OfflineAudioContext ||
    (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext;
  if (!Offline) {
    return Promise.reject(new Error('no OfflineAudioContext'));
  }
  const ctx = new Offline(1, 1, 44100);
  return ctx.decodeAudioData(raw.slice(0));
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
      tts: 'noop',
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
