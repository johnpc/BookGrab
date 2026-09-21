import { getMamToken, persistMamToken } from "./mam-token";

const DYNAMIC_SEEDBOX_URL =
  "https://t.myanonamouse.net/json/dynamicSeedbox.php";

export interface KeepaliveResult {
  success: boolean;
  message: string;
  rotated: boolean;
  hint?: string;
}

interface SeedboxResponse {
  Success?: boolean;
  msg?: string;
}

/**
 * MAM returns the refreshed cookie in Set-Cookie on every call, even when the
 * IP is unchanged ("No change"). Dropping it is what lets the stored token go
 * stale, so we always capture and persist it.
 */
const extractRotatedToken = (response: Response): string | undefined => {
  const headers = response.headers as Headers & {
    getSetCookie?: () => string[];
  };
  const cookies =
    typeof headers.getSetCookie === "function"
      ? headers.getSetCookie()
      : [response.headers.get("set-cookie") ?? ""];

  for (const cookie of cookies) {
    const match = cookie.match(/(?:^|;\s*)mam_id=([^;]+)/);
    if (match?.[1]) return match[1];
  }
  return undefined;
};

export const refreshMamSession = async (
  overrideToken?: string,
): Promise<KeepaliveResult> => {
  const token = overrideToken || getMamToken();
  if (!token) {
    return {
      success: false,
      message: "No MAM token configured",
      rotated: false,
    };
  }

  const response = await fetch(DYNAMIC_SEEDBOX_URL, {
    method: "GET",
    headers: {
      Cookie: `mam_id=${token}`,
      "User-Agent": "BookGrab/1.0",
    },
    cache: "no-store",
  });

  const text = await response.text();
  let parsed: SeedboxResponse = {};
  try {
    parsed = JSON.parse(text) as SeedboxResponse;
  } catch {
    // MAM occasionally returns bare text; fall through to the text checks.
  }

  const message = parsed.msg ?? text.slice(0, 200);
  // "Completed" = re-bound to a new IP, "No change" = already correct.
  const success =
    parsed.Success === true || /completed|no change/i.test(text);

  if (!success) {
    const wrongType = /incorrect session type/i.test(text);
    return {
      success: false,
      message,
      rotated: false,
      hint: wrongType
        ? "Session is not a dynamic seedbox type. Recreate it in MAM security preferences with 'allow session to set dynamic seedbox IP' enabled."
        : undefined,
    };
  }

  const rotatedToken = extractRotatedToken(response);
  const rotated =
    rotatedToken !== undefined &&
    rotatedToken !== token &&
    persistMamToken(rotatedToken);

  return { success: true, message, rotated };
};
