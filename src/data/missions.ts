/**
 * Mission Data
 * 
 * Missions provide narrative framing for the reading activities.
 * Each mission involves helping Zib learn to read English.
 */

import type { Mission } from '../types';
import { RANK_ORDER } from '../types';

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

export function isMissionUnlocked(
  mission: Mission,
  completedMissions: string[],
  currentRank: string
): boolean {
  const rankIndex = RANK_ORDER.indexOf(currentRank as (typeof RANK_ORDER)[number]);
  if (mission.requiredRank) {
    const requiredIndex = RANK_ORDER.indexOf(
      mission.requiredRank as (typeof RANK_ORDER)[number]
    );
    if (rankIndex < requiredIndex) return false;
  }
  if (mission.prerequisiteMissions) {
    for (const prereq of mission.prerequisiteMissions) {
      if (!completedMissions.includes(prereq)) return false;
    }
  }
  return true;
}

// Get available missions for a player based on their progress
export function getAvailableMissions(
  completedMissions: string[],
  currentRank: string
): Mission[] {
  return MISSIONS.filter((mission) => {
    if (completedMissions.includes(mission.id)) return false;
    return isMissionUnlocked(mission, completedMissions, currentRank);
  });
}

// Get next available mission
export function getNextMission(completedMissions: string[], currentRank: string): Mission | undefined {
  const available = getAvailableMissions(completedMissions, currentRank);
  return available.find(m => !completedMissions.includes(m.id));
}

export type MissionMapStatus = 'completed' | 'current' | 'locked';

export interface MissionMapNode {
  mission: Mission;
  status: MissionMapStatus;
  completed: boolean;
  playable: boolean;
}

/** Star-map nodes in campaign order: completed, the current planet, then locked upcoming. */
export function getMissionMap(
  completedMissions: string[],
  currentRank: string
): MissionMapNode[] {
  const next = getNextMission(completedMissions, currentRank);
  const firstIncomplete = MISSIONS.find((m) => !completedMissions.includes(m.id));
  const currentId = next?.id ?? firstIncomplete?.id ?? MISSIONS[MISSIONS.length - 1]?.id;

  return MISSIONS.map((mission) => {
    const completed = completedMissions.includes(mission.id);
    const playable = !completed && isMissionUnlocked(mission, completedMissions, currentRank);
    let status: MissionMapStatus;
    if (mission.id === currentId) status = 'current';
    else if (completed) status = 'completed';
    else status = 'locked';
    return { mission, status, completed, playable };
  });
}
