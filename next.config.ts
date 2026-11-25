import type { NextConfig } from "next";
import { readFileSync } from "node:fs";

const { version } = JSON.parse(readFileSync("./package.json", "utf8")) as {
  version: string;
};

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  env: {
    APP_VERSION: version,
  },
  async headers() {
    return [
      {
        // The service worker must never be cached by the browser or a CDN, or
        // a stale worker keeps serving a stale app shell after a deploy.
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;
