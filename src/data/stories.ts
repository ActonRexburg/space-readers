/**
 * Pre-written Decodable Stories
 * 
 * Age-respectful sci-fi stories for 8-9 year old readers.
 * Focus on CVC words, simple digraphs, and limited sight words.
 * Each story helps Zib the alien learn English words.
 */

import { v4 as uuidv4 } from 'uuid';
import type { Story, StoryParagraph } from '../types';
import { parseTextToWords } from '../services/phonics';

// Helper to create a story paragraph
function createParagraph(text: string): StoryParagraph {
  return {
    id: uuidv4(),
    words: parseTextToWords(text),
    rawText: text
  };
}

// Helper to extract all patterns from a story
function extractStoryPatterns(paragraphs: StoryParagraph[]): string[] {
  const patterns = new Set<string>();
  for (const para of paragraphs) {
    for (const word of para.words) {
      for (const pattern of word.phonicsPatterns) {
        patterns.add(pattern);
      }
    }
  }
  return Array.from(patterns);
}

// Story 1: The Lost Ship (CVC focus)
const story1Paragraphs = [
  createParagraph("The red ship sat on a flat rock."),
  createParagraph("Zib ran to the ship. It was big and had a dent."),
  createParagraph("'Can we fix it?' Zib said. 'Yes, we can!'"),
  createParagraph("We got a kit. The kit had a pin and a rod."),
  createParagraph("Tap, tap, tap. We hit the dent. Pop! It was flat."),
  createParagraph("'The ship is fit!' Zib was glad. 'Let us zip to the sun!'"),
  createParagraph("The ship lit up. We shot into the sky. What a fun trip!")
];

// Story 2: The Star Map (digraphs: sh, ch, th)
const story2Paragraphs = [
  createParagraph("Zib had a thin map of the stars."),
  createParagraph("'This map will show us the path,' Zib said."),
  createParagraph("We sat in the ship. The map lit up with a flash."),
  createParagraph("'Go north to the big red star. Then go west to the small moon.'"),
  createParagraph("The ship shot off with a whoosh. Stars rushed past."),
  createParagraph("'There it is!' I said. A blue planet sat in the mist."),
  createParagraph("Zib was thrilled. 'You are the best at this! Thank you, friend.'")
];

// Story 3: Zib's First Words (CVC + digraphs)
const story3Paragraphs = [
  createParagraph("Zib did not know how to read yet."),
  createParagraph("'What is this?' Zib held up a red mug."),
  createParagraph("'That is a mug,' I said. 'M-U-G. Mug.'"),
  createParagraph("Zib shut one eye and said, 'Muh... uh... guh. MUG!'"),
  createParagraph("'Yes! You did it!' I gave Zib a high five."),
  createParagraph("'What is that?' Zib saw my pet fish."),
  createParagraph("'F-I-SH. Fish!' I said. Zib's eyes got big."),
  createParagraph("'Fish! I can read! This is the best day!'"),
  createParagraph("Zib ran to tell the ship. 'I know words now!'")
];

// Story 4: The Dark Cave (CVCC patterns + blends)
const story4Paragraphs = [
  createParagraph("We had to land on a cold, dark planet."),
  createParagraph("'The fuel tank is low,' the ship said. 'Find more fuel fast.'"),
  createParagraph("Zib and I left the ship. Wind blew past us."),
  createParagraph("We found a cave cut into the rock. It was very dark."),
  createParagraph("'Do not be scared,' I said. 'I have a lamp.'"),
  createParagraph("The lamp cast a soft glow. We crept into the cave."),
  createParagraph("Drip, drip. We heard drops of liquid. It was fuel!"),
  createParagraph("We filled our tank and went back to the ship."),
  createParagraph("'Blast off!' Zib said. We were safe at last.")
];

// Story 5: The Space Race (vowel teams: ee, ea)
const story5Paragraphs = [
  createParagraph("Zib wanted to race. 'Please, can we race the green ship?'"),
  createParagraph("I said yes. We needed speed to beat them."),
  createParagraph("'Ready, set, GO!' A beam of light started the race."),
  createParagraph("We flew past three moons. The green ship was near."),
  createParagraph("'We need more speed!' Zib reached for the boost."),
  createParagraph("ZOOM! Our ship leaped past the green one."),
  createParagraph("We crossed the finish beam. 'We did it! We won!'"),
  createParagraph("The team gave us each a gold star. What a great day!")
];

// Story 6: The Alien Pet (sh, ch, wh digraphs)
const story6Paragraphs = [
  createParagraph("Zib found a small pet on the ship."),
  createParagraph("'What is that?' I asked. The pet had six legs and a shell."),
  createParagraph("'I shall name it Chip,' Zib said with a grin."),
  createParagraph("Chip ran when we chased it. 'Come back, Chip!'"),
  createParagraph("The pet hid in a chest. We shut the lid fast."),
  createParagraph("'Got you!' Zib held Chip up. Chip chirped."),
  createParagraph("'Chip must be fed,' I said. 'What shall we give it?'"),
  createParagraph("Chip chomped on a chunk of bread. 'Chip likes it!'"),
  createParagraph("Now Chip is part of our ship crew. We are a team.")
];

