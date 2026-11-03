/**
 * Mission Data
 * 
 * Missions provide narrative framing for the reading activities.
 * Each mission involves helping Zib learn to read English.
 */

import type { Mission } from '../types';

export const MISSIONS: Mission[] = [
  {
    id: 'mission-1',
    title: 'First Contact',
    description: 'Help Zib learn to read.',
    planetId: 'earth',
    // Short on-screen briefing (each sentence shown with a 🔊). No paragraphs.
    briefing: 'Zib crash-landed near our base. Zib cannot read yet. Teach Zib the first English words.',
    alienDialogue: [
      "Hello! I am Zib. Your symbols are strange to me.",
      "What do these marks mean? They seem important!",
      "Can you teach me to decode them?",
      "I want to learn your reading magic!"
    ],
    completionMessage: 'Great work! Zib can read simple words now.',
    storyIds: ['story-1-lost-ship', 'story-2-star-map', 'story-3-zib-words'],
    fuelReward: 50,
    starReward: 5,
    unlocksPlanet: 'moon'
  },
  {
    id: 'mission-2',
    title: 'Lunar Training',
    description: 'Practice new sounds with Zib.',
    planetId: 'moon',
    briefing: 'Zib needs new sounds. Help Zib learn ch, sh, and th.',
    alienDialogue: [
      "The Moon is beautiful! So different from my world.",
      "These new sounds are hard. Ship and chip sound alike!",
      "But I will keep trying. I want to read everything!",
      "Teach me more, Commander!"
    ],
    completionMessage: 'Zib learned the new sounds. The path to Mars is open!',
    storyIds: ['story-4-dark-cave', 'story-5-space-race', 'story-6-alien-pet'],
    requiredRank: 'Cadet',
    prerequisiteMissions: ['mission-1'],
    fuelReward: 75,
    starReward: 10,
    unlocksPlanet: 'mars'
  },
  {
    id: 'mission-3',
    title: 'Mars Expedition',
    description: 'Read the texts on Mars.',
    planetId: 'mars',
    briefing: 'Mars has old texts to read. This is Zib\'s hardest mission.',
    alienDialogue: [
      "Mars! I dreamed of coming here.",
      "The ancient texts look complicated...",
      "But I've learned so much. I can do this!",
      "Together, we can decode anything!"
    ],
    completionMessage: 'You did it! Zib is a real reader now.',
    storyIds: ['story-7-red-planet'],
    requiredRank: 'Pilot',
    prerequisiteMissions: ['mission-2'],
    fuelReward: 100,
    starReward: 20,
    unlocksRank: 'Commander',
    unlocksPlanet: 'jupiter'
  }
];

// Get mission by ID
export function getMissionById(id: string): Mission | undefined {
  return MISSIONS.find(m => m.id === id);
}

// Get available missions for a player based on their progress
export function getAvailableMissions(
  completedMissions: string[],
  currentRank: string
): Mission[] {
  const rankOrder = ['Recruit', 'Cadet', 'Pilot', 'Commander', 'Captain', 'Admiral'];
  const rankIndex = rankOrder.indexOf(currentRank);

  return MISSIONS.filter(mission => {
    // Check if already completed
    if (completedMissions.includes(mission.id)) {
      return false; // Still show completed missions, but mark them
    }

    // Check rank requirement
    if (mission.requiredRank) {
      const requiredIndex = rankOrder.indexOf(mission.requiredRank);
      if (rankIndex < requiredIndex) {
        return false;
      }
    }

    // Check prerequisite missions
    if (mission.prerequisiteMissions) {
      for (const prereq of mission.prerequisiteMissions) {
        if (!completedMissions.includes(prereq)) {
          return false;
        }
      }
    }

    return true;
  });
}

// Get next available mission
export function getNextMission(completedMissions: string[], currentRank: string): Mission | undefined {
  const available = getAvailableMissions(completedMissions, currentRank);
  return available.find(m => !completedMissions.includes(m.id));
}
