import { NextRequest, NextResponse } from "next/server";
import { searchBooks } from "@/lib/mam-api";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q");
  const startNumber = parseInt(searchParams.get("start") || "0", 10);
  const sortType = searchParams.get("sort") || "seeds";

  if (!query) {
    return NextResponse.json(
      { error: "Search query is required" },
      { status: 400 },
    );
  }

  try {
    // Get MAM token from request header (sent by client)
    const mamToken = request.headers.get("x-mam-token") || undefined;
    const result = await searchBooks(query, mamToken, startNumber, sortType);
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
