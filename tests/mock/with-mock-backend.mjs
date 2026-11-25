#!/usr/bin/env node
/**
 * Run any command against the mock backend:
 *
 *   node tests/mock/with-mock-backend.mjs next dev
 *   node tests/mock/with-mock-backend.mjs next start -p 3100
 *
 * Starts mock-backend.mjs, exports the env the app needs to talk to it, runs
 * the command, and tears the mock down when the command exits.
 */
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { MOCK_ORIGIN, mockAppEnv } from "./env.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const [, , ...command] = process.argv;
if (command.length === 0) {
  console.error("usage: with-mock-backend.mjs <command...>");
  process.exit(2);
}

const mock = spawn(process.execPath, [join(here, "mock-backend.mjs")], {
  stdio: "inherit",
  env: process.env,
});

async function waitForMock() {
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const res = await fetch(`${MOCK_ORIGIN}/health`);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("mock backend did not start");
}

await waitForMock();

const child = spawn(command[0], command.slice(1), {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...process.env, ...mockAppEnv },
});

const stop = (code) => {
  mock.kill("SIGTERM");
  process.exit(code ?? 0);
};
child.on("exit", stop);
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    child.kill(signal);
  });
}
