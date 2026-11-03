/**
 * Idle-glow: at most one primary CTA per screen, and only after ~4s idle.
 * pulse-action / pulse-idle were removed — looping emphasis is `.idle-glow`.
 */
import { test, expect, type Page } from '@playwright/test';

async function seedPlayers(page: Page) {
  await page.addInitScript(() => {
    const now = Date.now();
    const profiles = ['qa-a', 'qa-b'].map((id, i) => ({
      id,
      name: `Kid${i + 1}`,
      avatarId: 'rocket',
      interests: ['dinosaurs', 'robots'],
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

test('empty picker: Create Player is the only idle-glow after ~4s', async ({ page }) => {
  await page.goto('/');
  const create = page.getByRole('button', { name: /Create Player/i });
  await expect(create).toBeVisible();
  await expect(page.locator('.pulse-action, .pulse-idle')).toHaveCount(0);
  await expect(create).not.toHaveClass(/idle-glow/);

  await expect(create).toHaveClass(/idle-glow/, { timeout: 6000 });
  await expect(page.locator('.idle-glow')).toHaveCount(1);

  await create.click();
  await expect(page.locator('.idle-glow')).toHaveCount(0);
});

test('picker with players: no idle-glow on cards or add-player', async ({ page }) => {
  await seedPlayers(page);
  await page.goto('/');
  await expect(page.getByTestId('profile-card-qa-a')).toBeVisible();
  await page.waitForTimeout(4500);
  await expect(page.locator('.idle-glow')).toHaveCount(0);
  await expect(page.locator('.pulse-action, .pulse-idle')).toHaveCount(0);
});

test('prefers-reduced-motion: idle-glow never applies', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Create Player/i })).toBeVisible();
  await page.waitForTimeout(4500);
  await expect(page.locator('.idle-glow')).toHaveCount(0);
});
