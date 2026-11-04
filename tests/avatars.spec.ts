/**
 * Illustrated avatars: picker and create-form grid must render the webps,
 * not emoji. Existing profile ids (rocket, etc.) still resolve.
 */
import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const SHOTS = '/opt/cursor/artifacts/screenshots';

async function seedPlayers(page: Page) {
  await page.addInitScript(() => {
    const now = Date.now();
    const ids = [
      { id: 'qa-a', name: 'Kid1', avatarId: 'rocket' },
      { id: 'qa-b', name: 'Kid2', avatarId: 'alien' },
      { id: 'qa-c', name: 'Kid3', avatarId: 'robot' }
    ];
    const profiles = ids.map((p) => ({
      ...p,
      interests: ['dinosaurs'],
      createdAt: now,
      lastActiveAt: now,
      hasWatchedIntro: true,
      hasCompletedInterests: true
    }));
    const progress: Record<string, unknown> = {};
    for (const p of profiles) {
      progress[p.id] = {
        profileId: p.id,
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
      };
    }
    localStorage.setItem('space_readers_profiles', JSON.stringify(profiles));
    localStorage.setItem('space_readers_progress', JSON.stringify(progress));
  });
}

test('picker and profile form show illustrated avatar images', async ({ page }) => {
  mkdirSync(SHOTS, { recursive: true });
  await seedPlayers(page);
  await page.goto('/');
  await expect(page.getByTestId('profile-card-qa-a')).toBeVisible();

  const pickerImgs = page.locator('[data-testid="profile-card-qa-a"] img, [data-testid="profile-card-qa-b"] img, [data-testid="profile-card-qa-c"] img');
  await expect(pickerImgs).toHaveCount(3);
  for (const loc of await pickerImgs.all()) {
    await loc.evaluate((el: HTMLImageElement) => (el.complete ? null : new Promise((r) => { el.onload = () => r(null); el.onerror = () => r(null); })));
    const w = await loc.evaluate((el: HTMLImageElement) => el.naturalWidth);
    expect(w).toBeGreaterThan(0);
    await expect(loc).toHaveAttribute('src', /\/avatars\/(rocket|alien|robot)\.webp/);
  }

  await page.screenshot({ path: `${SHOTS}/picker-illustrated-avatars.png`, fullPage: true });

  await page.getByRole('button', { name: 'Add Player' }).click();
  await page.getByLabel('Player name').fill('Nova');
  await page.getByRole('button', { name: /Next/ }).click();
  const chooser = page.getByTestId('avatar-chooser');
  await expect(chooser).toBeVisible();
  const chooserImgs = chooser.locator('img');
  await expect(chooserImgs).toHaveCount(12);
  for (const loc of await chooserImgs.all()) {
    const w = await loc.evaluate((el: HTMLImageElement) => el.naturalWidth);
    expect(w).toBeGreaterThan(0);
    await expect(loc).toHaveAttribute('src', /\/avatars\/.+\.webp/);
  }

  await page.screenshot({ path: `${SHOTS}/profile-form-avatar-grid.png` });
});
