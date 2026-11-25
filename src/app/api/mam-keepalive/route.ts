import { NextRequest, NextResponse } from "next/server";
import { refreshMamSession } from "@/lib/mam-session";
import { errorResponse } from "@/lib/api-error";
import type { KeepaliveResponse } from "@/types";

export const dynamic = "force-dynamic";

/**
 * POST /api/mam-keepalive
 * Header x-mam-token: optional user token to check instead of the server's.
 *
 * 200 { success: true, message, rotated, timestamp }
 * 400 { success: false, message, hint?, timestamp }
 */
export async function POST(request: NextRequest) {
  try {
    const overrideToken = request.headers.get("x-mam-token") ?? undefined;
    const result = await refreshMamSession(overrideToken);
    const body: KeepaliveResponse = {
      success: result.success,
      message: result.message,
      rotated: result.rotated,
      ...(result.hint ? { hint: result.hint } : {}),
      timestamp: new Date().toISOString(),
    };

    if (!result.success) {
      return NextResponse.json(body, { status: 400 });
    }

    console.log(
      `MAM keepalive: ${result.message}${result.rotated ? " (token rotated and persisted)" : ""}`,
    );
    return NextResponse.json(body);
  } catch (error) {
    console.error("MAM keepalive error:", error);
    return errorResponse(error, "MAM_UPSTREAM");
  }
}

// Also support GET for easy manual checks.
export async function GET(request: NextRequest) {
  return POST(request);
}
