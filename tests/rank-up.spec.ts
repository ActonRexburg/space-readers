/**
 * Rank-up sequence after Claim Rewards: bar fills, badge flips,
 * then Bridge shows the new insignia. Sequenced after the ship fill.
 */
import { test, expect, type Page } from '@playwright/test';
import { rankBarPercent } from '../src/data/ranks';

async function seedPlayer(page: Page, extra: {
  storiesCompleted?: string[];
  shipEnergy?: number;
  fuelCredits?: number;
} = {}) {
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
        fuelCredits: payload.fuelCredits ?? 10,
        starCredits: 1,
        currentRank: 'Recruit',
        totalWordsDecoded: 0,
        storiesCompleted: payload.storiesCompleted ?? [],
        missionsCompleted: [],
        planetsUnlocked: ['earth'],
        alienLearnedWords: [],
        shipEnergy: payload.shipEnergy ?? 20,
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
  }, extra);
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

async function reachDebrief(page: Page) {
  await page.goto('/');
  await page.getByTestId('profile-card-qa-a').click();
  await page.getByRole('button', { name: /Start Mission/i }).click();
  await page.getByRole('button', { name: /Accept/i }).click();
  await page.getByRole('heading', { name: "Zib's First Words" }).click();
  await finishOpenStory(page);
  await expect(page.getByTestId('ship-reward')).toBeVisible();
}

test('rank bar percent stays under 100 until the threshold', () => {
  expect(rankBarPercent(20, 'Recruit', 'Cadet')).toBe(40);
  expect(rankBarPercent(49, 'Recruit', 'Cadet')).toBeLessThan(100);
});

test('ship fill and rank-up are sequenced with Claim Rewards between', async ({ page }) => {
  test.setTimeout(60_000);
  await seedPlayer(page, {
    storiesCompleted: ['story-1-lost-ship', 'story-2-star-map'],
    shipEnergy: 20
  });
  await reachDebrief(page);
  await expect(page.getByTestId('rank-up-reward')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Claim Rewards/i })).toBeVisible();
  await page.locator('main').screenshot({
    path: '/tmp/rank-shots/ship-then-rank-step.png'
  });

  await page.getByRole('button', { name: /Claim Rewards/i }).click();
  await expect(page.getByTestId('rank-up-reward')).toBeVisible();
  await expect(page.getByTestId('ship-reward')).toHaveCount(0);
  await expect(page.getByTestId('rank-progress-fill')).toBeVisible();
  await page.waitForTimeout(900);
  await page.getByTestId('rank-up-reward').screenshot({
    path: '/tmp/rank-shots/rank-bar-filling.png'
  });

  await expect(page.getByTestId('rank-promoted-message')).toBeVisible({ timeout: 12_000 });
  await expect(page.getByText('Promoted to Cadet!')).toBeVisible();
  await expect(page.getByText('Promotion confirmed. Welcome, Cadet.')).toBeVisible();
  await expect(page.getByText('You earned it, Cadet!')).toBeVisible();
  await expect(page.getByTestId('rank-badge-Cadet')).toBeVisible();
  await page.getByTestId('rank-up-reward').screenshot({
    path: '/tmp/rank-shots/rank-badge-reveal.png'
  });

  await page.getByRole('button', { name: /Continue/i }).click();
  await expect(page.getByTestId('bridge-rank-card')).toBeVisible();
  await expect(page.getByTestId('rank-badge-Cadet')).toBeVisible();
});

test('Bridge rank card shows the Recruit badge before promotion', async ({ page }) => {
  await seedPlayer(page);
  await page.goto('/');
  await page.getByTestId('profile-card-qa-a').click();
  await expect(page.getByTestId('bridge-rank-card')).toBeVisible();
  await expect(page.getByTestId('rank-badge-Recruit')).toBeVisible();
});
