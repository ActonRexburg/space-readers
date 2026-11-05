/**
 * Bridge cockpit: one scene (not boxed cards), star-map, console, phone HUD.
 */
import { test, expect, type Page } from '@playwright/test';
import { getMissionMap } from '../src/data/missions';

async function seedPlayer(page: Page, extraProgress: Record<string, unknown> = {}) {
  await page.addInitScript((progress) => {
    const now = Date.now();
    localStorage.setItem('space_readers_profiles', JSON.stringify([{
      id: 'qa-a',
      name: 'Maya',
      avatarId: 'astronaut-1',
      interests: ['dinosaurs'],
      createdAt: now,
      lastActiveAt: now,
      hasWatchedIntro: true,
      hasCompletedInterests: true
    }]));
    localStorage.setItem('space_readers_progress', JSON.stringify({
      'qa-a': {
        profileId: 'qa-a',
        fuelCredits: 5,
        starCredits: 42,
        currentRank: 'Cadet',
        totalWordsDecoded: 0,
        storiesCompleted: [],
        missionsCompleted: [],
        planetsUnlocked: ['earth'],
        alienLearnedWords: [],
        shipEnergy: 40,
        shipPartsUnlocked: ['boosters'],
        wordHelpCount: {},
        sessionHistory: [],
        ...progress
      }
    }));
    localStorage.setItem('space_readers_settings', JSON.stringify({
      parentPin: '1234',
      audioEnabled: true,
      speechRate: 1.0,
      zibClipsEnabled: false,
      activeProfileId: 'qa-a'
    }));
  }, extraProgress);
}

async function openBridge(page: Page) {
  await page.goto('/');
  await page.getByTestId('profile-card-qa-a').click();
  await expect(page.getByTestId('bridge-cockpit')).toBeVisible();
}

test('mission map marks Earth current and later planets locked for a new Cadet', () => {
  const nodes = getMissionMap([], 'Cadet');
  expect(nodes.map((n) => [n.mission.planetId, n.status, n.playable])).toEqual([
    ['earth', 'current', true],
    ['moon', 'locked', false],
    ['mars', 'locked', false]
  ]);
});

test('completed First Contact then current is the Moon', () => {
  const nodes = getMissionMap(['mission-1'], 'Cadet');
  expect(nodes[0]).toMatchObject({ status: 'completed', completed: true });
  expect(nodes[1]).toMatchObject({ status: 'current', playable: true });
  expect(nodes[2].status).toBe('locked');
});

test('Bridge cockpit has the ship, Zib line, console, and no space-cards', async ({ page }) => {
  await seedPlayer(page);
  await openBridge(page);

  await expect(page.getByTestId('zib-ship')).toBeVisible();
  await expect(page.getByTestId('zib-ship')).toHaveAttribute('data-ship-layout', 'upright');
  await expect(page.getByTestId('bridge-ship-energy')).toHaveText('40 / 100');
  await expect(page.locator('.ship-part-boosters')).toHaveCount(1);
  await expect(page.locator('.bridge-zib-figure')).toHaveAttribute('src', /zib-stand\.webp/);
  await expect(page.getByTestId('bridge-rank-card')).toBeVisible();
  await expect(page.getByTestId('rank-badge-Cadet')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'First Contact' })).toBeVisible();
  await expect(page.getByRole('button', { name: /START MISSION/i })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Briefing' })).toBeVisible();
  await expect(page.getByTestId('bridge-switch-player')).toBeVisible();
  await expect(page.getByTestId('parent-zone-button')).toBeVisible();
  await expect(page.getByText('Parents', { exact: true })).toBeVisible();
  await expect(page.getByText('Switch', { exact: true })).toBeVisible();
  await expect(page.getByTestId('planet-node-moon')).toBeVisible();
  await expect(page.getByTestId('planet-node-mars')).toBeVisible();
  await expect(page.locator('.bridge-cockpit .space-card')).toHaveCount(0);
  await expect(page.locator('.idle-glow, .pulse-action, .pulse-idle')).toHaveCount(0);
});

test('completed planet opens that mission library', async ({ page }) => {
  await seedPlayer(page, { missionsCompleted: ['mission-1'] });
  await openBridge(page);
  await page.getByTestId('planet-node-earth').click();
  await expect(page.getByRole('heading', { level: 2, name: 'First Contact' })).toBeVisible();
  await expect(page.getByText('Zib crash-landed near our base.')).toBeVisible();
});

async function assertNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => {
    const root = document.querySelector('.bridge-cockpit') as HTMLElement | null;
    if (!root) return { scroll: 0, client: 0 };
    return { scroll: root.scrollWidth, client: root.clientWidth };
  });
  expect(overflow.scroll, `horizontal overflow ${overflow.scroll} > ${overflow.client}`).toBeLessThanOrEqual(overflow.client + 1);
}

async function assertMinTap(page: Page, testId: string) {
  const box = await page.getByTestId(testId).boundingBox();
  expect(box, testId).toBeTruthy();
  expect(box!.height, `${testId} height`).toBeGreaterThanOrEqual(44);
  expect(box!.width, `${testId} width`).toBeGreaterThanOrEqual(44);
}

test('desktop 1920x1080 cockpit', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await seedPlayer(page);
  await openBridge(page);
  await expect(page.getByTestId('zib-ship')).toBeVisible();
  await assertNoHorizontalScroll(page);
  await page.screenshot({ path: '/opt/cursor/artifacts/bridge-cockpit-desktop.png' });
});

test('Chromebook 1366x768 cockpit', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await seedPlayer(page);
  await openBridge(page);
  await expect(page.getByRole('button', { name: /START MISSION/i })).toBeVisible();
  await assertNoHorizontalScroll(page);
  await page.screenshot({ path: '/opt/cursor/artifacts/bridge-cockpit-chromebook.png' });
});

test('phone 390x844 cockpit', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedPlayer(page);
  await openBridge(page);
  await expect(page.getByRole('button', { name: /START MISSION/i })).toBeVisible();
  await assertMinTap(page, 'bridge-switch-player');
  await assertMinTap(page, 'parent-zone-button');
  await assertNoHorizontalScroll(page);
  await page.screenshot({ path: '/opt/cursor/artifacts/bridge-cockpit-phone.png' });
});

test('phone 360x740 cockpit', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await seedPlayer(page);
  await openBridge(page);
  await expect(page.getByRole('button', { name: /START MISSION/i })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Briefing' })).toBeVisible();
  await assertNoHorizontalScroll(page);
  await page.screenshot({ path: '/opt/cursor/artifacts/bridge-cockpit-phone-narrow.png' });
});

test('landscape phone keeps START on screen', async ({ page }) => {
  await page.setViewportSize({ width: 740, height: 360 });
  await seedPlayer(page);
  await openBridge(page);
  await expect(page.getByRole('button', { name: /START MISSION/i })).toBeVisible();
  await assertNoHorizontalScroll(page);
});
