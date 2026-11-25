import { expect, test } from "@playwright/test";
import { failOnConsoleErrors } from "./helpers";

test.describe("home", () => {
  test("renders the welcome state with accessible controls", async ({ page }) => {
    const assertNoErrors = failOnConsoleErrors(page);
    await page.goto("/");

    await expect(page).toHaveTitle(/BookGrab/);
    await expect(page.getByTestId("welcome-state")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Discover your next read" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Settings" })).toBeVisible();
    await expect(page.getByRole("search")).toBeVisible();
    await expect(page.getByLabel("Search for books, authors, or series")).toBeVisible();
    await expect(page.getByTestId("results-toolbar")).toHaveCount(0);
    await expect(page.locator(".app")).toHaveAttribute("data-search-status", "idle");

    assertNoErrors();
  });

  test("example pills start a search", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Project Hail Mary" }).click();
    await expect(page).toHaveURL(/\?q=Project\+Hail\+Mary/);
    await expect(page.getByTestId("search-status")).toHaveAttribute("data-status", "ready");
    await expect(page.getByTestId("search-input")).toHaveValue("Project Hail Mary");
  });

  test("status endpoint reports a ready server without leaking secrets", async ({ request }) => {
    const res = await request.get("/api/status");
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, mamTokenConfigured: true, transmissionConfigured: true });
    expect(JSON.stringify(body)).not.toContain("mock-token");
  });

  test("service worker and manifest are served, worker is uncacheable", async ({ request }) => {
    const sw = await request.get("/sw.js");
    expect(sw.ok()).toBe(true);
    expect(sw.headers()["cache-control"]).toContain("no-store");
    const manifest = await request.get("/manifest.json");
    expect(manifest.ok()).toBe(true);
    expect(await manifest.json()).toMatchObject({ name: "BookGrab" });
  });
});
