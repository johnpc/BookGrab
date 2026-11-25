#!/usr/bin/env node
/**
 * Visual tour: drives the app through its main states and saves screenshots
 * plus a screen recording, so a human (or agent) can look at the real UX.
 *
 *   npm run start:mock &                       # or any running instance
 *   node scripts/visual-tour.mjs               # BASE_URL defaults to http://127.0.0.1:3100
 *   BASE_URL=https://bookgrab.example node scripts/visual-tour.mjs --real
 *
 * --real uses real-world queries and prints timings; without it the queries
 * match the mock backend fixtures. Output: artifacts/tour/<timestamp>/.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, devices } from "playwright";

const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:3100";
const REAL = process.argv.includes("--real");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const out = join("artifacts", "tour", stamp);
mkdirSync(out, { recursive: true });

const Q1 = REAL ? "project hail mary" : "project hail mary";
const Q2 = REAL ? "brandon sanderson" : "dune";

const timings = [];
const time = async (label, fn) => {
  const t0 = performance.now();
  const result = await fn();
  const ms = Math.round(performance.now() - t0);
  timings.push({ label, ms });
  console.log(`${label}: ${ms} ms`);
  return result;
};

const shot = (page, name) => page.screenshot({ path: join(out, `${name}.png`), fullPage: false });
const fullShot = (page, name) => page.screenshot({ path: join(out, `${name}.png`), fullPage: true });

const waitReady = (page) =>
  page.waitForSelector('[data-testid="search-status"][data-status="ready"]', { timeout: 120_000 });

const browser = await chromium.launch();

// ---------------------------------------------------------------- desktop ---
{
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    colorScheme: "dark",
    recordVideo: { dir: join(out, "video-desktop"), size: { width: 1280, height: 900 } },
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));

  await time("desktop: first load", () => page.goto(BASE_URL, { waitUntil: "networkidle" }));
  await shot(page, "01-desktop-welcome-dark");

  await page.getByTestId("search-input").fill(Q1);
  const t0 = performance.now();
  await page.getByTestId("search-submit").click();
  await page.waitForSelector('.app[data-search-status="searching"]', { timeout: 5_000 });
  await shot(page, "01b-desktop-searching-skeleton");
  await page.waitForSelector('.app:not([data-search-status="searching"]) [data-testid="book-card"]', { timeout: 120_000 });
  console.log(`desktop: first card visible after ${Math.round(performance.now() - t0)} ms`);
  await waitReady(page);
  console.log(`desktop: search "${Q1}" ready after ${Math.round(performance.now() - t0)} ms`);
  timings.push({ label: `search "${Q1}" ready`, ms: Math.round(performance.now() - t0) });
  await shot(page, "02-desktop-results-dark");
  await fullShot(page, "02b-desktop-results-dark-full");

  // Toggle languages, sort, filter.
  await page.getByTestId("lang-toggle").click();
  await waitReady(page);
  await shot(page, "03-desktop-all-languages");
  await page.getByTestId("sort-select").selectOption("size");
  await page.getByRole("radio", { name: /Audiobooks/ }).click();
  await shot(page, "04-desktop-audiobooks-by-size");
  await page.getByRole("radio", { name: /^All/ }).click();
  await page.getByTestId("sort-select").selectOption("seeds");
  await page.getByTestId("lang-toggle").click();
  await waitReady(page);

  // Large result set: capture the streaming state mid-flight.
  await page.getByTestId("search-input").fill(Q2);
  const t1 = performance.now();
  await page.getByTestId("search-submit").click();
  await page.waitForSelector('.app[data-search-status="searching"]', { timeout: 5_000 });
  await page.waitForSelector('.app:not([data-search-status="searching"]) [data-testid="book-card"]', { timeout: 120_000 });
  console.log(`desktop: "${Q2}" first card after ${Math.round(performance.now() - t1)} ms`);
  await shot(page, "05-desktop-streaming");
  await waitReady(page);
  const ms2 = Math.round(performance.now() - t1);
  console.log(`desktop: "${Q2}" ready after ${ms2} ms`);
  timings.push({ label: `search "${Q2}" ready`, ms: ms2 });
  const status = await page.getByTestId("search-status").innerText();
  console.log(`desktop: status → ${status.replace(/\n/g, " | ")}`);
  await shot(page, "06-desktop-large-results");
  await page.getByTestId("page-next").click();
  await shot(page, "07-desktop-page-2");

  // Details + settings.
  await page.getByTestId("details-toggle").first().click();
  await shot(page, "08-desktop-details-open");
  await page.getByTestId("open-settings").click();
  await page.waitForSelector('[data-testid="server-status"] .pill-status[data-status]');
  await shot(page, "09-desktop-settings");
  await page.getByTestId("theme-select").selectOption("light");
  await shot(page, "10-desktop-settings-light");
  await page.keyboard.press("Escape");
  await shot(page, "11-desktop-results-light");
  await page.getByTestId("open-settings").click();
  await page.getByTestId("theme-select").selectOption("system");
  await page.keyboard.press("Escape");

  // Empty + error states (mock only; real MAM would need a nonsense query).
  await page.getByTestId("search-input").fill(REAL ? "zzqx vvplq nonexistent" : "nothing here");
  await page.getByTestId("search-submit").click();
  await waitReady(page);
  await shot(page, "12-desktop-empty");
  if (!REAL) {
    await page.getByTestId("search-input").fill("boom dune");
    await page.getByTestId("search-submit").click();
    await page.waitForSelector('.app[data-search-status="error"]');
    await shot(page, "13-desktop-error");
  }

  await ctx.close();
  if (errors.length) console.log("desktop console errors:", errors);
  else console.log("desktop: no console errors");
}

// ----------------------------------------------------------------- mobile ---
{
  const ctx = await browser.newContext({
    ...devices["iPhone 14"],
    colorScheme: "dark",
    recordVideo: { dir: join(out, "video-mobile"), size: { width: 390, height: 844 } },
  });
  const page = await ctx.newPage();
  await time("mobile: first load", () => page.goto(BASE_URL, { waitUntil: "networkidle" }));
  await shot(page, "20-mobile-welcome");
  await page.getByTestId("search-input").fill(Q1);
  await page.getByTestId("search-submit").click();
  await waitReady(page);
  await shot(page, "21-mobile-results");
  await fullShot(page, "21b-mobile-results-full");
  if (!REAL) {
    const btn = page.getByTestId("grab-button").first();
    await btn.click();
    await page.waitForSelector('[data-testid="book-card"][data-grab-status="added"]');
    await shot(page, "22-mobile-grabbed");
  }
  await page.getByTestId("open-settings").click();
  await shot(page, "23-mobile-settings");
  await page.keyboard.press("Escape");
  await ctx.close();
}

// Light mode welcome for completeness.
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: "light" });
  const page = await ctx.newPage();
  await page.goto(`${BASE_URL}/?q=${encodeURIComponent(Q1)}`, { waitUntil: "networkidle" });
  await waitReady(page);
  await shot(page, "30-desktop-results-system-light");
  await ctx.close();
}

await browser.close();
writeFileSync(join(out, "timings.json"), JSON.stringify({ baseUrl: BASE_URL, real: REAL, timings }, null, 2));
console.log(`\nArtifacts: ${out}`);
