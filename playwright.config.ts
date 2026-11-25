import { defineConfig, devices } from "@playwright/test";
import { MOCK_ORIGIN, MOCK_PORT, mockAppEnv } from "./tests/mock/env.mjs";

/**
 * End-to-end tests run the production build (`next start`) against the mock
 * MAM + Transmission backend in tests/mock. No network, no real credentials.
 *
 * There is no such thing as a flaky test here: retries are 0 everywhere. If a
 * test fails intermittently, the test or the app has a race and must be fixed.
 */
const APP_PORT = Number(process.env.E2E_PORT ?? 3100);
export const APP_ORIGIN = `http://127.0.0.1:${APP_PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  // The mock backend holds shared state (added torrents, gated requests), so
  // tests run one at a time. Determinism beats a faster wall clock.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: APP_ORIGIN,
    trace: "retain-on-failure",
    video: process.env.E2E_VIDEO ? "on" : "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } } },
    { name: "mobile", use: { ...devices["iPhone 14"], browserName: "chromium" } },
  ],
  webServer: [
    {
      command: "node tests/mock/mock-backend.mjs",
      url: `${MOCK_ORIGIN}/health`,
      env: { MOCK_PORT: String(MOCK_PORT) },
      reuseExistingServer: !process.env.CI,
      timeout: 15_000,
    },
    {
      // Same entrypoint as the Docker image: node .next/standalone/server.js
      command: "node scripts/start-standalone.mjs",
      url: `${APP_ORIGIN}/api/status`,
      env: { ...mockAppEnv, PORT: String(APP_PORT) },
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
