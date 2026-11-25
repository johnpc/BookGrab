import { NextRequest, NextResponse } from "next/server";
import { parseCategory, parseLanguages, searchBooks } from "@/lib/mam-api";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q");
  const startNumber = parseInt(searchParams.get("start") || "0", 10);
  const sortType = searchParams.get("sort") || "seeds";
  // Optional language filter, e.g. ?lang=en or ?lang=1 (MAM language ids, comma-separated).
  const languages = parseLanguages(searchParams.get("lang"));
  // Optional ?category=audiobook|ebook (MAM main category).
  const mainCategories = parseCategory(searchParams.get("category"));

  if (!query) {
    return NextResponse.json(
      { error: "Search query is required" },
      { status: 400 },
    );
  }

  try {
    // Get MAM token from request header (sent by client)
    const mamToken = request.headers.get("x-mam-token") || undefined;
    const result = await searchBooks(
      query,
      mamToken,
      startNumber,
      sortType,
      languages,
      mainCategories,
    );
    return NextResponse.json(result);
  } catch (error) {
    console.error("Search API error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to search books",
      },
      { status: 500 },
    );
  }
}
