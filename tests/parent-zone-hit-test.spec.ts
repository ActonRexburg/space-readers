/**
 * Real hit-testing for Parent Zone overlays.
 *
 * Live QA found the player grid painting on top of the math gate / Manage /
 * Delete UI because ParentZone lived inside header.relative.z-10. Synthetic
 * clicks still worked; elementFromPoint at the button center did not.
 */
import { test, expect, type Locator, type Page } from '@playwright/test';
import { solveMathGate } from './parent-gate';

async function seedPlayers(page: Page) {
  await page.addInitScript(() => {
    const now = Date.now();
    const profiles = ['qa-a', 'qa-b', 'qa-c'].map((id, i) => ({
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
    localStorage.setItem('space_readers_settings', JSON.stringify({
      parentPin: '1234',
      audioEnabled: true,
      speechRate: 1.0,
      zibClipsEnabled: false,
      activeProfileId: 'qa-a'
    }));
  });
}

async function hitAtCenter(page: Page, locator: Locator) {
  const box = await locator.boundingBox();
  expect(box, 'target must be visible').toBeTruthy();
  const x = box!.x + box!.width / 2;
  const y = box!.y + box!.height / 2;
  const hit = await page.evaluate(({ x, y }) => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    if (!el) return { testId: null, text: '', tag: null };
    const withId = el.closest('[data-testid]') as HTMLElement | null;
    return {
      testId: withId?.getAttribute('data-testid') ?? null,
      text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80),
      tag: el.tagName
    };
  }, { x, y });
  return { x, y, hit };
}

test.describe('Parent Zone hit testing', () => {
  test('keypad, Manage, and Delete receive elementFromPoint — not player cards', async ({ page }) => {
    await seedPlayers(page);
    await page.goto('/');
    await expect(page.getByTestId('profile-card-qa-a')).toBeVisible();
    await expect(page.getByTestId('zib-comm-link')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Got it!' })).toHaveCount(0);

    await page.getByTestId('parent-zone-button').click();
    const five = page.getByTestId('parent-gate-key-5');
    await expect(five).toBeVisible();

    const gateHit = await hitAtCenter(page, five);
    expect(gateHit.hit.testId, `keypad hit was ${JSON.stringify(gateHit.hit)}`).toBe('parent-gate-key-5');
    expect(gateHit.hit.testId).not.toMatch(/^profile-card-/);

    await solveMathGate(page);

    const manage = page.getByTestId('parent-manage').first();
    await expect(manage).toBeVisible();
    const manageHit = await hitAtCenter(page, manage);
    expect(manageHit.hit.testId, `Manage hit was ${JSON.stringify(manageHit.hit)}`).toBe('parent-manage');
    expect(manageHit.hit.testId).not.toMatch(/^profile-card-/);

    await manage.click();
    const deletePlayer = page.getByTestId('parent-manage-delete');
    await expect(deletePlayer).toBeVisible();
    const deleteHit = await hitAtCenter(page, deletePlayer);
    expect(deleteHit.hit.testId, `Delete-player hit was ${JSON.stringify(deleteHit.hit)}`).toBe('parent-manage-delete');
    expect(deleteHit.hit.testId).not.toMatch(/^profile-card-/);

    await deletePlayer.click();
    const confirm = page.getByTestId('confirm-delete');
    await expect(confirm).toBeVisible();
    const confirmHit = await hitAtCenter(page, confirm);
    expect(confirmHit.hit.testId, `confirm Delete hit was ${JSON.stringify(confirmHit.hit)}`).toBe('confirm-delete');
    expect(confirmHit.hit.testId).not.toMatch(/^profile-card-/);
  });

  test('Bridge parent 👤 overlays also sit above the page', async ({ page }) => {
    await seedPlayers(page);
    await page.goto('/');
    await page.getByTestId('profile-card-qa-a').click();
    await page.waitForURL(/bridge/);
    await expect(page.getByTestId('parent-zone-button')).toBeVisible();

    await page.getByTestId('parent-zone-button').click();
    const five = page.getByTestId('parent-gate-key-5');
    await expect(five).toBeVisible();
    const gateHit = await hitAtCenter(page, five);
    expect(gateHit.hit.testId).toBe('parent-gate-key-5');

    await solveMathGate(page);
    const manage = page.getByTestId('parent-manage').first();
    const manageHit = await hitAtCenter(page, manage);
    expect(manageHit.hit.testId).toBe('parent-manage');
  });
});
