/**
 * Voice-clip lookup helpers shared by the runtime speak() path and
 * scripts/gen-voice.mjs (keep the key format in sync).
 *
 * Two recorded voices, plus phoneme MP3s on the decoder slider:
 *   zib     — edge-tts en-US-BrianNeural, pitch +18Hz, rate +6%, light echo
 *   control — edge-tts en-US-AndrewNeural, subtle radio EQ (UI / briefing)
 *   story   — edge-tts en-US-AndrewNeural, no EQ (sentences + Say Word)
 *
 * Never send letter names to TTS. Spelled sequences like M-U-G stay silent;
 * the decoder slider uses isolated phoneme clips instead.
 */

export type VoiceKind = 'zib' | 'control' | 'story';

export interface VoiceWordTiming {
  text: string;
  offsetMs: number;
  charIndex: number;
}

export interface VoiceClipMeta {
  file: string;
  durationMs: number;
  words: VoiceWordTiming[];
}

export interface VoiceManifest {
  version: number;
  clips: Record<string, VoiceClipMeta>;
}

export function normalizeVoiceText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Drop spelled-out letter names (M-U-G, F-I-SH) so they are never spoken.
 * Phoneme playback stays on public/audio/phonemes/*.mp3.
 */
export function stripLetterNames(text: string): string {
  return text
    .replace(/\b[A-Za-z](?:-[A-Za-z])+\b/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,!?;:])/g, '$1')
    .replace(/^[.,!?;:]+\s*/g, '')
    .trim();
}

/** Manifest key: voice kind + normalized text the UI passes to speak(). */
export function voiceLookupKey(kind: VoiceKind, text: string): string {
  return `${kind}|${normalizeVoiceText(text)}`;
}

const NOVELTY = [
  'zarvox', 'whisper', 'trinoids', 'boing', 'bells', 'bubbles', 'bad news',
  'good news', 'cellos', 'superstar', 'jester', 'organ', 'wobble', 'robot',
  'novelty', 'kathy', 'victoria', 'samantha', 'zira', 'karen', 'moira',
  'tessa', 'fiona', 'veena', 'princess', 'grandma', 'grandpa'
];

const PREFERRED_MALE = [
  'andrew', 'guy', 'davis', 'google us english male', 'microsoft david',
  'daniel', 'aaron', 'jason', 'tony', 'steffan'
];

export function pickMaleFallbackVoice(
  voices: SpeechSynthesisVoice[]
): SpeechSynthesisVoice | null {
  const english = voices.filter((v) => v.lang.toLowerCase().startsWith('en'));
  const usable = english.filter((v) => {
    const n = v.name.toLowerCase();
    return !NOVELTY.some((bad) => n.includes(bad));
  });

  for (const preferred of PREFERRED_MALE) {
    const found = usable.find((v) => v.name.toLowerCase().includes(preferred));
    if (found) return found;
  }

  const namedMale = usable.find((v) => /male/i.test(v.name) && /en-?us/i.test(`${v.lang} ${v.name}`));
  if (namedMale) return namedMale;

  const anyMale = usable.find((v) => /male/i.test(v.name));
  if (anyMale) return anyMale;

  return usable.find((v) => v.lang.toLowerCase().startsWith('en-us')) ?? usable[0] ?? null;
}
