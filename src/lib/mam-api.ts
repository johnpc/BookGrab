import { getServerEnvVariables } from "./env";
import { refreshMamSession } from "./mam-session";
import { getMamToken } from "./mam-token";
import { Book, SearchResponse } from "../types";

// MAM language ids (tor[browse_lang]); English is 1. Accepts ids or common names/codes.
const MAM_LANG_IDS: Record<string, string> = {
  en: "1", eng: "1", english: "1",
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

export async function searchBooks(
  query: string,
  mamToken?: string,
  startNumber: number = 0,
  sortType: string = "seeds",
  languages: string[] = [],
  mainCategories: string[] = [],
): Promise<SearchResponse> {
  try {
    const { MAM_TOKEN: envToken } = getServerEnvVariables();
    const MAM_TOKEN = mamToken || envToken;

    if (!MAM_TOKEN) {
      throw new Error(
        "MAM_TOKEN is required. Please configure it in Settings or set it in your environment variables.",
      );
    }

    // Construct the JSON search payload
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
        sortType: sortType,
        startNumber: startNumber.toString(),
        // Server-side language filter; omitted when empty so every language is returned.
        ...(languages.length ? { browse_lang: languages } : {}),
        // Optional audiobook/ebook-only search, so a big audiobook series cannot crowd ebooks off page one.
        ...(mainCategories.length ? { main_cat: mainCategories } : {}),
      },
      thumbnail: "true",
    };

    // Use the JSON API endpoint
    const url = "https://www.myanonamouse.net/tor/js/loadSearchJSONbasic.php";

    const fetchWithToken = (token: string) =>
      fetch(url, {
        method: "POST",
        headers: {
          "User-Agent": "BookGrab/1.0",
          "Content-Type": "application/json",
          Cookie: `mam_id=${token}`,
        },
        body: JSON.stringify(searchPayload),
        next: { revalidate: 0 }, // Don't cache this request
      });

    let response = await fetchWithToken(MAM_TOKEN);

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

    if (!response.ok) {
      console.error({ url, status: response.status });
      throw new Error(
        `Failed to fetch from MAM: ${response.status} ${response.statusText}`,
      );
    }

    const jsonData = await response.json();

    if (
      !jsonData.data ||
      !Array.isArray(jsonData.data) ||
      jsonData.data.length === 0
    ) {
      return { books: [], hasMore: false, totalResults: 0 };
    }

    const books: Book[] = jsonData.data.map((item: any) => {

      // Determine if it's an audiobook or ebook based on main_cat
      // 13 = AudioBooks, 14 = E-Books
      const category =
        item.main_cat === 13 || item.main_cat === "13" ? "audiobook" : "ebook";

      // Parse author info from JSON string
      let author = "Unknown Author";
      try {
        if (item.author_info) {
          const authorInfo = JSON.parse(item.author_info);
          author = Object.values(authorInfo).join(", ");
        }
      } catch (e) {
        console.error("Error parsing author info:", e);
      }

      // Parse narrator info for audiobooks
      let narrator = undefined;
      try {
        if (item.narrator_info && category === "audiobook") {
          const narratorInfo = JSON.parse(item.narrator_info);
          narrator = Object.values(narratorInfo).join(", ");
        }
      } catch (e) {
        console.error("Error parsing narrator info:", e);
      }

      let length = undefined;
      if (category === "audiobook" && item.description) {
        // Try to extract length from description
        const lengthMatch = item.description?.match(
          /(\d+h\d+m|\d+:\d+:\d+|\d+ hrs?( \d+ mins?)?)/i,
        );
        if (lengthMatch) {
          length = lengthMatch[1].trim();
        }
      }

      // Extract format from filetypes or tags
      let format = item.filetype || "Unknown Format";
      if (!format || format === "Unknown Format") {
        const formatFromTags = extractFormatFromTags(item.tags || "");
        if (formatFromTags) format = formatFromTags;
      }

      return {
        id: item.id.toString(),
        title: item.title || "Unknown Title",
        author,
        narrator,
        format,
        length,
        torrentLink: `https://www.myanonamouse.net/tor/download.php/${item.dl}`,
        category,
        size: item.size || null,
        seeders: item.seeders || 0,
        leechers: item.leechers || 0,
        added: item.added || null,
        tags: item.tags || null,
        completed: item.times_completed || 0,
        language:
          item.language !== undefined && item.language !== null
            ? Number(item.language)
            : undefined,
        langCode: item.lang_code || undefined,
      };
    });

    // MAM API returns the total number of results in the 'found' field
    // Use this to properly determine if there are more results available
    const totalResults = typeof jsonData.found === 'number'
      ? jsonData.found
      : parseInt(String(jsonData.found), 10) || 0;
    const currentEndPosition = startNumber + books.length;
    const hasMore = currentEndPosition < totalResults;

    return {
      books,
      hasMore,
      totalResults
    };
  } catch (error) {
    console.error("Error searching books:", error);
    return {
      books: [],
      error: error instanceof Error ? error.message : "Unknown error occurred",
      hasMore: false,
      totalResults: 0,
    };
  }
}

function extractAuthor(description: string): string {
  const authorMatch = description.match(/Author:\s*([^<]+)/i);
  return authorMatch ? authorMatch[1].trim() : "Unknown Author";
}

function extractFormat(description: string, category: string): string {
  if (category === "audiobook") {
    const formatMatch = description.match(/Format:\s*([^<]+)/i);
    return formatMatch ? formatMatch[1].trim() : "Unknown Format";
  } else {
    const formatMatch = description.match(/Format:\s*([^<]+)/i);
    return formatMatch ? formatMatch[1].trim() : "Unknown Format";
  }
}

function extractFormatFromTags(tags: string): string {
  const commonFormats = [
    "mp3",
    "m4a",
    "m4b",
    "flac",
    "epub",
    "mobi",
    "azw3",
    "pdf",
  ];
  const tagsLower = tags.toLowerCase();

  for (const format of commonFormats) {
    if (tagsLower.includes(format)) {
      return format;
    }
  }

  return "";
}
