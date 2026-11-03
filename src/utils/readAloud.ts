/**
 * Helpers for mapping spoken character offsets back to tappable story words.
 */

export function wordIndexFromChar(text: string, charIndex: number): number {
  const tokens = text.match(/[\w']+[.,!?;:"']*|\s+/g) || [];
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
    if (/[.!?]['"]*$/.test(words[i].word)) {
      ranges.push({ start, end: i + 1 });
      start = i + 1;
    }
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
