/**
 * Premade books show a small page picture above the sentence.
 * Sentences still have no 🔊. Missing image must not be required.
 */
import { existsSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import { STORIES } from '../src/data/stories';

async function seedPlayer(page: Page) {
  await page.addInitScript(() => {
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
        storiesCompleted: [],
        missionsCompleted: [],
        planetsUnlocked: ['earth'],
        alienLearnedWords: [],
        shipEnergy: 0,
        shipPartsUnlocked: [],
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

async function openLostShip(page: Page) {
  await seedPlayer(page);
  await page.goto('/');
  await page.getByTestId('profile-card-qa-a').click();
  await page.getByRole('button', { name: /Start Mission/i }).click();
  await page.getByRole('button', { name: /Accept/i }).click();
  await page.getByRole('heading', { name: 'The Lost Ship' }).click();
  await expect(page.getByRole('heading', { name: 'The Lost Ship' })).toBeVisible();
}

test('every premade paragraph has a public webp on disk', () => {
  const missing: string[] = [];
  for (const story of STORIES) {
    for (const [i, para] of story.paragraphs.entries()) {
      expect(para.image, `${story.title} p${i + 1}`).toBeTruthy();
      const path = `public/${para.image}`;
      if (!existsSync(path)) missing.push(path);
    }
  }
  expect(missing, missing.join('\n')).toEqual([]);
});

test('story page shows the picture above the sentence, no sentence 🔊', async ({ page }) => {
  await openLostShip(page);
  const img = page.getByTestId('story-page-image');
  await expect(img).toBeVisible();
  await expect.poll(async () =>
    img.evaluate((el) => (el as HTMLImageElement).naturalWidth)
  ).toBeGreaterThan(10);
  await expect(img).toHaveAttribute('alt', '');
  await expect(img).toHaveAttribute('loading', 'lazy');
  await expect(img).toHaveAttribute('decoding', 'async');
  await expect(img).toHaveAttribute('src', /stories\/story1\/page1\.webp/);
  const sentence = page.locator('p.story-text-large');
  await expect(sentence).toBeVisible();
  await expect(sentence).toContainText(/red/);
  await expect(sentence).toContainText(/ship/);
  await expect(sentence.locator('.speak-btn')).toHaveCount(0);

  await page.setViewportSize({ width: 1366, height: 768 });
  await expect(img).toBeVisible();
  await page.screenshot({
    path: '/opt/cursor/artifacts/story-page-desktop.png'
  });

  await page.getByRole('button', { name: 'Next →' }).click();
  await expect(img).toHaveAttribute('src', /stories\/story1\/page2\.webp/);
});

test('story page fits a phone width', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openLostShip(page);
  const img = page.getByTestId('story-page-image');
  await expect(img).toBeVisible();
  await expect.poll(async () =>
    img.evaluate((el) => (el as HTMLImageElement).naturalWidth)
  ).toBeGreaterThan(10);
  await expect(page.getByRole('button', { name: 'Next →' })).toBeVisible();
  await page.screenshot({
    path: '/opt/cursor/artifacts/story-page-phone.png'
  });
});
