/**
 * Phonics Utility Service
 * 
 * Handles breaking words into graphemes (sound units) for the decoder.
 * Uses pattern matching for common English phonics patterns.
 */

import type { DecodableWord, Grapheme } from '../types';

// Common digraphs and trigraphs (multi-letter sounds)
const DIGRAPHS = ['sh', 'ch', 'th', 'wh', 'ph', 'ck', 'ng', 'qu'];
const TRIGRAPHS = ['tch', 'dge', 'igh'];

// Vowel teams and diphthongs
const VOWEL_TEAMS = ['ai', 'ay', 'ea', 'ee', 'ie', 'oa', 'oe', 'ow', 'oo', 'ou', 'oi', 'oy', 'ue', 'ew', 'au', 'aw'];

// R-controlled vowels
const R_CONTROLLED = ['ar', 'er', 'ir', 'or', 'ur'];

// Silent e patterns (for display, the 'e' is grouped with prior vowel)
const MAGIC_E_CONSONANTS = ['b', 'c', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm', 'n', 'p', 'r', 's', 't', 'v', 'w', 'x', 'z'];

// Common sight words that should be memorized rather than decoded
const SIGHT_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
  'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used',
  'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as',
  'into', 'through', 'during', 'before', 'after', 'above', 'below',
  'between', 'under', 'again', 'further', 'then', 'once',
  'here', 'there', 'where', 'when', 'why', 'how', 'all', 'each',
  'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such',
  'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
  'just', 'also', 'now', 'I', 'me', 'my', 'we', 'us', 'our',
  'you', 'your', 'he', 'him', 'his', 'she', 'her', 'it', 'its',
  'they', 'them', 'their', 'what', 'which', 'who', 'whom',
  'this', 'that', 'these', 'those', 'am', 'said', 'one', 'two',
  'come', 'some', 'give', 'live', 'love', 'move', 'put', 'pull', 'push',
  'could', 'would', 'should', 'because', 'friend', 'people', 'know', 'thought'
]);

/**
 * Break a word into its graphemes (sound units)
 */
export function breakIntoGraphemes(word: string): Grapheme[] {
  const graphemes: Grapheme[] = [];
  const lowerWord = word.toLowerCase();
  let i = 0;

  while (i < lowerWord.length) {
    let matched = false;

    // Check for trigraphs first
    if (i + 2 < lowerWord.length) {
      const tri = lowerWord.slice(i, i + 3);
      if (TRIGRAPHS.includes(tri)) {
        graphemes.push({
          text: word.slice(i, i + 3),
          phoneme: tri
        });
        i += 3;
        matched = true;
        continue;
      }
    }

    // Check for magic e pattern: consonant + vowel + consonant + silent e
    if (i + 3 < lowerWord.length) {
      const vowels = 'aeiou';
      if (vowels.includes(lowerWord[i]) && 
          MAGIC_E_CONSONANTS.includes(lowerWord[i + 1]) && 
          lowerWord[i + 2] === 'e' &&
          (i + 3 === lowerWord.length || !vowels.includes(lowerWord[i + 3]))) {
        // This is a magic e pattern - vowel says its name
        graphemes.push({
          text: word.slice(i, i + 1),
          phoneme: `${lowerWord[i]}_e`
        });
        i += 1;
        matched = true;
        continue;
      }
    }

    // Check for digraphs
    if (i + 1 < lowerWord.length) {
      const di = lowerWord.slice(i, i + 2);
      
      // Check digraphs
      if (DIGRAPHS.includes(di)) {
        graphemes.push({
          text: word.slice(i, i + 2),
          phoneme: di
        });
        i += 2;
        matched = true;
        continue;
      }

      // Check vowel teams
      if (VOWEL_TEAMS.includes(di)) {
        graphemes.push({
          text: word.slice(i, i + 2),
          phoneme: di
        });
        i += 2;
        matched = true;
        continue;
      }

      // Check r-controlled vowels
      if (R_CONTROLLED.includes(di)) {
        graphemes.push({
          text: word.slice(i, i + 2),
          phoneme: di
        });
        i += 2;
        matched = true;
        continue;
      }
    }

    // Single letter
    if (!matched) {
      graphemes.push({
        text: word.slice(i, i + 1),
        phoneme: lowerWord[i]
      });
      i += 1;
    }
  }

  return graphemes;
}

