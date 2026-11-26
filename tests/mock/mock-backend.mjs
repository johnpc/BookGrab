#!/usr/bin/env node
/**
 * Fake MyAnonyMouse + Transmission backend for local development and CI.
 *
 * Deterministic by design: the same request always gets the same answer, so
 * e2e tests can assert exact counts and orderings. No network access needed.
 *
 *   node tests/mock/mock-backend.mjs            # listens on 127.0.0.1:4010
 *   MOCK_PORT=5000 node tests/mock/mock-backend.mjs
 *
 * Endpoints (mirroring the real services):
 *   POST /tor/js/loadSearchJSONbasic.php   MAM search (cookie mam_id must match MOCK_MAM_TOKEN)
 *   GET  /json/dynamicSeedbox.php          MAM keepalive (rotates the cookie like the real thing)
 *   POST /transmission/rpc                 Transmission RPC with the 409 session-id handshake
 *   GET  /__mock/state                     Inspect added torrents / served gated requests
 *   POST /__mock/reset                     Forget added torrents
 *   POST /__mock/complete                  Mark every added torrent 100% downloaded (default 50%)
 *   POST /__mock/release                   Release requests whose query starts with "gated"
 *
 * Query behaviours (case-insensitive, after MAM-style sanitising):
 *   "project hail mary"  → the 20-row fixture (8 languages, both categories)
 *   "dune"               → 338 generated rows across 17 pages (English only)
 *   "nothing here"       → zero results
 *   "slow …"             → answered after 1500 ms (loading-state checks)
 *   "gated …"            → held until POST /__mock/release (race checks)
 *   "boom …"             → HTTP 500 from MAM
 *   anything else        → 7 generated rows seeded from the query
 *
 * Torrent behaviours: a torrent added twice reports torrent-duplicate; a
 * download link containing "fail" is refused ("unrecognized info").
 */
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.MOCK_PORT ?? 4010);
const HOST = process.env.MOCK_HOST ?? "127.0.0.1";
const TOKEN = process.env.MOCK_MAM_TOKEN ?? "mock-token";
const PER_PAGE = 20;

const fixture = (name) => JSON.parse(readFileSync(join(here, "fixtures", name), "utf8"));
const PHM = fixture("mam-search-project-hail-mary.json");
const DUNE_PAGE = fixture("mam-search-dune-page0.json");

// ---------------------------------------------------------------------------
// Datasets
// ---------------------------------------------------------------------------
const hash = (s) => {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return h;
};

/** Expand the 20-row Dune page into 338 deterministic English rows. */
function buildDune() {
  const rows = [];
  for (let i = 0; i < 338; i++) {
    const base = DUNE_PAGE.data[i % DUNE_PAGE.data.length];
    const seeders = Math.max(0, 900 - i * 3 + (hash(`s${i}`) % 7));
    const sizeMiB = 50 + ((hash(`z${i}`) % 2000) / 10);
    rows.push({
      ...base,
      id: String(9_000_000 + i),
      title: i < DUNE_PAGE.data.length ? base.title : `${base.title} (edition ${i})`,
      seeders: String(seeders),
      leechers: String(hash(`l${i}`) % 5),
      times_completed: String(seeders * 3),
      size: sizeMiB >= 1024 ? `${(sizeMiB / 1024).toFixed(1)} GiB` : `${sizeMiB.toFixed(1)} MiB`,
      added: `20${String(10 + (i % 16)).padStart(2, "0")}-${String(1 + (i % 12)).padStart(2, "0")}-${String(1 + (i % 28)).padStart(2, "0")} 12:00:00`,
      dl: `FIXTURE-DL-${9_000_000 + i}`,
      language: "1",
      lang_code: "ENG",
    });
  }
  return rows;
}
const DUNE = buildDune();

function buildGeneric(query) {
  const seed = hash(query);
  return Array.from({ length: 7 }, (_, i) => {
    const base = PHM.data[(seed + i) % PHM.data.length];
    return {
      ...base,
      id: String(8_000_000 + ((seed + i) % 100000)),
      title: `${query} ${i + 1}`,
      seeders: String(500 - i * 40),
      dl: `FIXTURE-DL-${query.replace(/\s+/g, "-")}-${i}`,
      language: "1",
      lang_code: "ENG",
    };
  });
}

const sanitize = (q) => String(q ?? "").replace(/[?!*"()|@~^$<>=]+/g, " ").replace(/\s+/g, " ").trim().toLowerCase();

const SIZE_UNITS = { KIB: 1024, MIB: 1024 ** 2, GIB: 1024 ** 3 };
const sizeBytes = (s) => {
  const m = String(s).match(/^([\d.,]+)\s*([KMG]iB)$/i);
  return m ? parseFloat(m[1].replace(/,/g, "")) * SIZE_UNITS[m[2].toUpperCase()] : 0;
};

function sortRows(rows, sortType) {
  const copy = [...rows];
  switch (sortType) {
    case "date":
      return copy.sort((a, b) => b.added.localeCompare(a.added));
    case "size":
      return copy.sort((a, b) => sizeBytes(b.size) - sizeBytes(a.size));
    case "name":
      return copy.sort((a, b) => a.title.localeCompare(b.title));
    case "times_completed":
      return copy.sort((a, b) => Number(b.times_completed) - Number(a.times_completed));
    default:
      return copy.sort((a, b) => Number(b.seeders) - Number(a.seeders));
  }
}

function datasetFor(query) {
  const q = sanitize(query).replace(/^(slow|gated|boom)\s+/, "");
  if (q === "project hail mary") return PHM.data;
  if (q === "dune") return DUNE;
  if (q === "nothing here") return [];
  return buildGeneric(q);
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
const added = new Set();
// hashString → { name, downloadDir, percentDone }, for torrent-get.
const torrents = new Map();
let gated = [];
let servedGated = 0;
let searchCalls = 0;

const json = (res, status, body, headers = {}) => {
  const text = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(text), ...headers });
  res.end(text);
};

const readBody = (req) =>
  new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => resolve(data));
  });

