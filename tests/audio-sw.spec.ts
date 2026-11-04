/**
 * Headed/preview check: voice mp3s with the service worker ACTIVE.
 *
 * Load, reload so SW controls the page, clear nothing, play a clip twice
 * (network decode, then in-memory AudioBuffer cache hit). Verify
 * currentTime/contextDelta advances. Then plant a poisoned audio-cache*
 * 206 and confirm Web Audio fetch still returns a full body.
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
    localStorage.setItem('space_readers_settings', JSON.stringify({
      parentPin: '1234',
      audioEnabled: true,
      speechRate: 1.0,
      zibClipsEnabled: false,
      activeProfileId: 'qa-a'
    }));
  });
}

async function waitForSwControl(page: Page) {
  // skipWaiting + clientsClaim + VitePWA autoUpdate reloads once the SW
  // takes over. Wait across that navigation until the picker is back AND
  // this client is controlled.
  const picker = page.getByTestId('profile-card-qa-a');
  await expect(picker).toBeVisible({ timeout: 20_000 });

  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      const ok = await page.evaluate(() => (
        navigator.serviceWorker.controller != null &&
        Boolean(document.querySelector('[data-testid="profile-card-qa-a"]'))
      ));
      if (ok) {
        await page.waitForTimeout(700);
        const still = await page.evaluate(() => navigator.serviceWorker.controller != null);
        if (still && await picker.isVisible()) return;
      }
    } catch {
      // Execution context destroyed by the SW-driven reload — wait it out.
    }
    await expect(picker).toBeVisible({ timeout: 20_000 }).catch(() => undefined);
    await page.waitForTimeout(400);
  }

  await expect(picker).toBeVisible({ timeout: 20_000 });
  await page.waitForFunction(() => navigator.serviceWorker.controller != null, { timeout: 15_000 });
}

type AudioDbg = {
  file?: string;
  currentTime?: number;
  error?: string | null;
  playing?: boolean;
  engine?: string | null;
  cache?: 'memory' | 'network';
  duration?: number;
  contextDelta?: number;
  htmlVolume?: number;
  htmlMuted?: boolean;
  gain?: number;
  lastTest?: { zib: string; control: string; beep?: string };
};

async function readDbg(page: Page): Promise<AudioDbg | null> {
  return page.evaluate(() => {
    return (window as unknown as { __srAudio?: AudioDbg }).__srAudio ?? null;
  });
}

async function playSpeakerOnce(page: Page) {
  const speaker = page.locator('.speak-btn').first();
  await expect(speaker).toBeVisible();
  await speaker.click();
  await expect.poll(async () => {
    const dbg = await readDbg(page);
    return dbg?.currentTime ?? 0;
  }, { timeout: 8000 }).toBeGreaterThan(0.3);
  const dbg = await readDbg(page);
  expect(dbg?.error ?? null).toBeNull();
  expect(dbg?.engine === 'webaudio' || dbg?.engine === 'html').toBeTruthy();
  // Wait out the clip so the next click is play, not the stop toggle.
  await expect(speaker).not.toHaveClass(/speak-btn-playing/, { timeout: 8000 });
  return dbg;
}

test('SW-active voice clips advance on miss, hit, and poisoned audio-cache', async ({ page, baseURL }) => {
  const logs: string[] = [];
  page.on('console', (msg) => logs.push(msg.text()));
  page.on('pageerror', (err) => logs.push(`PAGEERROR ${err.message}`));

  await seedPlayers(page);
  await page.goto('/');
  await expect(page.getByTestId('profile-card-qa-a')).toBeVisible();

  // Reload so the newly installed SW controls this client. Do not clear caches.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('profile-card-qa-a')).toBeVisible();
  await waitForSwControl(page);

  const swInfo = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    return {
      controlled: navigator.serviceWorker.controller != null,
      scriptURL: navigator.serviceWorker.controller?.scriptURL ?? null,
      active: reg?.active?.scriptURL ?? null
    };
  });
  expect(swInfo.controlled, `SW should control the page: ${JSON.stringify(swInfo)}`).toBe(true);

  await expect.poll(() => logs.some((l) => l.includes('[speak] manifest loaded')), {
    timeout: 8000
  }).toBe(true);

  // Who's playing? autoPlays on the picker — wait it out so our click is play, not stop.
  await expect(page.locator('.speak-btn').first()).not.toHaveClass(/speak-btn-playing/, {
    timeout: 8000
  });

  // Cache miss (first decode) then cache hit (in-memory AudioBuffer).
  const first = await playSpeakerOnce(page);
  expect(first?.cache === 'network' || first?.cache === 'memory' || first?.engine === 'html').toBeTruthy();

  const second = await playSpeakerOnce(page);
  // Second play may be in-memory Web Audio or HTML fallback (stalled ctx).
  expect(second?.engine === 'webaudio' || second?.engine === 'html').toBeTruthy();
  if (second?.engine === 'html') {
    expect(second.htmlVolume).toBe(1);
    expect(second.htmlMuted).toBe(false);
  }

  // Plant a poisoned CacheFirst leftover: 206 with 4 bytes. NetworkOnly +
  // Web Audio fetch() must still return a real mp3 body.
  const poison = await page.evaluate(async () => {
    const origin = location.origin;
    const base = document.querySelector('base')?.getAttribute('href') || '/';
    const sample = (window as unknown as { __srAudio?: { file?: string } }).__srAudio?.file;
    const path = `${base.replace(/\/?$/, '/')}audio/voice/${sample || '2e122a7545b9c715.mp3'}`;
    const url = new URL(path, origin).href;
    const body = new Uint8Array([0xff, 0xfb, 0x90, 0x00]);
    // Cache API rejects status 206. The real poison is a truncated 200
    // (what CacheFirst stored when Range/partial handling went wrong).
    const poisoned = new Response(body, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': '4'
      }
    });
    const names = ['audio-cache', 'audio-cache-v2', 'sr-2026-11-audio-audio-cache-v2'];
    for (const name of names) {
      const cache = await caches.open(name);
      await cache.put(url, poisoned.clone());
    }
    const res = await fetch(url, { cache: 'no-store' });
    const bytes = (await res.arrayBuffer()).byteLength;
    return { url, fetchStatus: res.status, bytes, sample };
  });

  expect(
    poison.bytes,
    `poisoned cache must not be served to fetch(): ${JSON.stringify(poison)}`
  ).toBeGreaterThan(500);
  expect(poison.fetchStatus).toBe(200);

  await page.waitForTimeout(500);
  const afterPoison = await playSpeakerOnce(page);
  expect(afterPoison?.error ?? null).toBeNull();
  expect(afterPoison?.currentTime ?? 0).toBeGreaterThan(0.3);

  // Activate-time purge: leftover audio-cache* keys must disappear.
  const purge = await page.evaluate(async () => {
    await caches.open('audio-cache-poisoned-test');
    const before = await caches.keys();
    navigator.serviceWorker.controller?.postMessage({ type: 'SR_PURGE_AUDIO_CACHE' });
    await new Promise((r) => setTimeout(r, 500));
    const after = await caches.keys();
    return {
      beforeHas: before.filter((k) => /audio-cache/i.test(k)),
      afterHas: after.filter((k) => /audio-cache/i.test(k))
    };
  });
  expect(purge.beforeHas.length).toBeGreaterThan(0);
  expect(purge.afterHas, `audio-cache* should be deleted: ${JSON.stringify(purge)}`).toEqual([]);

  const afterClick = logs.join('\n');
  expect(afterClick).not.toMatch(/NotAllowedError/);
  expect(afterClick).not.toMatch(/PAGEERROR/);
  expect(baseURL).toContain('4178');
});


test('Parent Zone Audio test reports fetch/decode/advanced evidence', async ({ page }) => {
  await seedPlayers(page);
  await page.goto('/');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('profile-card-qa-a')).toBeVisible();
  await waitForSwControl(page);

  await page.getByTestId('parent-zone-button').click();
  await page.waitForTimeout(400);
  const question = await page.locator('[data-testid="parent-gate"]').innerText();
  const match = question.match(/(\d+)\s*\+\s*(\d+)/);
  expect(match, `math question parseable: ${question}`).toBeTruthy();
  const answer = String(Number(match![1]) + Number(match![2]));
  for (const digit of answer) {
    await page.locator(`[data-testid="parent-gate-key-${digit}"]`).click();
  }
  await page.locator('[data-testid="parent-gate-key-✓"]').click();
  await expect(page.locator('[data-testid="parent-dashboard"]')).toBeVisible();

  const audioBtn = page.getByTestId('audio-test');
  await expect(audioBtn).toBeVisible();
  await audioBtn.click();

  const result = page.getByTestId('audio-test-result');
  await expect(result).toBeVisible();
  await expect.poll(async () => (await result.innerText()).includes('Playing…') === false, {
    timeout: 45_000
  }).toBe(true);

  const text = await result.innerText();
  expect(text, text).toMatch(/Beep:/);
  expect(text, text).toMatch(/440Hz sine/);
  expect(text, text).toMatch(/fetch:\s+200\s+\d+ bytes/);
  expect(text, text).toMatch(/decode:\s+OK duration=/);
  expect(text, text).toMatch(/bufferPeak:/);
  expect(text, text).toMatch(/gain: 1/);
  expect(text, text).toMatch(/RESULT: PASS/);
  expect(text, text).toMatch(/Zib:/);
  expect(text, text).toMatch(/Mission Control:/);
  expect(text, text).toMatch(/settings raw:/);
  expect(text, text).toMatch(/settings merged:/);

  await result.scrollIntoViewIfNeeded();
  await result.screenshot({
    path: '/opt/cursor/artifacts/screenshots/audio-test-evidence.png'
  });
  await page.screenshot({
    path: '/opt/cursor/artifacts/screenshots/audio-test-dashboard.png',
    fullPage: true
  });
});