/**
 * Determine phonics patterns present in a word
 */
export function identifyPhonicsPatterns(word: string): string[] {
  const patterns: string[] = [];
  const lowerWord = word.toLowerCase();

  // Check CVC pattern
  if (/^[bcdfghjklmnpqrstvwxyz][aeiou][bcdfghjklmnpqrstvwxyz]$/.test(lowerWord)) {
    patterns.push('CVC');
  }

  // Check CVCC pattern
  if (/^[bcdfghjklmnpqrstvwxyz][aeiou][bcdfghjklmnpqrstvwxyz]{2}$/.test(lowerWord)) {
    patterns.push('CVCC');
  }

  // Check CCVC pattern
  if (/^[bcdfghjklmnpqrstvwxyz]{2}[aeiou][bcdfghjklmnpqrstvwxyz]$/.test(lowerWord)) {
    patterns.push('CCVC');
  }

  // Check for digraphs
  for (const digraph of DIGRAPHS) {
    if (lowerWord.includes(digraph)) {
      patterns.push(`digraph-${digraph}`);
    }
  }

  // Check for vowel teams
  for (const team of VOWEL_TEAMS) {
    if (lowerWord.includes(team)) {
      patterns.push(`vowel-team-${team}`);
    }
  }

  // Check for r-controlled vowels
  for (const rc of R_CONTROLLED) {
    if (lowerWord.includes(rc)) {
      patterns.push(`r-controlled-${rc}`);
    }
  }

  // Check magic e pattern
  if (/[aeiou][bcdfghjklmnpqrstvwxyz]e$/.test(lowerWord) && lowerWord.length > 3) {
    patterns.push('magic-e');
  }

  return patterns;
}

/**
 * Create a DecodableWord from a string
 */
export function createDecodableWord(word: string): DecodableWord {
  // Remove punctuation for processing but keep it for display
  const cleanWord = word.replace(/[^a-zA-Z]/g, '');
  
  return {
    word,
    graphemes: breakIntoGraphemes(cleanWord),
    isSightWord: SIGHT_WORDS.has(cleanWord.toLowerCase()),
    phonicsPatterns: identifyPhonicsPatterns(cleanWord)
  };
}

/**
 * Parse a paragraph of text into DecodableWords
 */
export function parseTextToWords(text: string): DecodableWord[] {
  // Keep leading/trailing quotes attached to the word so "'There it is!'" stays one token,
  // not "is!" + a leftover quote that starts a fake next sentence.
  // Hyphens stay on the token so "M-U-G." is one unit (never spoken as letter names).
  const tokens = text.match(/[“”"‘’']*[\w']+(?:-[\w']+)*[.,!?;:]*[“”"‘’']*|[“”"‘’']+/g) || [];

  return tokens
    .filter(token => token.trim().length > 0)
    .map(token => createDecodableWord(token.trim()));
}

/**
 * Get difficulty level based on phonics patterns
 */
export function calculateDifficulty(patterns: string[]): number {
  let difficulty = 1;
  
  // Increase difficulty for more complex patterns
  for (const pattern of patterns) {
    if (pattern === 'CVC') difficulty = Math.max(difficulty, 1);
    if (pattern.startsWith('digraph')) difficulty = Math.max(difficulty, 2);
    if (pattern === 'CVCC' || pattern === 'CCVC') difficulty = Math.max(difficulty, 2);
    if (pattern.startsWith('vowel-team')) difficulty = Math.max(difficulty, 3);
    if (pattern.startsWith('r-controlled')) difficulty = Math.max(difficulty, 3);
    if (pattern === 'magic-e') difficulty = Math.max(difficulty, 3);
  }
  
  return difficulty;
}

// Export for testing
export { SIGHT_WORDS, DIGRAPHS, VOWEL_TEAMS, R_CONTROLLED };
