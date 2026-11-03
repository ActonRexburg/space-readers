/**
 * Isolated phoneme clips in public/audio/phonemes/{key}.mp3
 *
 * Keys match Grapheme.phoneme from the phonics breaker (and lowercase grapheme text).
 * If a key is missing from this set, the decoder plays silence — never a letter name.
 */
export const PHONEME_CLIP_KEYS = new Set([
  // consonants
  'b', 'c', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm', 'n', 'p', 'q', 'r', 's', 't', 'v', 'w', 'x', 'y', 'z',
  // digraphs / trigraphs
  'sh', 'ch', 'th', 'wh', 'ph', 'ck', 'ng', 'qu', 'tch', 'dge', 'igh',
  // short vowels
  'a', 'e', 'i', 'o', 'u',
  // magic e
  'a_e', 'e_e', 'i_e', 'o_e', 'u_e',
  // vowel teams
  'ai', 'ay', 'ea', 'ee', 'ie', 'oa', 'oe', 'ow', 'oo', 'ou', 'oi', 'oy', 'ue', 'ew', 'au', 'aw',
  // r-controlled
  'ar', 'er', 'ir', 'or', 'ur',
]);

export function phonemeClipKey(phoneme: string, text: string): string | null {
  const fromPhoneme = phoneme.toLowerCase().trim();
  if (fromPhoneme && PHONEME_CLIP_KEYS.has(fromPhoneme)) {
    return fromPhoneme;
  }
  const fromText = text.toLowerCase().replace(/[^a-z]/g, '');
  if (fromText && PHONEME_CLIP_KEYS.has(fromText)) {
    return fromText;
  }
  return null;
}
