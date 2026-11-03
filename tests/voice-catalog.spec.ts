/**
 * Every static string passed to speak() must have a manifest clip.
 * Dynamic lines (fuel totals) are allowed to fall back to speechSynthesis.
 */
import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { INTEREST_OPTIONS } from '../src/data/interests';
import { MISSIONS } from '../src/data/missions';
import { STORIES } from '../src/data/stories';
import { staticCatalog, storyCompleteLine } from '../src/data/voiceLines';
import { voiceLookupKey, type VoiceKind } from '../src/utils/voice';

function collectStaticSpeakLines(): Array<{ kind: VoiceKind; text: string }> {
  const bucket = new Map<string, { kind: VoiceKind; text: string }>();
  const add = (kind: VoiceKind, text: string) => {
    const trimmed = text.replace(/\s+/g, ' ').trim();
    if (!trimmed) return;
    const key = voiceLookupKey(kind, trimmed);
    if (!bucket.has(key)) bucket.set(key, { kind, text: trimmed });
  };

  for (const line of staticCatalog()) add(line.kind, line.text);

  for (const mission of MISSIONS) {
    add('control', mission.title);
    add('control', mission.description);
    add('control', mission.briefing);
    add('control', mission.completionMessage);
    add('control', `${mission.title}. ${mission.description}`);
    add('control', `${mission.title}. ${mission.briefing}`);
    for (const sentence of mission.briefing.split(/(?<=[.!?])\s+/)) {
      add('control', sentence);
    }
    for (const line of mission.alienDialogue) add('zib', line);
  }

  for (const story of STORIES) {
    add('control', story.title);
    if (story.storyContext) {
      add('control', story.storyContext);
      add('control', `${story.title}. ${story.storyContext}`);
    }
    add('control', storyCompleteLine(story.title));
    for (const para of story.paragraphs) {
      for (const word of para.words) {
        const clean = word.word.replace(/[^a-zA-Z]/g, '');
        if (clean) add('story', clean);
      }
    }
  }

  for (const interest of INTEREST_OPTIONS) add('control', interest.label);

  return [...bucket.values()];
}

test('every static speak() string has a voice manifest clip', () => {
  const manifest = JSON.parse(
    readFileSync('public/audio/voice/manifest.json', 'utf8')
  ) as { clips: Record<string, { file: string }> };

  const missing: string[] = [];
  for (const line of collectStaticSpeakLines()) {
    const key = voiceLookupKey(line.kind, line.text);
    if (!manifest.clips[key]) {
      missing.push(`${key} :: ${line.text.slice(0, 80)}`);
    }
  }

  expect(missing, missing.join('\n')).toEqual([]);
});
