/**
 * Ship energy: 5 stories fill the tank, Mission Complete animates the gauge,
 * a full tank unlocks a part, and the Bridge shows the ship between stories.
 */
import { test, expect, type Page } from '@playwright/test';
import {
  applyStoryShipEnergy,
  hydrateShipProgress,
  shipFillPlan,
  SHIP_ENERGY_PER_STORY,
  SHIP_ENERGY_MAX
} from '../src/data/ship';

async function seedPlayer(
  page: Page,
  extra: {
    storiesCompleted?: string[];
    shipEnergy?: number;
    shipPartsUnlocked?: string[];
  } = {}
) {
  await page.addInitScript((payload) => {
    const now = Date.now();
    localStorage.setItem('space_readers_profiles', JSON.stringify([{
      id: 'qa-a',
      name: 'Kid1',
      avatarId: 'rocket',
      interests: ['dinosaurs'],
      createdAt: now,
      lastActiveAt: now,
      hasWatchedIntro: true,
      hasCompletedInterests: true
    }]));
    localStorage.setItem('space_readers_progress', JSON.stringify({
      'qa-a': {
        profileId: 'qa-a',
        fuelCredits: 10,
        starCredits: 1,
        currentRank: 'Recruit',
        totalWordsDecoded: 0,
        storiesCompleted: payload.storiesCompleted ?? [],
        missionsCompleted: [],
        planetsUnlocked: ['earth'],
        alienLearnedWords: [],
        shipEnergy: payload.shipEnergy ?? 0,
        shipPartsUnlocked: payload.shipPartsUnlocked ?? [],
        wordHelpCount: {},
        sessionHistory: []
      }
    }));
    localStorage.setItem('space_readers_settings', JSON.stringify({
      parentPin: '1234',
      audioEnabled: true,
      speechRate: 1.0,
      zibClipsEnabled: false,
      activeProfileId: 'qa-a'
    }));
  }, extra);
}

async function openMissionStories(page: Page) {
  await page.goto('/');
  await page.getByTestId('profile-card-qa-a').click();
  await expect(page.getByRole('heading', { level: 2, name: 'First Contact' })).toBeVisible();
  await page.getByRole('button', { name: /Start Mission/i }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'First Contact' })).toBeVisible();
  await page.getByRole('button', { name: /Accept/i }).click();
}

async function finishOpenStory(page: Page) {
  for (let i = 0; i < 16; i += 1) {
    const finish = page.getByRole('button', { name: '✓ Finish' });
    if (await finish.isVisible().catch(() => false)) {
      await finish.click();
      await page.getByRole('button', { name: /Continue/i }).click();
      return;
    }
    await page.getByRole('button', { name: 'Next →' }).click();
  }
  throw new Error('story did not finish');
}

test('five new stories fill the meter and unlock boosters', () => {
  let ship = { shipEnergy: 0, shipPartsUnlocked: [] as string[] };
  let upgraded: string | null = null;
  for (let i = 0; i < 5; i += 1) {
    const result = applyStoryShipEnergy(ship, true);
    ship = result.next;
    if (result.upgradedPart) upgraded = result.upgradedPart;
  }
  expect(ship.shipEnergy).toBe(0);
  expect(ship.shipPartsUnlocked).toEqual(['boosters']);
  expect(upgraded).toBe('boosters');
  expect(SHIP_ENERGY_PER_STORY * 5).toBe(SHIP_ENERGY_MAX);
});

test('re-reading a story does not add energy', () => {
  const start = { shipEnergy: 40, shipPartsUnlocked: [] as string[] };
  const result = applyStoryShipEnergy(start, false);
  expect(result.next).toEqual(start);
  expect(result.gained).toBe(0);
});

test('hydrate seeds energy from completed stories when fields are missing', () => {
  const ship = hydrateShipProgress({
    storiesCompleted: ['a', 'b', 'c', 'd', 'e', 'f', 'g']
  });
  expect(ship.shipEnergy).toBe(40);
  expect(ship.shipPartsUnlocked).toEqual(['boosters']);
});

test('fill plan crosses 100 then leftovers', () => {
  const plan = shipFillPlan(80, 40);
  expect(plan.willUpgrade).toBe(true);
  expect(plan.fillTo).toBe(100);
  expect(plan.leftover).toBe(20);
});

test('Bridge shows the ship and current energy', async ({ page }) => {
  await seedPlayer(page, {
    shipEnergy: 60,
    shipPartsUnlocked: ['boosters']
  });
  await page.goto('/');
  await page.getByTestId('profile-card-qa-a').click();
  await expect(page.getByTestId('bridge-ship-card')).toBeVisible();
  await expect(page.getByTestId('zib-ship')).toBeVisible();
  await expect(page.getByTestId('bridge-ship-energy')).toHaveText('60 / 100');
  await expect(page.locator('.ship-part-boosters')).toHaveCount(1);
  await page.getByTestId('bridge-ship-card').screenshot({
    path: '/tmp/ship-shots/bridge-ship-energy.png'
  });
});

test('Mission Complete fills the gauge from the old level', async ({ page }) => {
  test.setTimeout(60_000);
  await seedPlayer(page, {
    storiesCompleted: ['story-1-lost-ship', 'story-2-star-map'],
    shipEnergy: 20,
    shipPartsUnlocked: []
  });
  await openMissionStories(page);
  await page.getByRole('heading', { name: "Zib's First Words" }).click();
  await finishOpenStory(page);
  await expect(page.getByTestId('ship-reward')).toBeVisible();
  await expect(page.getByText('Ship energy rising.')).toBeVisible();
  await expect(page.getByText('More power for the ship!')).toBeVisible();
  await expect(page.getByTestId('zib-ship')).toHaveAttribute('data-ship-phase', 'filling');
  await page.waitForTimeout(900);
  await page.getByTestId('ship-reward').screenshot({
    path: '/tmp/ship-shots/ship-gauge-mid-fill.png'
  });
  await expect(page.getByRole('button', { name: /Claim Rewards/i })).toBeVisible();
});

test('full tank plays Ship upgraded and unlocks a part', async ({ page }) => {
  test.setTimeout(60_000);
  await seedPlayer(page, {
    storiesCompleted: ['story-1-lost-ship', 'story-2-star-map'],
    shipEnergy: 80,
    shipPartsUnlocked: []
  });
  await openMissionStories(page);
  await page.getByRole('heading', { name: "Zib's First Words" }).click();
  await finishOpenStory(page);
  await expect(page.getByTestId('ship-reward')).toBeVisible();
  await expect(page.getByTestId('ship-upgrade-message')).toBeVisible({ timeout: 12_000 });
  await expect(page.getByText('Boosters unlocked.')).toBeVisible();
  await expect(page.locator('.ship-part-boosters')).toHaveCount(1);
  await expect(page.getByTestId('zib-ship')).toHaveAttribute('data-ship-phase', 'upgraded');
  await page.getByTestId('ship-reward').screenshot({
    path: '/tmp/ship-shots/ship-upgraded.png'
  });
});
