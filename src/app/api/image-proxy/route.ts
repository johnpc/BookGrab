import { NextRequest, NextResponse } from "next/server";
import { getServerEnvVariables } from "@/lib/env";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const url = searchParams.get("url");

  if (!url) {
    return NextResponse.json(
      { error: "Image URL is required" },
      { status: 400 },
    );
  }

  try {
    // Get MAM token from request header (sent by client) or fall back to env
    const mamToken = request.headers.get("x-mam-token");
    const { MAM_TOKEN: envToken } = getServerEnvVariables();
    const MAM_TOKEN = mamToken || envToken;

    console.log("Fetching image from:", url);

    // If it's a MAM viewImageFull URL, we need to fetch the torrent page first
    // to get the actual CDN URL
    if (url.includes("viewImageFull.php")) {
      const bookId = url.split("/").pop();

      // Fetch the torrent page HTML
      const pageUrl = `https://www.myanonamouse.net/t/${bookId}`;
      const pageResponse = await fetch(pageUrl, {
        headers: {
          "User-Agent": "BookGrab/1.0",
          Cookie: MAM_TOKEN ? `mam_id=${MAM_TOKEN}` : "",
        },
      });

      if (!pageResponse.ok) {
        throw new Error(`Failed to fetch torrent page: ${pageResponse.status}`);
      }

      const html = await pageResponse.text();

      // Extract the CDN image URL from the HTML
      // Look for the pattern: https://cdn.myanonamouse.net/t/p/{timestamp}/large/{id}.{ext}
      const imageMatch = html.match(/https:\/\/cdn\.myanonamouse\.net\/t\/p\/\d+\/large\/\d+\.(jpg|jpeg|png)/i);

      if (!imageMatch) {
        console.log("No image found in HTML for book", bookId);
        throw new Error("Image URL not found in page");
      }

      const cdnUrl = imageMatch[0];
      console.log("Found CDN URL:", cdnUrl);

      // Now fetch the actual image from CDN (no auth needed for CDN)
      const imageResponse = await fetch(cdnUrl, {
        headers: {
          "User-Agent": "BookGrab/1.0",
          Referer: "https://www.myanonamouse.net/",
        },
      });

      if (!imageResponse.ok) {
        throw new Error(`Failed to fetch image from CDN: ${imageResponse.status}`);
      }

      const imageData = await imageResponse.arrayBuffer();
      const contentType = imageResponse.headers.get("content-type") || "image/jpeg";

      return new NextResponse(imageData, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=86400",
        },
      });
    }

    // For direct image URLs (fallback)
    const imageUrl = new URL(url);
    const headers = {
      "User-Agent": "BookGrab/1.0",
      Referer: "https://www.myanonamouse.net/",
      Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
    };

    if (MAM_TOKEN && imageUrl.hostname.includes("myanonamouse.net")) {
      headers["Cookie"] = `mam_id=${MAM_TOKEN}`;
    }

    const response = await fetch(imageUrl.toString(), {
      headers,
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      console.error(`Image fetch failed: ${response.status} ${response.statusText}`);
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }

    const imageData = await response.arrayBuffer();
    const contentType = response.headers.get("content-type") || "image/jpeg";

    return new NextResponse(imageData, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (error) {
    console.error("Image proxy error:", error);

    // Return a 1x1 transparent PNG instead of redirecting
    const transparentPng = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64"
    );

    return new NextResponse(transparentPng, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600",
      },
    });
  }
}
