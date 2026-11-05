/**
 * Parent Zone gate: addition or single-digit multiplication (3–9), × symbol.
 */
import { test, expect, type Page } from '@playwright/test';
import { solveMathGate } from './parent-gate';

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

async function openGate(page: Page) {
  await page.getByTestId('parent-zone-button').click();
  await expect(page.getByTestId('parent-gate-question')).toBeVisible();
}

test('gate can show a multiplication question with factors 3–9', async ({ page }) => {
  await seedPlayer(page);
  await page.goto('/');
  await expect(page.getByTestId('profile-card-qa-a')).toBeVisible();

  let question = '';
  for (let attempt = 0; attempt < 24; attempt += 1) {
    await openGate(page);
    question = (await page.getByTestId('parent-gate-question').innerText()).trim();
    if (question.includes('×')) break;
    await page.getByRole('button', { name: /Cancel/i }).click();
    await expect(page.getByTestId('parent-gate')).toHaveCount(0);
  }

  expect(question, `expected a × question, last was ${question}`).toMatch(/×/);
  const parts = question.match(/(\d+)\s*×\s*(\d+)/);
  expect(parts).toBeTruthy();
  const a = Number(parts![1]);
  const b = Number(parts![2]);
  expect(a).toBeGreaterThanOrEqual(3);
  expect(a).toBeLessThanOrEqual(9);
  expect(b).toBeGreaterThanOrEqual(3);
  expect(b).toBeLessThanOrEqual(9);

  await page.getByTestId('parent-gate-question').screenshot({
    path: '/opt/cursor/artifacts/screenshots/parent-gate-multiply.png'
  });
  await page.locator('[data-testid="parent-gate"] .space-card').screenshot({
    path: '/opt/cursor/artifacts/screenshots/parent-gate-multiply-card.png'
  });

  await solveMathGate(page);
});

test('wrong answer generates a fresh math question', async ({ page }) => {
  await seedPlayer(page);
  await page.goto('/');
  await openGate(page);
  const first = (await page.getByTestId('parent-gate-question').innerText()).trim();
  for (let i = 0; i < 6; i += 1) {
    await page.getByTestId('parent-gate-key-0').click();
    await page.getByTestId('parent-gate-key-✓').click();
    await expect(page.getByText('Not quite! Try again.')).toBeVisible();
    const next = (await page.getByTestId('parent-gate-question').innerText()).trim();
    if (next !== first) {
      expect(next).toMatch(/(\d+\s*[+×]\s*\d+)/);
      return;
    }
  }
  expect((await page.getByTestId('parent-gate-question').innerText()).trim()).not.toBe(first);
});
