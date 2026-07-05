import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test',
  use: {
    browserName: 'chromium',
    headless: process.env['CI'] === 'true',
  },
  timeout: 60_000,
  workers: 1,
});
