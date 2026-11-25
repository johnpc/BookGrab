import { expect, test } from "@playwright/test";
import { card, cards, failOnConsoleErrors, mock, waitForSearch } from "./helpers";

test.beforeEach(async ({ request }) => {
  await mock.reset(request);
});

test.describe("grab", () => {
  test("sends a book to Transmission and remembers it", async ({ page, request }) => {
    const assertNoErrors = failOnConsoleErrors(page);
    await page.goto("/?q=project+hail+mary");
    await waitForSearch(page);

    const target = card(page, "720129");
    const button = target.getByTestId("grab-button");
    await expect(button).toHaveText(/Download/);
    await button.click();
    await expect(target).toHaveAttribute("data-grab-status", "added");
    await expect(button).toHaveText(/Added to Transmission/);
    await expect(button).toBeDisabled();

    const state = await mock.state(request);
    expect(state.added).toEqual([expect.stringContaining("/tor/download.php/FIXTURE-DL-720129")]);

    // Survives pagination/filtering and a reload.
    await page.getByRole("radio", { name: /Ebooks/ }).click();
    await page.getByRole("radio", { name: /^All/ }).click();
    await expect(target).toHaveAttribute("data-grab-status", "added");
    await page.reload();
    await waitForSearch(page);
    await expect(card(page, "720129")).toHaveAttribute("data-grab-status", "added");
    assertNoErrors();
  });

  test("reports a torrent Transmission already has", async ({ page, request }) => {
    await page.goto("/?q=project+hail+mary");
    await waitForSearch(page);
    const first = card(page, "719737");
    await first.getByTestId("grab-button").click();
    await expect(first).toHaveAttribute("data-grab-status", "added");

    // Forget it locally, add again: Transmission says duplicate.
    await page.evaluate(() => localStorage.removeItem("bookgrab.grabbed"));
    await page.reload();
    await waitForSearch(page);
    const again = card(page, "719737");
    await again.getByTestId("grab-button").click();
    await expect(again).toHaveAttribute("data-grab-status", "duplicate");
    await expect(again.getByTestId("grab-button")).toHaveText(/Already in Transmission/);
    expect((await mock.state(request)).added).toHaveLength(1);
  });

  test("shows the Transmission error and allows a retry", async ({ page, request }) => {
    await page.goto("/?q=fail+please");
    await waitForSearch(page);
    const target = cards(page).first();
    await target.getByTestId("grab-button").click();
    await expect(target).toHaveAttribute("data-grab-status", "error");
    await expect(target.getByTestId("grab-message")).toContainText("unrecognized info");
    await expect(target.getByTestId("grab-button")).toHaveText(/Retry download/);
    await expect(target.getByTestId("grab-button")).toBeEnabled();
    expect((await mock.state(request)).added).toHaveLength(0);
  });

  test("rejects non-MAM torrent links at the API", async ({ request }) => {
    const res = await request.post("/api/grab", {
      data: { torrentUrl: "https://evil.test/tor/download.php/x", category: "ebook" },
    });
    expect(res.status()).toBe(400);
    expect(await res.json()).toMatchObject({ code: "BAD_REQUEST" });
  });
});
