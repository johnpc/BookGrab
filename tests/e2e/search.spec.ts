import { expect, test } from "@playwright/test";
import { cards, failOnConsoleErrors, mock, search, waitForSearch } from "./helpers";

test.beforeEach(async ({ request }) => {
  await mock.reset(request);
});

test.describe("search", () => {
  test("defaults to English and shows mixed-language results on demand", async ({ page }) => {
    const assertNoErrors = failOnConsoleErrors(page);
    await page.goto("/");
    await search(page, "project hail mary");
    await waitForSearch(page);

    // Fixture has 20 rows, 10 of them English.
    await expect(page.getByTestId("lang-toggle")).toHaveAttribute("aria-pressed", "true");
    await expect(cards(page)).toHaveCount(10);
    await expect(page.getByTestId("lang-badge")).toHaveCount(0);
    await expect(page.getByTestId("search-status")).toContainText("10 results");
    await expect(page).toHaveURL(/q=project\+hail\+mary/);

    await page.getByTestId("lang-toggle").click();
    await waitForSearch(page);
    await expect(page.getByTestId("lang-toggle")).toHaveAttribute("aria-pressed", "false");
    await expect(cards(page)).toHaveCount(20);
    await expect(page.getByTestId("lang-badge").first()).toBeVisible();
    await expect(page).toHaveURL(/lang=all/);

    // The preference sticks across a reload.
    await page.reload();
    await waitForSearch(page);
    await expect(cards(page)).toHaveCount(20);
    assertNoErrors();
  });

  test("type filter and sort apply instantly without refetching", async ({ page, request }) => {
    await page.goto("/?q=project+hail+mary&lang=all");
    await waitForSearch(page);
    const before = (await mock.state(request)).searchCalls;

    await page.getByRole("radio", { name: /Audiobooks/ }).click();
    await expect(cards(page)).toHaveCount(12);
    await expect(cards(page).first()).toHaveAttribute("data-category", "audiobook");
    await expect(page).toHaveURL(/type=audiobook/);

    await page.getByRole("radio", { name: /Ebooks/ }).click();
    await expect(cards(page)).toHaveCount(8);

    await page.getByRole("radio", { name: /^All/ }).click();
    await page.getByTestId("sort-select").selectOption("size");
    // Largest in the fixture is the 1.6 GiB Dutch MP3.
    await expect(cards(page).first()).toHaveAttribute("data-book-id", "1246279");
    await expect(cards(page).first().locator(".card__size")).toHaveText("1.6 GiB");

    await page.getByTestId("sort-select").selectOption("name");
    await expect(cards(page).first()).toContainText("Across the Sand");

    await page.getByTestId("sort-select").selectOption("date");
    await expect(cards(page).first()).toHaveAttribute("data-book-id", "1270126");

    await page.getByTestId("sort-select").selectOption("seeds");
    await expect(cards(page).first()).toHaveAttribute("data-book-id", "720129");

    expect((await mock.state(request)).searchCalls).toBe(before);
  });

  test("streams a large result set with progress, then paginates", async ({ page }) => {
    await page.goto("/?q=dune");
    const status = page.getByTestId("search-status");
    // Progress is visible while pages stream in; first page shows before the last arrives.
    await expect(status).toHaveAttribute("data-status", /searching|streaming/);
    await waitForSearch(page);
    await expect(status).toHaveAttribute("data-loaded", "338");
    await expect(status).toContainText("338 results");
    await expect(status).toContainText("Page 1 of 17");
    await expect(cards(page)).toHaveCount(20);
    await expect(page.getByTestId("search-progress")).toHaveCount(0);

    await page.getByTestId("page-next").click();
    await expect(page).toHaveURL(/page=2/);
    await expect(status).toContainText("Showing 21–40 · Page 2 of 17");
    await expect(page.getByTestId("page-prev")).toBeEnabled();

    await page.getByRole("button", { name: "Page 17" }).click();
    await expect(status).toContainText("Showing 321–338 · Page 17 of 17");
    await expect(cards(page)).toHaveCount(18);
    await expect(page.getByTestId("page-next")).toBeDisabled();

    // Changing the type filter resets to page 1.
    await page.getByRole("radio", { name: /Audiobooks/ }).click();
    await expect(page).not.toHaveURL(/page=/);
  });

  test("deep link restores the full search state", async ({ page }) => {
    await page.goto("/?q=project+hail+mary&lang=all&type=audiobook&sort=size&page=1");
    await waitForSearch(page);
    await expect(page.getByTestId("search-input")).toHaveValue("project hail mary");
    await expect(page.getByRole("radio", { name: /Audiobooks/ })).toHaveAttribute("aria-checked", "true");
    await expect(page.getByTestId("sort-select")).toHaveValue("size");
    await expect(cards(page)).toHaveCount(12);
    await expect(cards(page).first()).toHaveAttribute("data-book-id", "1246279");
  });

  test("a newer search always wins over a slower older one", async ({ page, request }) => {
    await page.goto("/");
    await search(page, "gated dune");
    await expect(page.getByTestId("search-status")).toHaveAttribute("data-status", "searching");

    await search(page, "project hail mary");
    await waitForSearch(page);
    await expect(cards(page)).toHaveCount(10);

    // Now let the old request finish; the UI must not change.
    await mock.release(request);
    await expect.poll(async () => (await mock.state(request)).servedGated).toBe(1);
    await expect(page.getByTestId("search-status")).toContainText("project hail mary");
    await expect(cards(page)).toHaveCount(10);
    await expect(page.getByTestId("search-status")).toHaveAttribute("data-status", "ready");
  });

  test("shows an empty state with a way out when nothing matches", async ({ page }) => {
    await page.goto("/");
    await search(page, "nothing here");
    await waitForSearch(page);
    await expect(page.getByTestId("empty-state")).toBeVisible();
    await expect(page.getByTestId("empty-state")).toContainText("Nothing found for “nothing here”");
    await page.getByRole("button", { name: "Include all languages" }).click();
    await expect(page).toHaveURL(/lang=all/);
    await waitForSearch(page);
    await expect(page.getByTestId("empty-state")).toBeVisible();
  });

  test("shows a loading skeleton and progress while searching", async ({ page }) => {
    await page.goto("/");
    await search(page, "slow project hail mary");
    await expect(page.getByTestId("results-skeleton")).toBeVisible();
    await expect(page.getByTestId("search-progress")).toBeVisible();
    await expect(page.getByTestId("search-status")).toContainText("Searching MyAnonyMouse");
    await waitForSearch(page);
    await expect(page.getByTestId("results-skeleton")).toHaveCount(0);
  });

  test("remembers recent searches", async ({ page }) => {
    await page.goto("/");
    await search(page, "project hail mary");
    await waitForSearch(page);
    await search(page, "dune");
    await waitForSearch(page);

    await page.getByTestId("search-clear").click();
    await page.getByTestId("search-input").focus();
    const recent = page.getByTestId("recent-searches");
    await expect(recent).toBeVisible();
    await expect(recent.getByRole("button", { name: "dune" })).toBeVisible();
    await expect(recent.getByRole("button", { name: "project hail mary" })).toBeVisible();
    await recent.getByRole("button", { name: "project hail mary" }).click();
    await expect(page).toHaveURL(/q=project\+hail\+mary/);
    await expect(recent).toHaveCount(0);
  });

  test("the brand link returns to the welcome state", async ({ page }) => {
    await page.goto("/?q=dune");
    await waitForSearch(page);
    await page.getByRole("link", { name: "BookGrab home" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId("welcome-state")).toBeVisible();
    await expect(page.getByTestId("search-input")).toHaveValue("");
  });
});
