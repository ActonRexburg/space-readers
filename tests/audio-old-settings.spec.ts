/**
 * Old-format localStorage settings must not silence clips.
 *
 * Earlier builds saved `{ parentPin, volume: 0 }` or omitted speechRate /
 * zibClipsEnabled. getSettings used to return that blob as-is. volume=0
 * (or NaN from undefined) would mute HTMLAudioElement if we ever applied it.
 */
import { test, expect, type Page } from '@playwright/test';

async function seedOldSettings(page: Page) {
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
    // Pre-zibClips / pre-speechRate blob with a leftover volume: 0.
    localStorage.setItem('space_readers_settings', JSON.stringify({
      parentPin: '1234',
      volume: 0,
      muted: true,
      audioEnabled: true,
      activeProfileId: 'qa-a'
    }));
  });
}

test('old settings with volume:0 are healed and 🔊 still advances', async ({ page }) => {
  await seedOldSettings(page);
  await page.goto('/');
  await expect(page.getByTestId('profile-card-qa-a')).toBeVisible();

  const healed = await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('space_readers_settings') || 'null') as Record<string, unknown>;
    return raw;
  });
  expect(healed, JSON.stringify(healed)).not.toHaveProperty('volume');
  expect(healed).not.toHaveProperty('muted');
  expect(healed.zibClipsEnabled).toBe(true);
  expect(healed.speechRate).toBe(1);
  expect(healed.audioEnabled).toBe(true);

  const speaker = page.locator('.speak-btn').first();
  await expect(speaker).toBeVisible();
  await speaker.click();

  await expect.poll(() => {
    return page.evaluate(() => {
      const dbg = (window as unknown as {
        __srAudio?: { currentTime?: number; error?: string | null; htmlVolume?: number; htmlMuted?: boolean; gain?: number }
      }).__srAudio;
      return dbg?.currentTime ?? 0;
    });
  }, { timeout: 8000 }).toBeGreaterThan(0.05);

  const dbg = await page.evaluate(() => {
    return (window as unknown as {
      __srAudio?: { error?: string | null; htmlVolume?: number; htmlMuted?: boolean; gain?: number; engine?: string }
    }).__srAudio;
  });
  expect(dbg?.error ?? null).toBeNull();
  if (dbg?.engine === 'html') {
    expect(dbg.htmlVolume).toBe(1);
    expect(dbg.htmlMuted).toBe(false);
  }
  if (dbg?.gain != null) {
    expect(dbg.gain).toBe(1);
  }
});
