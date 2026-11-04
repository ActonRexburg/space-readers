/**
 * Headed Chromium check: tapping 🔊 actually starts playback.
 * Root cause we are guarding: await ensureManifest() inside the click
 * dropped user-gesture activation so play() threw NotAllowedError and
 * was swallowed.
 */
import { test, expect, type Page } from '@playwright/test';

async function seedPlayers(page: Page) {
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
  });
}

test('tapping a speaker plays a clip without NotAllowedError', async ({ page }) => {
  const logs: string[] = [];
  page.on('console', (msg) => logs.push(msg.text()));

  await seedPlayers(page);
  await page.goto('/');
  await expect(page.getByTestId('profile-card-qa-a')).toBeVisible();

  // Wait for the preload fetch so speak() can play() in the same click turn.
  await expect.poll(() => logs.some((l) => l.includes('[speak] manifest loaded')), {
    timeout: 8000
  }).toBe(true);

  const speaker = page.locator('.speak-btn').first();
  await expect(speaker).toBeVisible();
  const logCountBeforeClick = logs.length;
  await speaker.click();

  await expect.poll(() => {
    return page.evaluate(() => {
      const dbg = (window as unknown as { __srAudio?: { playing?: boolean; currentTime?: number; error?: string | null; file?: string } }).__srAudio;
      return dbg ?? null;
    });
  }, { timeout: 8000 }).not.toBeNull();

  await expect.poll(() => {
    return page.evaluate(() => {
      const dbg = (window as unknown as { __srAudio?: { currentTime?: number } }).__srAudio;
      return dbg?.currentTime ?? 0;
    });
  }, { timeout: 8000 }).toBeGreaterThan(0.05);

  const dbg = await page.evaluate(() => {
    return (window as unknown as {
      __srAudio?: {
        playing?: boolean;
        currentTime?: number;
        error?: string | null;
        file?: string;
        engine?: string;
        htmlVolume?: number;
        htmlMuted?: boolean;
      }
    }).__srAudio;
  });

  const afterClick = logs.slice(logCountBeforeClick).join('\n');
  expect(afterClick, afterClick).not.toMatch(/NotAllowedError/);
  expect(dbg?.error ?? null).toBeNull();
  expect(dbg?.file || dbg?.playing || (dbg?.currentTime ?? 0) > 0).toBeTruthy();
  expect(dbg?.engine).toBe('html');
  expect(dbg?.htmlVolume).toBe(1);
  expect(dbg?.htmlMuted).toBe(false);
});
