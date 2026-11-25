import { getMamBaseUrl, getServerEnvVariables } from "./env";
import { refreshMamSession } from "./mam-session";
import { getMamToken } from "./mam-token";
import { AppError } from "./api-error";
import type { Book, BookCategory, SearchResponse } from "@/types";

// MAM language ids (tor[browse_lang]); English is 1. Accepts ids or common names/codes.
const MAM_LANG_IDS: Record<string, string> = {
  en: "1",
  eng: "1",
  english: "1",
};

export function parseLanguages(raw?: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean)
    .map((v) => (/^\d+$/.test(v) ? v : MAM_LANG_IDS[v]))
    .filter((v): v is string => Boolean(v));
}

// MAM main categories (tor.main_cat): 13 = AudioBooks, 14 = E-Books.
const MAM_MAIN_CAT: Record<string, string> = { audiobook: "13", ebook: "14" };

export function parseCategory(raw?: string | null): string[] {
  const id = raw ? MAM_MAIN_CAT[raw.trim().toLowerCase()] : undefined;
  return id ? [id] : [];
}

// MAM's full-text search returns nothing when the query carries search-syntax
// punctuation such as "?" ("Who Moved My Cheese?" -> 0 results). Titles never
// need it to match, so turn it into spaces.
export function sanitizeQuery(query: string): string {
  return query.replace(/[?!*"()|@~^$<>=]+/g, " ").replace(/\s+/g, " ").trim();
}

/** Shape of one row in MAM's loadSearchJSONbasic response (fields we read). */
export interface MamSearchItem {
  id: string | number;
  title?: string;
  main_cat?: string | number;
  author_info?: string;
  narrator_info?: string;
  description?: string;
  filetype?: string;
  tags?: string;
  dl?: string;
  size?: string;
  seeders?: string | number;
  leechers?: string | number;
  added?: string;
  times_completed?: string | number;
  language?: string | number;
  lang_code?: string;
}

export interface MamSearchPayload {
  perpage?: number | string;
  start?: number | string;
  total?: number | string;
  found?: number | string;
  data?: MamSearchItem[];
}

const toInt = (value: string | number | undefined | null): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const n = parseInt(value.replace(/,/g, ""), 10);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

const parseNameMap = (raw: string | undefined): string | undefined => {
  if (!raw) return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      const names = Object.values(parsed as Record<string, unknown>)
        .filter((v): v is string => typeof v === "string" && v.length > 0);
      return names.length ? names.join(", ") : undefined;
    }
  } catch {
    // Not JSON; ignore.
  }
  return undefined;
};

const COMMON_FORMATS = ["mp3", "m4a", "m4b", "flac", "epub", "mobi", "azw3", "pdf"];

function extractFormatFromTags(tags: string): string {
  const tagsLower = tags.toLowerCase();
  for (const format of COMMON_FORMATS) {
    if (tagsLower.includes(format)) return format;
  }
  return "";
}

/** Map one raw MAM row to our Book shape. Pure, so it is unit-testable. */
export function mapMamItem(item: MamSearchItem, baseUrl: string): Book {
  const category: BookCategory = String(item.main_cat) === "13" ? "audiobook" : "ebook";

  const author = parseNameMap(item.author_info) ?? "Unknown Author";
  const narrator = category === "audiobook" ? parseNameMap(item.narrator_info) : undefined;

  let length: string | undefined;
  if (category === "audiobook" && item.description) {
    const lengthMatch = item.description.match(
      /(\d+h\d+m|\d+:\d+:\d+|\d+ hrs?( \d+ mins?)?)/i,
    );
    if (lengthMatch) length = lengthMatch[1].trim();
  }

  let format = item.filetype?.trim() || "";
  if (!format) format = extractFormatFromTags(item.tags ?? "") || "Unknown";

  return {
    id: String(item.id),
    title: item.title?.trim() || "Unknown Title",
    author,
    narrator,
    format,
    length,
    torrentLink: `${baseUrl}/tor/download.php/${item.dl ?? ""}`,
    category,
    size: item.size ?? null,
    seeders: toInt(item.seeders),
    leechers: toInt(item.leechers),
    added: item.added ?? null,
    tags: item.tags ?? null,
    completed: toInt(item.times_completed),
    language:
      item.language !== undefined && item.language !== null
        ? Number(item.language)
        : undefined,
    langCode: item.lang_code || undefined,
  };
}

