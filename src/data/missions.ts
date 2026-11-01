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
    description: 'Welcome Zib aboard and teach the first English words!',
    planetId: 'earth',
    briefing: `Commander, we've received an urgent transmission. An alien named Zib crash-landed near our base. Zib comes from a planet where they communicate through colors and sounds, but they've never seen written language before.

Your mission: Help Zib learn to read English. Every word you teach Zib makes our crew stronger. The galaxy needs readers!`,
    alienDialogue: [
      "Hello! I am Zib. Your symbols are strange to me.",
      "What do these marks mean? They seem important!",
      "Can you teach me to decode them?",
      "I want to learn your reading magic!"
    ],
    completionMessage: `Outstanding work, Commander! Zib has learned the basics of reading. You've taught Zib to decode simple words and sounds. 

Zib says: "I can read! The symbols make sense now. Thank you, friend!"

Your rank has increased. New missions await!`,
    storyIds: ['story-1-lost-ship', 'story-2-star-map', 'story-3-zib-words'],
    fuelReward: 50,
    starReward: 5,
    unlocksPlanet: 'moon'
  },
  {
    id: 'mission-2',
    title: 'Lunar Training',
    description: 'Practice with Zib on the Moon Base to master new sounds!',
    planetId: 'moon',
    briefing: `Commander, Zib has made great progress! But to continue our mission across the galaxy, Zib needs to learn more complex words.

The Moon Base has training simulators perfect for this. Help Zib master new sounds like "ch", "sh", and "th". These special sound combinations are tricky but important!`,
    alienDialogue: [
      "The Moon is beautiful! So different from my world.",
      "These new sounds are hard. 'Ch' and 'sh' sound alike!",
      "But I will keep trying. I want to read everything!",
      "Teach me more, Commander!"
    ],
    completionMessage: `Excellent training, Commander! Zib has mastered the tricky digraph sounds. 

Zib says: "Ship, chip, this, that - I can read them all now! I'm getting stronger!"

The path to Mars is now open. New challenges await!`,
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
    description: 'The ultimate reading challenge on the Red Planet!',
    planetId: 'mars',
    briefing: `Commander, this is the big one. Mars holds ancient secrets, and Zib has been chosen to decode them. But the texts are complex, with longer words and new patterns.

This is Zib's toughest challenge yet. Help your friend become a true reader. The fate of the mission depends on it!`,
    alienDialogue: [
      "Mars! I dreamed of coming here.",
      "The ancient texts look complicated...",
      "But I've learned so much. I can do this!",
      "Together, we can decode anything!"
    ],
    completionMessage: `MISSION COMPLETE, Commander! You and Zib have decoded the ancient Mars texts. You've proven that reading unlocks worlds beyond imagination.

Zib says: "I came to Earth not knowing a single word. Now I can read! You taught me that every word is a door to adventure. Thank you, my friend."

You've earned the rank of Pilot. More planets await discovery!`,
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
