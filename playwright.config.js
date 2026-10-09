import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  reporter: 'list',
  use: {
    baseURL: process.env.BASE_URL || 'https://embs-quiz.vercel.app',
    headless: false,
    launchOptions: { slowMo: 250 },
    trace: 'retain-on-failure',
  },
});
