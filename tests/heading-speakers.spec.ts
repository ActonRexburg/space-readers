/**
 * Heading block: one 🔊 that already reads title + subline.
 * The visible subline stays; it must not have its own speaker.
 */
import { test, expect, type Page } from '@playwright/test';

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

async function assertOneSpeakerOnHeading(page: Page) {
  const heading = page.getByRole('heading', { level: 2, name: 'First Contact' });
  await expect(heading).toBeVisible();
  await expect(heading.locator('xpath=following-sibling::button[contains(@class,"speak-btn")]')).toHaveCount(1);

  const sub = page.locator('p', { hasText: 'Help Zib learn to read.' });
  await expect(sub).toBeVisible();
  await expect(sub.locator('xpath=preceding-sibling::button[contains(@class,"speak-btn")]')).toHaveCount(0);
}

test('Bridge First Contact heading has one 🔊; subline is text only', async ({ page }) => {
  await seedPlayer(page);
  await page.goto('/');
  await page.getByTestId('profile-card-qa-a').click();
  await expect(page.getByRole('heading', { level: 2, name: 'First Contact' })).toBeVisible();
  await assertOneSpeakerOnHeading(page);
  await page.screenshot({
    path: '/opt/cursor/artifacts/screenshots/bridge-first-contact-one-speaker.png',
    fullPage: true
  });
});

test('Mission briefing heading has one 🔊; subline is text only', async ({ page }) => {
  await seedPlayer(page);
  await page.goto('/');
  await page.getByTestId('profile-card-qa-a').click();
  await page.getByRole('button', { name: /Start Mission/i }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'First Contact' })).toBeVisible();
  await assertOneSpeakerOnHeading(page);
  await expect(page.getByText('Zib crash-landed near our base.')).toBeVisible();
  await page.screenshot({
    path: '/opt/cursor/artifacts/screenshots/mission-briefing-one-speaker.png',
    fullPage: true
  });
});