const cookieToken = (req) => {
  const m = String(req.headers.cookie ?? "").match(/(?:^|;\s*)mam_id=([^;]+)/);
  return m ? m[1] : undefined;
};

const rotate = (token) => {
  const m = token.match(/^(.*?)(?:-r(\d+))?$/);
  return `${m[1]}-r${Number(m[2] ?? 0) + 1}`;
};
const sameSession = (token) => token !== undefined && token.replace(/-r\d+$/, "") === TOKEN;

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------
async function handleSearch(req, res) {
  searchCalls++;
  if (!sameSession(cookieToken(req))) {
    res.writeHead(403, { "Content-Type": "text/html" });
    return res.end("<html>Forbidden</html>");
  }
  let payload = {};
  try {
    payload = JSON.parse(await readBody(req));
  } catch {
    return json(res, 400, { error: "bad json" });
  }
  const tor = payload.tor ?? {};
  const rawQuery = String(tor.text ?? "");
  const q = sanitize(rawQuery);

  if (q.startsWith("boom")) return json(res, 500, { error: "MAM exploded" });

  let rows = datasetFor(rawQuery);
  if (Array.isArray(tor.browse_lang) && tor.browse_lang.length) {
    rows = rows.filter((r) => tor.browse_lang.includes(String(r.language)));
  }
  if (Array.isArray(tor.main_cat) && tor.main_cat.length) {
    rows = rows.filter((r) => tor.main_cat.includes(String(r.main_cat)));
  }
  rows = sortRows(rows, tor.sortType);
  const start = Number(tor.startNumber ?? 0);
  const page = rows.slice(start, start + PER_PAGE);
  const body = { perpage: PER_PAGE, start, data: page, total: page.length, found: rows.length };

  const send = () => json(res, 200, body);
  if (q.startsWith("slow")) return setTimeout(send, 1500);
  if (q.startsWith("gated")) {
    gated.push(() => {
      servedGated++;
      send();
    });
    return;
  }
  send();
}

function handleSeedbox(req, res) {
  const token = cookieToken(req);
  if (token === "wrong-type") return json(res, 200, { Success: false, msg: "Incorrect session type" });
  if (!sameSession(token)) return json(res, 403, { Success: false, msg: "Invalid session" });
  json(res, 200, { Success: true, msg: "No change" }, { "Set-Cookie": `mam_id=${rotate(token)}; Path=/; Max-Age=1296000` });
}

async function handleTransmission(req, res) {
  if (req.headers["x-transmission-session-id"] !== "mock-session") {
    res.writeHead(409, { "X-Transmission-Session-Id": "mock-session" });
    return res.end();
  }
  let body = {};
  try {
    body = JSON.parse(await readBody(req));
  } catch {
    return json(res, 400, { result: "bad json" });
  }
  if (body.method === "torrent-get") {
    const wanted = body.arguments?.ids;
    const found = [...torrents.values()].filter((t) => !Array.isArray(wanted) || wanted.includes(t.hashString));
    return json(res, 200, { result: "success", arguments: { torrents: found } });
  }
  if (body.method !== "torrent-add") return json(res, 200, { result: "method not recognized" });
  const filename = String(body.arguments?.filename ?? "");
  if (filename.includes("fail")) return json(res, 200, { result: "unrecognized info" });
  const key = `${filename}|${body.arguments?.["download-dir"] ?? ""}`;
  const info = { id: added.size + 1, name: filename.split("/").pop(), hashString: hash(filename).toString(16) };
  if (added.has(filename)) return json(res, 200, { result: "success", arguments: { "torrent-duplicate": info } });
  added.add(filename);
  torrents.set(info.hashString, {
    ...info,
    downloadDir: String(body.arguments?.["download-dir"] ?? ""),
    percentDone: 0.5,
  });
  void key;
  json(res, 200, { result: "success", arguments: { "torrent-added": info } });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (req.method === "POST" && url.pathname === "/tor/js/loadSearchJSONbasic.php") return await handleSearch(req, res);
    if (url.pathname === "/json/dynamicSeedbox.php") return handleSeedbox(req, res);
    if (req.method === "POST" && url.pathname === "/transmission/rpc") return await handleTransmission(req, res);
    if (url.pathname === "/__mock/state") {
      return json(res, 200, {
        added: [...added],
        torrents: [...torrents.values()],
        gatedPending: gated.length,
        servedGated,
        searchCalls,
      });
    }
    if (req.method === "POST" && url.pathname === "/__mock/complete") {
      for (const t of torrents.values()) t.percentDone = 1;
      return json(res, 200, { completed: torrents.size });
    }
    if (req.method === "POST" && url.pathname === "/__mock/reset") {
      added.clear();
      torrents.clear();
      gated = [];
      servedGated = 0;
      searchCalls = 0;
      return json(res, 200, { ok: true });
    }
    if (req.method === "POST" && url.pathname === "/__mock/release") {
      const pending = gated;
      gated = [];
      pending.forEach((fn) => fn());
      return json(res, 200, { released: pending.length });
    }
    if (url.pathname === "/health") return json(res, 200, { ok: true });
    json(res, 404, { error: "not found", path: url.pathname });
  } catch (error) {
    json(res, 500, { error: String(error) });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[mock-backend] MAM + Transmission mock listening on http://${HOST}:${PORT} (token: ${TOKEN})`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
