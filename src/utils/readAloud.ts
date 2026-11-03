/**
 * Helpers for mapping spoken character offsets back to tappable story words,
 * and for splitting paragraphs into kid-sized read-aloud units.
 */

const TAG_VERBS = new Set([
  'said', 'asked', 'replied', 'whispered', 'yelled',
  'called', 'shouted', 'answered', 'cried', 'added', 'gasped'
]);

const TAG_STARTERS = new Set(['i', 'he', 'she', 'we', 'they', 'the']);

function isQuoteOnly(token: string): boolean {
  return /^[“”"‘’']+$/.test(token);
}

function endsSentence(token: string): boolean {
  // A real stop — not an ellipsis ("Muh...") which is one spoken beat.
  return /(?<![.])[.!?][“”"‘’']*$/.test(token);
}

function quoteCount(text: string): number {
  return (text.match(/[“”"‘’']/g) || []).length;
}

function stillInsideQuote(words: Array<{ word: string }>, from: number, through: number): boolean {
  let quotes = 0;
  for (let i = from; i <= through; i++) {
    quotes += quoteCount(words[i].word);
  }
  return quotes % 2 === 1;
}

function leadingLetter(token: string): string {
  return token.replace(/^[“”"‘’']+/, '');
}

function bareWord(token: string): string {
  return leadingLetter(token)
    .replace(/[“”"‘’']+$/, '')
    .replace(/[.,!?;:]+$/g, '')
    .toLowerCase();
}

function looksLikeTagStart(token: string): boolean {
  const bare = bareWord(token);
  if (TAG_STARTERS.has(bare)) return true;
  const letter = leadingLetter(token);
  return /^[A-Z]/.test(letter);
}

function tryAttachDialogueTag(
  words: Array<{ word: string }>,
  from: number
): number {
  if (from >= words.length || !looksLikeTagStart(words[from].word)) {
    return from;
  }

  let verbAt = -1;
  const searchEnd = Math.min(from + 4, words.length);
  for (let j = from; j < searchEnd; j++) {
    if (TAG_VERBS.has(bareWord(words[j].word))) {
      verbAt = j;
      break;
    }
  }
  if (verbAt < 0) return from;
  // If the tag verb itself ends the sentence ("said." / "asked."), stop
  // here. Scanning past it used to swallow the next narrative sentence.
  if (endsSentence(words[verbAt].word)) return verbAt + 1;

  let k = verbAt + 1;
  while (k < words.length) {
    const token = words[k].word;
    if (endsSentence(token)) return k + 1;
    const startsNewQuote = /^[“”"‘’']/.test(token) && !isQuoteOnly(token);
    if (startsNewQuote) return k;
    k += 1;
    if (k - verbAt > 8) return k;
  }
  return k;
}

export function wordIndexFromChar(text: string, charIndex: number): number {
  const tokens = text.match(/[\w']+(?:-[\w']+)*[.,!?;:"“”‘’']*|\s+/g) || [];
  let pos = 0;
  let wordIdx = 0;
  const clamped = Math.max(0, charIndex);

  for (const token of tokens) {
    if (!token.trim()) {
      pos += token.length;
      continue;
    }
    const end = pos + token.length;
    if (clamped < end) return wordIdx;
    pos = end;
    wordIdx += 1;
  }

  return Math.max(0, wordIdx - 1);
}

export function sentenceRanges(words: Array<{ word: string }>): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = [];
  let start = 0;

  for (let i = 0; i < words.length; i++) {
    if (!endsSentence(words[i].word)) continue;
    // Keep going until the closing quote so "'You did it! Yes!' I said."
    // is not chopped at the inner !.
    if (stillInsideQuote(words, start, i)) continue;

    let end = i + 1;
    while (end < words.length && isQuoteOnly(words[end].word)) {
      end += 1;
    }
    end = tryAttachDialogueTag(words, end);

    ranges.push({ start, end });
    start = end;
    // The loop's i++ will land on start; skip already-consumed tokens.
    i = end - 1;
  }

  if (start < words.length) {
    ranges.push({ start, end: words.length });
  }

  if (ranges.length === 0 && words.length > 0) {
    ranges.push({ start: 0, end: words.length });
  }

  return ranges;
}

export function joinWords(words: Array<{ word: string }>, start: number, end: number): string {
  return words.slice(start, end).map((w) => w.word).join(' ');
}

/** Split a short briefing into one-line sentences for on-screen 🔊 rows. */
export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}
