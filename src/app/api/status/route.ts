import { NextResponse } from "next/server";
import { getLastKeepalive } from "@/lib/mam-session";
import { getMamToken } from "@/lib/mam-token";
import { getOptionalEnvVariable } from "@/lib/env";
import type { StatusResponse } from "@/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/status — readiness probe and configuration summary.
 * Never includes secrets.
 */
export async function GET() {
  const body: StatusResponse = {
    ok: true,
    version: process.env.APP_VERSION ?? "dev",
    mamTokenConfigured: Boolean(getMamToken()),
    transmissionConfigured: Boolean(getOptionalEnvVariable("TRANSMISSION_URL")),
    keepalive: getLastKeepalive(),
  };
  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
}