// Story 7: Mission to the Red Planet (comprehensive review)
const story7Paragraphs = [
  createParagraph("This is it. The big mission to the red planet."),
  createParagraph("Zib and I checked the ship. Fuel was full. Maps were set."),
  createParagraph("'Blast off in three, two, one!' The ship shook and rose."),
  createParagraph("We flew past the moon and into deep space."),
  createParagraph("Stars rushed by. Zib read a book to pass the time."),
  createParagraph("'Look! The red planet!' It was huge and had big storms."),
  createParagraph("We landed with a soft thud. Red dust flew up."),
  createParagraph("'We made it,' I said. 'We are the first to be here.'"),
  createParagraph("Zib planted a flag. 'This is for all of us back home.'"),
  createParagraph("What will we find next? The quest has just begun!")
];

// Export all stories with metadata
export const STORIES: Story[] = [
  {
    id: 'story-1-lost-ship',
    title: 'The Lost Ship',
    paragraphs: story1Paragraphs,
    phonicsPatterns: extractStoryPatterns(story1Paragraphs),
    targetWords: ['ship', 'flat', 'rock', 'dent', 'kit', 'pin', 'rod', 'zip', 'sun'],
    sightWords: ['the', 'on', 'a', 'to', 'it', 'was', 'and', 'we', 'is'],
    difficultyLevel: 1,
    missionId: 'mission-1',
    storyContext: "You found a crashed ship on an asteroid. Can you help fix it with Zib?"
  },
  {
    id: 'story-2-star-map',
    title: 'The Star Map',
    paragraphs: story2Paragraphs,
    phonicsPatterns: extractStoryPatterns(story2Paragraphs),
    targetWords: ['thin', 'map', 'path', 'ship', 'flash', 'north', 'rush', 'thrilled'],
    sightWords: ['the', 'of', 'will', 'show', 'us', 'to', 'with', 'a', 'is'],
    difficultyLevel: 2,
    missionId: 'mission-1',
    storyContext: "Zib has an ancient star map. Help decode the route to a hidden planet!"
  },
  {
    id: 'story-3-zib-words',
    title: "Zib's First Words",
    paragraphs: story3Paragraphs,
    phonicsPatterns: extractStoryPatterns(story3Paragraphs),
    targetWords: ['mug', 'shut', 'fish', 'read', 'know', 'best', 'ship'],
    sightWords: ['did', 'not', 'how', 'to', 'what', 'is', 'this', 'the', 'I'],
    difficultyLevel: 1,
    missionId: 'mission-1',
    storyContext: "Today is special. You get to teach Zib the first English words!"
  },
  {
    id: 'story-4-dark-cave',
    title: 'The Dark Cave',
    paragraphs: story4Paragraphs,
    phonicsPatterns: extractStoryPatterns(story4Paragraphs),
    targetWords: ['land', 'cold', 'dark', 'tank', 'fast', 'lamp', 'cast', 'crept', 'blast'],
    sightWords: ['we', 'had', 'to', 'on', 'a', 'the', 'is', 'do', 'not', 'be'],
    difficultyLevel: 2,
    missionId: 'mission-2',
    storyContext: "The ship is out of fuel! Explore a mysterious cave with Zib to find more."
  },
  {
    id: 'story-5-space-race',
    title: 'The Space Race',
    paragraphs: story5Paragraphs,
    phonicsPatterns: extractStoryPatterns(story5Paragraphs),
    targetWords: ['race', 'please', 'speed', 'beat', 'beam', 'green', 'need', 'reached', 'team'],
    sightWords: ['to', 'the', 'we', 'them', 'a', 'of', 'our', 'past'],
    difficultyLevel: 3,
    missionId: 'mission-2',
    storyContext: "Challenge accepted! Race against another ship for the gold star trophy!"
  },
  {
    id: 'story-6-alien-pet',
    title: 'The Alien Pet',
    paragraphs: story6Paragraphs,
    phonicsPatterns: extractStoryPatterns(story6Paragraphs),
    targetWords: ['ship', 'shell', 'shall', 'chased', 'chest', 'shut', 'chirped', 'chunk', 'chomped'],
    sightWords: ['a', 'on', 'the', 'what', 'is', 'I', 'we', 'it', 'to', 'of'],
    difficultyLevel: 2,
    missionId: 'mission-2',
    storyContext: "A strange creature snuck onto your ship! Can you catch it and make friends?"
  },
  {
    id: 'story-7-red-planet',
    title: 'Mission to the Red Planet',
    paragraphs: story7Paragraphs,
    phonicsPatterns: extractStoryPatterns(story7Paragraphs),
    targetWords: ['mission', 'planet', 'blast', 'shook', 'rushed', 'storms', 'thud', 'dust', 'quest'],
    sightWords: ['this', 'is', 'the', 'to', 'and', 'we', 'a', 'by', 'of', 'what', 'will'],
    difficultyLevel: 3,
    missionId: 'mission-3',
    storyContext: "The ultimate mission! Land on the legendary Red Planet and make history."
  }
];

// Get a story by ID
export function getStoryById(id: string): Story | undefined {
  return STORIES.find(s => s.id === id);
}

// Get stories for a mission
export function getStoriesForMission(missionId: string): Story[] {
  return STORIES.filter(s => s.missionId === missionId);
}

// Get stories by difficulty
export function getStoriesByDifficulty(level: number): Story[] {
  return STORIES.filter(s => s.difficultyLevel === level);
}
