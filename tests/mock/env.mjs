/**
 * Environment that points the app at the mock backend. Shared by
 * with-mock-backend.mjs (dev) and playwright.config.ts (e2e).
 */
import { tmpdir } from "node:os";
import { join } from "node:path";

export const MOCK_PORT = Number(process.env.MOCK_PORT ?? 4010);
export const MOCK_ORIGIN = `http://127.0.0.1:${MOCK_PORT}`;
export const MOCK_MAM_TOKEN = process.env.MOCK_MAM_TOKEN ?? "mock-token";

/** Scratch area the app and the e2e tests share to prove copy-on-complete. */
export const E2E_FS_ROOT = join(tmpdir(), "bookgrab-e2e");
export const E2E_COPY_AUDIOBOOKS = join(E2E_FS_ROOT, "copy", "audiobooks");
export const E2E_COPY_EBOOKS = join(E2E_FS_ROOT, "copy", "ebooks");
/** Where "/mock/..." (Transmission's view) lives on this machine. */
export const E2E_DOWNLOADS_ROOT = join(E2E_FS_ROOT, "downloads");

export const mockAppEnv = {
  MAM_BASE_URL: MOCK_ORIGIN,
  MAM_SEEDBOX_URL: `${MOCK_ORIGIN}/json/dynamicSeedbox.php`,
  MAM_TOKEN: MOCK_MAM_TOKEN,
  TRANSMISSION_URL: `${MOCK_ORIGIN}/transmission/rpc`,
  AUDIOBOOK_DESTINATION_PATH: "/mock/audiobooks",
  EBOOK_DESTINATION_PATH: "/mock/ebooks",
  AUDIOBOOK_COPY_PATH: E2E_COPY_AUDIOBOOKS,
  EBOOK_COPY_PATH: E2E_COPY_EBOOKS,
  TRANSMISSION_PATH_MAP: `/mock=${E2E_DOWNLOADS_ROOT}`,
  COPY_QUEUE_FILE: join(E2E_FS_ROOT, "copy-queue.json"),
  COPY_POLL_INTERVAL_MS: "200",
  // The scheduled server-side keepalive would add nondeterministic requests.
  MAM_KEEPALIVE_DISABLED: "true",
  NEXT_TELEMETRY_DISABLED: "1",
};
