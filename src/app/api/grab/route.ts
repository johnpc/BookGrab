import { NextRequest, NextResponse } from "next/server";
import { addTorrent } from "@/lib/transmission-api";
import { AppError, errorResponse } from "@/lib/api-error";
import type { GrabResponse } from "@/types";

export const dynamic = "force-dynamic";

/**
 * POST /api/grab  { torrentUrl, category: "audiobook" | "ebook" }
 *
 * Returns { success: true, message, duplicate }.
 * Errors: { error, code, hint? } with codes BAD_REQUEST | TRANSMISSION_UPSTREAM.
 */
export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new AppError("BAD_REQUEST", "Request body must be JSON");
    }

    const { torrentUrl, category } = (body ?? {}) as {
      torrentUrl?: unknown;
      category?: unknown;
    };

    if (typeof torrentUrl !== "string" || torrentUrl.length === 0) {
      throw new AppError("BAD_REQUEST", "Torrent URL is required");
    }
    if (category !== "audiobook" && category !== "ebook") {
      throw new AppError("BAD_REQUEST", "Valid category (audiobook or ebook) is required");
    }

    const result = await addTorrent(torrentUrl, category);
    const response: GrabResponse = {
      success: true,
      duplicate: result.duplicate,
      message: result.duplicate
        ? "Already in Transmission"
        : "Added to Transmission",
    };
    return NextResponse.json(response);
  } catch (error) {
    if (!(error instanceof AppError) || error.code === "INTERNAL") {
      console.error("Grab API error:", error);
    }
    return errorResponse(error, "TRANSMISSION_UPSTREAM");
  }
}
