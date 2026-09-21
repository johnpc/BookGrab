import { mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { dirname } from "path";

/**
 * Single source of truth for the MAM session cookie.
 *
 * MAM rotates `mam_id` on every dynamicSeedbox call, so the token must be
 * writable at runtime. MAM_TOKEN is only a seed for first boot; once the
 * file exists it wins, otherwise a container restart would silently revert
 * to a stale env value.
 */

const tokenFilePath = (): string | undefined => process.env.MAM_TOKEN_FILE;

const readTokenFile = (filePath: string): string | undefined => {
  try {
    const value = readFileSync(filePath, "utf-8").trim();
    return value.length > 0 ? value : undefined;
  } catch {
    return undefined;
  }
};

/** Atomic write, so a crash mid-write cannot truncate the token. */
export const persistMamToken = (token: string): boolean => {
  const filePath = tokenFilePath();
  if (!filePath || token.trim().length === 0) return false;

  try {
    mkdirSync(dirname(filePath), { recursive: true });
    const tmp = `${filePath}.tmp`;
    writeFileSync(tmp, `${token.trim()}\n`, { mode: 0o600 });
    renameSync(tmp, filePath);
    return true;
  } catch (error) {
    console.error("Failed to persist MAM token:", error);
    return false;
  }
};

export const getMamToken = (): string | undefined => {
  const filePath = tokenFilePath();

  if (filePath) {
    const fromFile = readTokenFile(filePath);
    if (fromFile) return fromFile;

    // First boot: seed the file from the env var so later rotations persist.
    const seed = process.env.MAM_TOKEN?.trim();
    if (seed) {
      persistMamToken(seed);
      return seed;
    }
    return undefined;
  }

  return process.env.MAM_TOKEN?.trim() || undefined;
};
