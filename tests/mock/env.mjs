/**
 * Environment that points the app at the mock backend. Shared by
 * with-mock-backend.mjs (dev) and playwright.config.ts (e2e).
 */
export const MOCK_PORT = Number(process.env.MOCK_PORT ?? 4010);
export const MOCK_ORIGIN = `http://127.0.0.1:${MOCK_PORT}`;
export const MOCK_MAM_TOKEN = process.env.MOCK_MAM_TOKEN ?? "mock-token";

export const mockAppEnv = {
  MAM_BASE_URL: MOCK_ORIGIN,
  MAM_SEEDBOX_URL: `${MOCK_ORIGIN}/json/dynamicSeedbox.php`,
  MAM_TOKEN: MOCK_MAM_TOKEN,
  TRANSMISSION_URL: `${MOCK_ORIGIN}/transmission/rpc`,
  AUDIOBOOK_DESTINATION_PATH: "/mock/audiobooks",
  EBOOK_DESTINATION_PATH: "/mock/ebooks",
  // The scheduled server-side keepalive would add nondeterministic requests.
  MAM_KEEPALIVE_DISABLED: "true",
  NEXT_TELEMETRY_DISABLED: "1",
};
