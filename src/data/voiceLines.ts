/**
 * Static kid-facing lines that get pre-generated voice clips.
 *
 * kind 'zib'     → BrianNeural (speech bubbles, Zib reactions)
 * kind 'control' → AndrewNeural with light radio EQ (instructions, briefing, UI)
 * kind 'story'   → AndrewNeural, crystal-clear (Say Word / Hear It only — never whole sentences)
 *
 * scripts/gen-voice.mjs reads this file plus missions/stories/interests.
 * Keep wording short. Every instruction line is also shown on screen with 🔊.
 */

import { plural } from '../utils/plural';
import type { VoiceKind } from '../utils/voice';
import { RANK_ORDER } from '../types';

export const UI = {
  tapYourName: 'Tap your name.',
  whoIsPlaying: "Who's playing?",
  tapToCreate: 'Tap to create a player.',
  typeYourName: 'Type your name.',
  pickAPicture: 'Pick a picture.',
  pickTen: 'Pick 10 things you like.',
  slideToSound: 'Slide to sound it out.',
  fuel: 'Fuel',
  stars: 'Stars',
  startMission: 'Start mission.',
  acceptMission: 'Accept mission.',
  claimRewards: 'Claim rewards.',
  continueOn: 'Continue.',
  storyComplete: 'Story complete!',
  missionComplete: 'Mission complete!',
  rankUp: 'Rank up!',
  allDone: 'All done!',
  tapLaunch: 'Fuel tank full. Tap Launch!',
  tapLaunchCue: 'Tap Launch!',
  hearIt: 'Hear it.',
  sayWord: 'Say word.',
  heartWord: 'This is a heart word. We just know it!',
  shipEnergyRising: 'Ship energy rising.',
  shipUpgraded: 'Ship upgraded!',
} as const;

export const ZIB = {
  helloTeach: "Hello! I'm Zib. Can you teach me to read?",
  readingAmazing: 'Reading is amazing! Each word opens a new world!',
  incredibleTeacher: "You're an incredible teacher! I can read so much now!",
  tapPictures: 'Tap the pictures you love.',
  clipInterestIntro: 'Cadet! I want to learn about Earth. Show me what you love! Pick ten things!',
  clipInterestsDone: "Wow! Earth is amazing! I can't wait to read about those!",
  clipWelcomeBack: "You're back, Cadet! Ready for today's mission?",
  clipStoryStart: "A new story! Let's crack the code together!",
  clipWordCracked: 'You cracked it!',
  clipKeepTrying: "That one was tricky. Let's sound it out together!",
  clipStoryComplete: 'You did it! Our ship has more fuel!',
  clipPlanetUnlocked: "A new planet! Let's go explore!",
  clipRankUp: "Cadet, you've been promoted!",
  shipPower: 'More power for the ship!',
} as const;

export function zibWordsKnownLine(count: number): string {
  return `I know ${count} ${plural(count, 'word')} now! Let's learn more!`;
}

export function zibLearnedLine(count: number): string {
  // Never show "Zib learned 0 new words!" — encourage instead.
  if (count <= 0) return 'Great reading, Cadet!';
  return `Zib learned ${count} new ${plural(count, 'word')}!`;
}

export function zibRankUpLine(rank: string): string {
  return `You are now ${rank}!`;
}

export function pickMoreLine(remaining: number): string {
  return `Pick ${remaining} more.`;
}

export function storyCompleteLine(title: string): string {
  return `Story complete! ${title}`;
}

export function planetUnlockedLine(planet: string): string {
  const name = planet.charAt(0).toUpperCase() + planet.slice(1);
  return `Planet unlocked: ${name}`;
}

/** Lines the generator should bake that are not pulled from missions/stories. */
export function staticCatalog(): Array<{ kind: VoiceKind; text: string }> {
  const lines: Array<{ kind: VoiceKind; text: string }> = [];

  for (const text of Object.values(UI)) {
    lines.push({ kind: 'control', text });
  }
  for (const text of Object.values(ZIB)) {
    lines.push({ kind: 'zib', text });
  }

  for (let n = 0; n <= 40; n++) {
    lines.push({ kind: 'zib', text: zibWordsKnownLine(n) });
    lines.push({ kind: 'zib', text: zibLearnedLine(n) });
  }
  for (let n = 1; n <= 10; n++) {
    lines.push({ kind: 'control', text: pickMoreLine(n) });
  }
  for (const rank of RANK_ORDER) {
    lines.push({ kind: 'zib', text: zibRankUpLine(rank) });
    lines.push({ kind: 'control', text: `Rank up! You are now ${rank}!` });
  }
  for (const planet of ['Earth', 'Moon', 'Mars', 'Jupiter']) {
    lines.push({ kind: 'control', text: planetUnlockedLine(planet) });
  }

  return lines;
}
