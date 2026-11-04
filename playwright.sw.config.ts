import { defineConfig } from '@playwright/test';

/**
 * Production-preview + service worker. The default playwright.config.ts
 * serves `npx vite` (dev, no generateSW), which never reproduces the
 * CacheFirst / Range / 206 voice-mp3 bug. These tests build dist/ and
 * hit vite preview so sw.js actually controls the page.
 */
export default defineConfig({
  testDir: 'tests',
  testMatch: /audio-sw\.spec\.ts/,
  fullyParallel: false,
  retries: 0,
  timeout: 90_000,
  use: {
    baseURL: 'http://127.0.0.1:4178',
    headless: process.env.HEADED !== '1',
    launchOptions: {
      executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome-stable',
      args: ['--no-sandbox', '--disable-gpu', '--autoplay-policy=no-user-gesture-required']
    }
  },
  webServer: {
    command: 'npx vite build && npx vite preview --host 127.0.0.1 --port 4178 --strictPort',
    port: 4178,
    reuseExistingServer: false,
    timeout: 180_000
  }
});
