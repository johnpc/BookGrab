import { NextRequest, NextResponse } from "next/server";
import { refreshMamSession } from "@/lib/mam-session";

export async function POST(request: NextRequest) {
  try {
    // A client-supplied token overrides the stored one (used by Settings).
    const overrideToken = request.headers.get("x-mam-token") ?? undefined;
    const result = await refreshMamSession(overrideToken);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.message,
          ...(result.hint ? { hint: result.hint } : {}),
        },
        { status: 400 },
      );
    }

    console.log(
      `MAM keepalive: ${result.message}${result.rotated ? " (token rotated and persisted)" : ""}`,
    );

    return NextResponse.json({
      success: true,
      message: result.message,
      rotated: result.rotated,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("MAM keepalive error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

// Also support GET for easy testing
export async function GET(request: NextRequest) {
  return POST(request);
}
