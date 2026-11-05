/**
 * Sound-out slider finger hint: one across-and-back demo, then fade away.
 * Dragging dismisses it immediately. Slider stays silent.
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

async function openSoundOutSlider(page: Page) {
  await seedPlayer(page);
  await page.goto('/');
  await page.getByTestId('profile-card-qa-a').click();
  await page.getByRole('button', { name: /Start Mission/i }).click();
  await page.getByRole('button', { name: /Accept/i }).click();
  await page.getByRole('heading', { name: 'The Lost Ship' }).click();
  await page.locator('.word-highlight', { hasText: /^red$/ }).click();
  await expect(page.getByLabel('Sound out slider')).toBeVisible();
}

test('finger hint plays once then fades away', async ({ page }) => {
  await openSoundOutSlider(page);
  const hint = page.getByTestId('slider-hand-hint');
  await expect(hint).toBeVisible();
  await expect(hint).toBeHidden({ timeout: 8000 });
  await expect(page.getByLabel('Sound out slider')).toBeVisible();
  await page.screenshot({
    path: '/opt/cursor/artifacts/screenshots/decoder-hint-gone.png',
    fullPage: true
  });
});

test('finger hint disappears as soon as the child starts dragging', async ({ page }) => {
  await openSoundOutSlider(page);
  const hint = page.getByTestId('slider-hand-hint');
  await expect(hint).toBeVisible();
  await page.getByLabel('Sound out slider').dispatchEvent('pointerdown');
  await expect(hint).toBeHidden({ timeout: 1000 });
});
