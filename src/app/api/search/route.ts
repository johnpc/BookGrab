import { NextRequest, NextResponse } from "next/server";
import { parseCategory, parseLanguages, searchBooks } from "@/lib/mam-api";
import { AppError, errorResponse } from "@/lib/api-error";
import { isSortKey } from "@/state/search";

export const dynamic = "force-dynamic";

/**
 * GET /api/search?q=...&start=0&sort=seeds&lang=en&category=audiobook
 *
 * Returns one MAM page: { books, hasMore, totalResults }.
 * Errors: { error, code, hint? } with codes BAD_REQUEST | MAM_NOT_CONFIGURED | MAM_AUTH | MAM_UPSTREAM.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const query = params.get("q")?.trim() ?? "";
  const rawStart = params.get("start") ?? "0";
  const sort = params.get("sort") ?? "seeds";

  try {
    if (!query) {
      throw new AppError("BAD_REQUEST", "Search query is required");
    }
    if (!/^\d+$/.test(rawStart)) {
      throw new AppError("BAD_REQUEST", "start must be a non-negative integer");
    }
    if (!isSortKey(sort)) {
      throw new AppError("BAD_REQUEST", `Unknown sort: ${sort}`);
    }

    const result = await searchBooks({
      query,
      mamToken: request.headers.get("x-mam-token") || undefined,
      startNumber: parseInt(rawStart, 10),
      sortType: sort,
      languages: parseLanguages(params.get("lang")),
      mainCategories: parseCategory(params.get("category")),
    });

    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (!(error instanceof AppError) || error.code === "INTERNAL") {
      console.error("Search API error:", error);
    }
    return errorResponse(error, "MAM_UPSTREAM");
  }
}
