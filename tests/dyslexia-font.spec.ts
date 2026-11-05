/**
 * Parent Zone dyslexia-friendly font: off by default, device-wide,
 * OpenDyslexic on story sentences when enabled.
 */
import { test, expect, type Page } from '@playwright/test';
import { solveMathGate } from './parent-gate';

async function seedPlayer(page: Page) {
  await page.addInitScript(() => {
    const now = Date.now();
    const profiles = [{
      id: 'qa-a',
      name: 'Kid1',
      avatarId: 'rocket',
      interests: ['dinosaurs'],
      createdAt: now,
      lastActiveAt: now,
      hasWatchedIntro: true,
      hasCompletedInterests: true
    }];
    localStorage.setItem('space_readers_profiles', JSON.stringify(profiles));
    localStorage.setItem('space_readers_progress', JSON.stringify({
      'qa-a': {
        profileId: 'qa-a',
        fuelCredits: 10,
        starCredits: 1,
        currentRank: 'Recruit',
        totalWordsDecoded: 0,
        storiesCompleted: [],
        missionsCompleted: [],
        planetsUnlocked: ['earth'],
        alienLearnedWords: [],
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
  });
}

async function openParentDashboard(page: Page) {
  await page.getByTestId('parent-zone-button').click();
  await solveMathGate(page);
}

test('dyslexia font toggle is off by default and preview uses OpenDyslexic', async ({ page }) => {
  await seedPlayer(page);
  await page.goto('/');
  await expect(page.getByTestId('profile-card-qa-a')).toBeVisible();
  await openParentDashboard(page);

  const toggle = page.getByTestId('dyslexia-font-toggle');
  await expect(toggle).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains('dyslexia-font'))).toBe(false);

  const preview = page.getByTestId('dyslexia-font-preview');
  await expect(preview).toHaveText('The red ship sat on a flat rock.');
  const previewFamily = await preview.evaluate((el) => getComputedStyle(el).fontFamily);
  expect(previewFamily, previewFamily).toMatch(/OpenDyslexic/i);

  await preview.scrollIntoViewIfNeeded();
  const settingsCard = page.locator('.space-card').filter({ has: toggle });
  await settingsCard.screenshot({
    path: '/opt/cursor/artifacts/screenshots/dyslexia-font-setting.png'
  });
});

test('turning on dyslexia font applies OpenDyslexic to story sentences', async ({ page }) => {
  await seedPlayer(page);
  await page.goto('/');
  await openParentDashboard(page);
  await page.getByTestId('dyslexia-font-toggle').click();
  await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains('dyslexia-font'))).toBe(true);

  await page.getByRole('button', { name: /Close/i }).click();
  await expect(page.getByTestId('parent-dashboard')).toHaveCount(0);
  await page.getByTestId('profile-card-qa-a').click();
  await page.getByRole('button', { name: /Start Mission/i }).click();
  await page.getByRole('button', { name: /Accept/i }).click();
  await page.getByRole('heading', { name: 'The Lost Ship' }).click();

  const sentence = page.locator('.story-text-large').first();
  await expect(sentence).toBeVisible();
  const family = await sentence.evaluate((el) => getComputedStyle(el).fontFamily);
  expect(family, family).toMatch(/OpenDyslexic/i);

  const headingFamily = await page.locator('h1').first().evaluate((el) => getComputedStyle(el).fontFamily);
  expect(headingFamily, headingFamily).not.toMatch(/OpenDyslexic/i);

  await page.screenshot({
    path: '/opt/cursor/artifacts/screenshots/dyslexia-font-story.png',
    fullPage: true
  });
});
