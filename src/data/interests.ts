/**
 * Interest Options for AI Story Generation
 * 
 * 50 kid-friendly interest tiles for the interest picker.
 * Each has an emoji icon (can be swapped for AI art later),
 * a short label, and a category for organization.
 * 
 * These interests are fed into the story generation to create
 * personalized decodable stories themed around what kids love.
 */

export interface InterestOption {
  id: string;
  label: string;
  emoji: string;
  category: 'animals' | 'sports' | 'adventure' | 'nature' | 'creative' | 'fantasy' | 'vehicles' | 'activities';
  // Future: imageUrl for AI-generated illustrations
  imageUrl?: string;
}

export const INTEREST_OPTIONS: InterestOption[] = [
  // Animals (10)
  { id: 'dinosaurs', label: 'Dinosaurs', emoji: '🦖', category: 'animals' },
  { id: 'sharks', label: 'Sharks', emoji: '🦈', category: 'animals' },
  { id: 'horses', label: 'Horses', emoji: '🐴', category: 'animals' },
  { id: 'puppies', label: 'Puppies', emoji: '🐶', category: 'animals' },
  { id: 'cats', label: 'Cats', emoji: '🐱', category: 'animals' },
  { id: 'birds', label: 'Birds', emoji: '🦅', category: 'animals' },
  { id: 'reptiles', label: 'Reptiles', emoji: '🦎', category: 'animals' },
  { id: 'bugs', label: 'Bugs', emoji: '🐛', category: 'animals' },
  { id: 'ponies', label: 'Ponies', emoji: '🐴', category: 'animals' },
  { id: 'farm-animals', label: 'Farms', emoji: '🐄', category: 'animals' },

  // Sports (8)
  { id: 'soccer', label: 'Soccer', emoji: '⚽', category: 'sports' },
  { id: 'basketball', label: 'Basketball', emoji: '🏀', category: 'sports' },
  { id: 'football', label: 'Football', emoji: '🏈', category: 'sports' },
  { id: 'baseball', label: 'Baseball', emoji: '⚾', category: 'sports' },
  { id: 'gymnastics', label: 'Gymnastics', emoji: '🤸', category: 'sports' },
  { id: 'dance', label: 'Dance', emoji: '💃', category: 'sports' },
  { id: 'swimming', label: 'Swimming', emoji: '🏊', category: 'sports' },
  { id: 'skateboarding', label: 'Skating', emoji: '🛹', category: 'sports' },

  // Vehicles (6)
  { id: 'bikes', label: 'Bikes', emoji: '🚲', category: 'vehicles' },
  { id: 'trucks', label: 'Trucks', emoji: '🚚', category: 'vehicles' },
  { id: 'trains', label: 'Trains', emoji: '🚂', category: 'vehicles' },
  { id: 'race-cars', label: 'Race Cars', emoji: '🏎️', category: 'vehicles' },
  { id: 'rockets', label: 'Rockets', emoji: '🚀', category: 'vehicles' },
  { id: 'robots', label: 'Robots', emoji: '🤖', category: 'vehicles' },

  // Fantasy (10)
  { id: 'dragons', label: 'Dragons', emoji: '🐉', category: 'fantasy' },
  { id: 'unicorns', label: 'Unicorns', emoji: '🦄', category: 'fantasy' },
  { id: 'knights', label: 'Knights', emoji: '⚔️', category: 'fantasy' },
  { id: 'pirates', label: 'Pirates', emoji: '🏴‍☠️', category: 'fantasy' },
  { id: 'ninjas', label: 'Ninjas', emoji: '🥷', category: 'fantasy' },
  { id: 'superheroes', label: 'Superheroes', emoji: '🦸', category: 'fantasy' },
  { id: 'magic', label: 'Magic', emoji: '✨', category: 'fantasy' },
  { id: 'princesses', label: 'Princesses', emoji: '👸', category: 'fantasy' },
  { id: 'monsters', label: 'Monsters', emoji: '👹', category: 'fantasy' },
  { id: 'mermaids', label: 'Mermaids', emoji: '🧜‍♀️', category: 'fantasy' },

  // Nature (6)
  { id: 'ocean', label: 'Ocean', emoji: '🌊', category: 'nature' },
  { id: 'jungle', label: 'Jungle', emoji: '🌴', category: 'nature' },
  { id: 'volcanoes', label: 'Volcanoes', emoji: '🌋', category: 'nature' },
  { id: 'weather', label: 'Weather', emoji: '⛈️', category: 'nature' },
  { id: 'outer-space', label: 'Space', emoji: '🌌', category: 'nature' },
  { id: 'space-aliens', label: 'Aliens', emoji: '👽', category: 'nature' },

  // Creative (5)
  { id: 'cooking', label: 'Cooking', emoji: '🍳', category: 'creative' },
  { id: 'art', label: 'Art', emoji: '🎨', category: 'creative' },
  { id: 'music', label: 'Music', emoji: '🎵', category: 'creative' },
  { id: 'building', label: 'Building', emoji: '🧱', category: 'creative' },
  { id: 'inventions', label: 'Inventions', emoji: '💡', category: 'creative' },

  // Activities (5)
  { id: 'video-games', label: 'Games', emoji: '🎮', category: 'activities' },
  { id: 'camping', label: 'Camping', emoji: '🏕️', category: 'activities' },
  { id: 'fishing', label: 'Fishing', emoji: '🎣', category: 'activities' },
  { id: 'jokes', label: 'Jokes', emoji: '😂', category: 'activities' },
  { id: 'mysteries', label: 'Mysteries', emoji: '🔍', category: 'activities' },
];

