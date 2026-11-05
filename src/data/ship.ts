/**
 * Zib's ship energy meter.
 *
 * Five newly completed stories fill the tank (20 energy each).
 * That matches the 7-story campaign: first upgrade after mission 1 +
 * two Lunar stories, without racing ahead of rank (Cadet at 50 fuel,
 * Pilot at 150). Overflow wraps into the next cycle and unlocks a part.
 */

export const SHIP_ENERGY_MAX = 100;
export const SHIP_ENERGY_PER_STORY = 20;
export const STORIES_PER_SHIP_CYCLE = SHIP_ENERGY_MAX / SHIP_ENERGY_PER_STORY;

export const SHIP_PARTS = [
  { id: 'boosters', label: 'Boosters' },
  { id: 'wings', label: 'Wings' },
  { id: 'canopy', label: 'Canopy' },
  { id: 'antenna', label: 'Antenna' },
  { id: 'warp-ring', label: 'Warp Ring' }
] as const;

export type ShipPartId = (typeof SHIP_PARTS)[number]['id'];

export interface ShipProgress {
  shipEnergy: number;
  shipPartsUnlocked: ShipPartId[];
}

const PART_IDS = new Set<string>(SHIP_PARTS.map((part) => part.id));

export function isShipPartId(value: string): value is ShipPartId {
  return PART_IDS.has(value);
}

export function getShipPart(id: string) {
  return SHIP_PARTS.find((part) => part.id === id);
}

function clampEnergy(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(SHIP_ENERGY_MAX - 1, Math.round(value)));
}

export function hydrateShipProgress(progress: {
  shipEnergy?: number;
  shipPartsUnlocked?: string[];
  storiesCompleted?: string[];
} | null | undefined): ShipProgress {
  if (!progress) {
    return { shipEnergy: 0, shipPartsUnlocked: [] };
  }

  const storedParts = Array.isArray(progress.shipPartsUnlocked)
    ? progress.shipPartsUnlocked.filter(isShipPartId)
    : null;

  if (typeof progress.shipEnergy === 'number' && storedParts) {
    return {
      shipEnergy: clampEnergy(progress.shipEnergy),
      shipPartsUnlocked: storedParts
    };
  }

  const completed = Array.isArray(progress.storiesCompleted)
    ? progress.storiesCompleted.length
    : 0;
  const cycles = Math.min(
    Math.floor(completed / STORIES_PER_SHIP_CYCLE),
    SHIP_PARTS.length
  );
  return {
    shipEnergy: (completed % STORIES_PER_SHIP_CYCLE) * SHIP_ENERGY_PER_STORY,
    shipPartsUnlocked: SHIP_PARTS.slice(0, cycles).map((part) => part.id)
  };
}

export function applyStoryShipEnergy(
  current: ShipProgress,
  isNewStory: boolean
): { next: ShipProgress; gained: number; upgradedPart: ShipPartId | null } {
  if (!isNewStory) {
    return { next: current, gained: 0, upgradedPart: null };
  }

  let energy = current.shipEnergy + SHIP_ENERGY_PER_STORY;
  const parts = [...current.shipPartsUnlocked];
  let upgradedPart: ShipPartId | null = null;

  if (energy >= SHIP_ENERGY_MAX) {
    energy -= SHIP_ENERGY_MAX;
    const nextPart = SHIP_PARTS.find((part) => !parts.includes(part.id));
    if (nextPart) {
      parts.push(nextPart.id);
      upgradedPart = nextPart.id;
    }
  }

  return {
    next: { shipEnergy: energy, shipPartsUnlocked: parts },
    gained: SHIP_ENERGY_PER_STORY,
    upgradedPart
  };
}

/** How the Mission Complete fill should play for this visit. */
export function shipFillPlan(fromEnergy: number, addedEnergy: number) {
  const from = Math.max(0, fromEnergy);
  const added = Math.max(0, addedEnergy);
  const raw = from + added;
  const willUpgrade = raw >= SHIP_ENERGY_MAX;
  const fillTo = willUpgrade ? SHIP_ENERGY_MAX : raw;
  const leftover = willUpgrade ? raw - SHIP_ENERGY_MAX : raw;
  return { from, added, fillTo, leftover, willUpgrade };
}
