import { defineConfig, devices } from '@playwright/test';
import { config as loadEnv } from 'dotenv';

// Playwright's test runner does NOT go through Vite — `import.meta.env` is a
// Vite-only feature and is unavailable here, unlike in the Vitest RLS suite
// (src/test/rls.integration.test.ts). Load .env files explicitly instead.
// Later calls don't override already-set values, so .env.test.local (test
// account credentials) takes priority over .env.local if both define a key.
loadEnv({ path: '.env.test.local' });
loadEnv({ path: '.env.local' });

// T0-7 — Playwright E2E smoke tests.
//
// IMPORTANT: there is no separate staging environment for this project — the
// app (whether served locally via `npm run dev` or at the deployed URL)
// always talks to the SAME live Supabase project. There is no way to point
// these tests at throwaway data. See e2e/README.md for the resulting rules
// every spec here follows (tagged test data, self-cleanup, admin-only
// mutating specs).
//
// BASE_URL defaults to the local dev server (matches vite.config.ts's actual
// port, 8080 — NOT the 5173 previously listed in .claude/launch.json, which
// was a stale mismatch fixed alongside this file). Override to point at the
// deployed app instead: BASE_URL=https://qtech-crm.vercel.app npm run test:e2e

const PORT = 8080;
const BASE_URL = process.env.BASE_URL ?? `http://localhost:${PORT}`;
const isLocal = BASE_URL.includes('localhost');

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // mutating specs share one live database — no concurrent writes
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 60_000,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',

  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],

  // Only auto-start the dev server when testing locally — never spawn one
  // when BASE_URL points at the deployed app.
  webServer: isLocal
    ? {
        command: 'npm run dev',
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 30_000,
      }
    : undefined,
});
