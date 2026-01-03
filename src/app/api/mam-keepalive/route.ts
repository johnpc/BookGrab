import { NextRequest, NextResponse } from "next/server";
import { getServerEnvVariables } from "@/lib/env";

export async function POST(request: NextRequest) {
  try {
    // Get MAM token from request header (sent by client) or fall back to env
    const mamToken = request.headers.get("x-mam-token");
    const { MAM_TOKEN: envToken } = getServerEnvVariables();
    const MAM_TOKEN = mamToken || envToken;

    if (!MAM_TOKEN) {
      return NextResponse.json(
        { success: false, error: "No MAM token configured" },
        { status: 400 }
      );
    }

    // Ping the MAM dynamic seedbox endpoint to keep the session alive
    const response = await fetch(
      "https://t.myanonamouse.net/json/dynamicSeedbox.php",
      {
        method: "GET",
        headers: {
          Cookie: `mam_id=${MAM_TOKEN}`,
          "User-Agent": "BookGrab/1.0",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`MAM responded with status ${response.status}`);
    }

    const text = await response.text();

    // Parse the response - MAM returns JSON with status
    let result;
    try {
      result = JSON.parse(text);
    } catch {
      // If not JSON, use the text directly
      result = { message: text };
    }

    // Check for known success responses
    const successMessages = ["Completed", "No Change"];
    const isSuccess = successMessages.some(
      (msg) => text.includes(msg) || JSON.stringify(result).includes(msg)
    );

    if (isSuccess) {
      console.log("MAM keepalive successful:", text);
      return NextResponse.json({
        success: true,
        message: text,
        timestamp: new Date().toISOString(),
      });
    }

    // Check for known error responses
    if (text.includes("No Session Cookie") || text.includes("Incorrect session type")) {
      console.error("MAM keepalive failed:", text);
      return NextResponse.json(
        {
          success: false,
          error: text,
          hint: "Make sure 'Allow session to set dynamic seedbox IP' is enabled in MAM Security settings",
        },
        { status: 400 }
      );
    }

    // Unknown response
    console.log("MAM keepalive response:", text);
    return NextResponse.json({
      success: true,
      message: text,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("MAM keepalive error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Also support GET for easy testing
export async function GET(request: NextRequest) {
  return POST(request);
}
