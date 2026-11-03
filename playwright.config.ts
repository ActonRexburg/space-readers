import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  fullyParallel: false,
  retries: 0,
  timeout: 30_000,
  use: {
    baseURL: 'http://127.0.0.1:4175',
    headless: true,
    launchOptions: {
      executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome-stable',
      args: ['--no-sandbox', '--disable-gpu']
    }
  },
  webServer: {
    command: 'npx vite --host 127.0.0.1 --port 4175',
    port: 4175,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000
  }
});
