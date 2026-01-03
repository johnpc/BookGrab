import { getServerEnvVariables } from "./env";
import { Book, SearchResponse } from "../types";

export async function searchBooks(
  query: string,
  mamToken?: string,
  startNumber: number = 0,
  sortType: string = "seeds",
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
        text: query,
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
      },
      thumbnail: "true",
    };

    // Use the JSON API endpoint
    const url = "https://www.myanonamouse.net/tor/js/loadSearchJSONbasic.php";

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "User-Agent": "BookGrab/1.0",
        "Content-Type": "application/json",
        Cookie: `mam_id=${MAM_TOKEN}`,
      },
      body: JSON.stringify(searchPayload),
      next: { revalidate: 0 }, // Don't cache this request
    });

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
