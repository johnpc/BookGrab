#!/usr/bin/env node
/**
 * Run the production build the same way the Docker image does:
 * `node .next/standalone/server.js` with static assets alongside it.
 *
 *   node scripts/start-standalone.mjs            # PORT defaults to 3000
 *   PORT=3100 node scripts/start-standalone.mjs
 *
 * Requires `npm run build` first (output: "standalone" in next.config.ts).
 */
import { cpSync, existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const standalone = join(root, ".next", "standalone");
const server = join(standalone, "server.js");

if (!existsSync(server)) {
  console.error("No standalone build found. Run `npm run build` first.");
  process.exit(1);
}

// Mirror the Dockerfile's COPY steps.
cpSync(join(root, ".next", "static"), join(standalone, ".next", "static"), { recursive: true });
cpSync(join(root, "public"), join(standalone, "public"), { recursive: true });

const child = spawn(process.execPath, [server], {
  stdio: "inherit",
  env: { HOSTNAME: "127.0.0.1", PORT: "3000", ...process.env },
});
child.on("exit", (code) => process.exit(code ?? 0));
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