// Get interest by ID
export function getInterestById(id: string): InterestOption | undefined {
  return INTEREST_OPTIONS.find(i => i.id === id);
}

// Get interests by IDs
export function getInterestsByIds(ids: string[]): InterestOption[] {
  return ids.map(id => getInterestById(id)).filter((i): i is InterestOption => i !== undefined);
}

// Minimum required interests for story generation
export const MIN_INTERESTS = 10;

// Generate a story theme suggestion based on interests
export function suggestStoryTheme(interests: string[]): string {
  if (interests.length === 0) return 'space adventure';
  
  // Pick a random interest
  const randomInterest = interests[Math.floor(Math.random() * interests.length)];
  const interest = getInterestById(randomInterest);
  
  if (!interest) return 'space adventure';
  
  // Create a theme combining the interest with Zib
  const themes: Record<string, string[]> = {
    dinosaurs: ['Zib discovers a planet of dinosaurs', 'Zib finds a dinosaur egg in space'],
    sharks: ['Zib explores an ocean planet with sharks', 'A space shark becomes Zib\'s friend'],
    horses: ['Zib learns to ride a space horse', 'Wild horses on Mars'],
    puppies: ['Zib adopts a space puppy', 'A puppy helps Zib on a mission'],
    cats: ['A cat sneaks onto Zib\'s ship', 'Space cats teach Zib tricks'],
    dragons: ['Zib meets a friendly dragon', 'Dragon eggs in the asteroid belt'],
    unicorns: ['A unicorn from the rainbow nebula', 'Zib and the magic unicorn'],
    pirates: ['Space pirates chase Zib', 'Zib finds pirate treasure'],
    superheroes: ['Zib becomes a superhero', 'A superhero team-up in space'],
    robots: ['Zib builds a robot friend', 'Robot helpers on the space station'],
    rockets: ['Zib builds the fastest rocket', 'Racing rockets around the moon'],
    soccer: ['Space soccer championship', 'Zib learns to play soccer'],
    basketball: ['Basketball on the moon', 'Zib\'s slam dunk'],
  };
  
  const interestThemes = themes[randomInterest];
  if (interestThemes) {
    return interestThemes[Math.floor(Math.random() * interestThemes.length)];
  }
  
  return `Zib and the ${interest.label.toLowerCase()} adventure`;
}
