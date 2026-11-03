/**
 * Verify quoted dialogue stays in one read-aloud unit across built-in stories.
 * Run: node --experimental-strip-types scripts/test-dialogue.mjs
 */
import { STORIES } from '../src/data/stories.ts';
import { sentenceRanges, joinWords } from '../src/utils/readAloud.ts';

const mustStayTogether = [
  "'There it is!' I said.",
  "'Can we fix it?' Zib said.",
  "'This map will show us the path,' Zib said.",
  "'What is that?' I asked.",
  "'Do not be scared,' I said.",
  "'We made it,' I said.",
];

function allSentences() {
  const out = [];
  for (const story of STORIES) {
    for (const para of story.paragraphs) {
      for (const range of sentenceRanges(para.words)) {
        out.push({
          story: story.title,
          text: joinWords(para.words, range.start, range.end),
        });
      }
    }
  }
  return out;
}

const sentences = allSentences();
let failed = 0;

for (const want of mustStayTogether) {
  const found = sentences.some((s) => s.text.replace(/\s+/g, ' ') === want);
  if (!found) {
    // Allow curly-quote variants / extra surrounding context that still contains the unit
    const contained = sentences.filter((s) => s.text.includes(want.replace(/^'|'$/g, '')));
    const exactish = sentences.find((s) => s.text.includes(want));
    if (!exactish) {
      console.error(`MISSING unit: ${want}`);
      console.error('  nearby:', contained.slice(0, 3).map((s) => s.text));
      failed += 1;
    }
  }
}

const broken = sentences.filter((s) => {
  const t = s.text.trim();
  return /^['"‘’“”]?\s*I said\.?$/.test(t) || /^['"‘’“”]+Zib said\.?$/.test(t);
});

if (broken.length) {
  console.error('Orphaned dialogue tags:');
  for (const b of broken) console.error(`  [${b.story}] ${b.text}`);
  failed += 1;
}

console.log(`Stories: ${STORIES.length}`);
console.log(`Sentences: ${sentences.length}`);
for (const s of sentences) {
  console.log(`  [${s.story}] ${s.text}`);
}

if (failed) {
  console.error(`FAILED (${failed})`);
  process.exit(1);
}
console.log('OK — dialogue tags stay attached');