export interface SearchOptions {
  query: string;
  /** Token supplied by the browser (Settings). Takes precedence over the server token. */
  mamToken?: string;
  startNumber?: number;
  sortType?: string;
  languages?: string[];
  mainCategories?: string[];
}

export async function searchBooks(options: SearchOptions): Promise<SearchResponse> {
  const {
    query,
    mamToken,
    startNumber = 0,
    sortType = "seeds",
    languages = [],
    mainCategories = [],
  } = options;

  const { MAM_TOKEN: envToken } = getServerEnvVariables();
  const token = mamToken || envToken;

  if (!token) {
    throw new AppError(
      "MAM_NOT_CONFIGURED",
      "No MAM session token is configured.",
      { hint: "Add your MAM token in Settings, or set MAM_TOKEN on the server." },
    );
  }

  const searchPayload = {
    dlLink: "",
    tor: {
      text: sanitizeQuery(query),
      srchIn: {
        title: "true",
        author: "true",
        narrator: "true",
        series: "true",
        tags: "true",
      },
      searchType: "all",
      searchIn: "torrents",
      cat: ["0"],
      sortType,
      startNumber: startNumber.toString(),
      // Server-side language filter; omitted when empty so every language is returned.
      ...(languages.length ? { browse_lang: languages } : {}),
      // Optional audiobook/ebook-only search.
      ...(mainCategories.length ? { main_cat: mainCategories } : {}),
    },
    thumbnail: "true",
  };

  const baseUrl = getMamBaseUrl();
  const url = `${baseUrl}/tor/js/loadSearchJSONbasic.php`;

  const fetchWithToken = (t: string) =>
    fetch(url, {
      method: "POST",
      headers: {
        "User-Agent": "BookGrab/1.0",
        "Content-Type": "application/json",
        Cookie: `mam_id=${t}`,
      },
      body: JSON.stringify(searchPayload),
      cache: "no-store",
    });

  let response: Response;
  try {
    response = await fetchWithToken(token);
  } catch (error) {
    throw new AppError("MAM_UPSTREAM", "Could not reach MyAnonyMouse.", { cause: error });
  }

  // A 403 usually means the session drifted off our current IP. Re-bind it
  // and retry once so a rotated token heals without any manual step. Skipped
  // when the caller supplied its own token, since we must not overwrite it.
  if (response.status === 403 && !mamToken) {
    console.warn("MAM returned 403 - refreshing session and retrying");
    const refresh = await refreshMamSession();
    const refreshedToken = refresh.success ? getMamToken() : undefined;
    if (refreshedToken) {
      response = await fetchWithToken(refreshedToken);
    } else if (refresh.hint) {
      console.error(`MAM session refresh failed: ${refresh.hint}`);
    }
  }

  if (response.status === 403 || response.status === 401) {
    throw new AppError("MAM_AUTH", "MyAnonyMouse rejected the session token.", {
      hint: mamToken
        ? "Check the token in Settings. It must be a dynamic-seedbox session created on MAM."
        : "The server's MAM session is invalid or bound to another IP. Check the server logs.",
    });
  }

  if (!response.ok) {
    throw new AppError(
      "MAM_UPSTREAM",
      `MyAnonyMouse returned ${response.status} ${response.statusText}`.trim(),
    );
  }

  let payload: MamSearchPayload;
  try {
    payload = (await response.json()) as MamSearchPayload;
  } catch (error) {
    throw new AppError("MAM_UPSTREAM", "MyAnonyMouse returned an unreadable response.", {
      cause: error,
    });
  }

  const rows = Array.isArray(payload.data) ? payload.data : [];
  const books = rows.map((item) => mapMamItem(item, baseUrl));
  const totalResults = toInt(payload.found);
  const hasMore = startNumber + books.length < totalResults && books.length > 0;

  return { books, hasMore, totalResults };
}
