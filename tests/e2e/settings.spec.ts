import { expect, test } from "@playwright/test";
import { cards, failOnConsoleErrors, search, waitForSearch } from "./helpers";

test.describe("settings", () => {
  test("opens, saves a token, and shows it again next time", async ({ page }) => {
    const assertNoErrors = failOnConsoleErrors(page);
    await page.goto("/");
    await page.getByRole("button", { name: "Settings" }).click();
    const dialog = page.getByTestId("settings-dialog");
    await expect(dialog).toBeVisible();
    await expect(page.getByTestId("mam-token-input")).toBeFocused();
    await expect(page.getByTestId("settings-save")).toBeDisabled();
    await expect(dialog.getByTestId("server-status")).toContainText("Ready");

    await page.getByTestId("mam-token-input").fill("mock-token");
    await page.getByTestId("settings-save").click();
    await expect(page.getByTestId("settings-saved")).toBeVisible();
    await expect(dialog).toHaveCount(0);

    // Regression: the field used to come back empty after a reload.
    await page.reload();
    await page.getByRole("button", { name: "Settings" }).click();
    await expect(page.getByTestId("mam-token-input")).toHaveValue("mock-token");
    await page.getByTestId("token-visibility").click();
    await expect(page.getByTestId("mam-token-input")).toHaveAttribute("type", "text");
    await expect(page.getByTestId("session-status")).toHaveAttribute("data-status", "active");
    await expect(page.getByTestId("session-panel")).toContainText("No change");

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    assertNoErrors();
  });

  test("explains a bad or wrong-type session", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.setItem("mam_token", "wrong-type"));
    await page.reload();
    await page.getByRole("button", { name: "Settings" }).click();
    await expect(page.getByTestId("session-status")).toHaveAttribute("data-status", "error");
    await expect(page.getByTestId("session-error")).toContainText("dynamic seedbox");

    await page.getByTestId("mam-token-input").fill("totally-invalid");
    await page.getByTestId("settings-save").click();
    await expect(page.getByTestId("settings-dialog")).toHaveCount(0);

    await search(page, "project hail mary");
    await waitForSearch(page, "error");
    const banner = page.getByTestId("error-banner");
    await expect(banner).toContainText("rejected the session token");
    await expect(banner).toContainText("Check the MAM session token in Settings");
    await banner.getByTestId("error-action").click();
    await expect(page.getByTestId("settings-dialog")).toBeVisible();

    // Clearing the token falls back to the server session and the search works.
    await page.getByTestId("mam-token-input").fill("");
    await page.getByTestId("settings-save").click();
    await expect(page.getByTestId("settings-dialog")).toHaveCount(0);
    await search(page, "project hail mary");
    await waitForSearch(page);
    await expect(cards(page)).toHaveCount(10);
  });

  test("theme preference applies immediately and persists", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Settings" }).click();
    await page.getByTestId("theme-select").selectOption("light");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await page.getByRole("button", { name: "Settings" }).click();
    await expect(page.getByTestId("theme-select")).toHaveValue("light");
    await page.getByTestId("theme-select").selectOption("system");
    await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.+/);
  });

  test("upstream MAM failures are reported with a retry", async ({ page }) => {
    await page.goto("/");
    await search(page, "boom dune");
    await waitForSearch(page, "error");
    await expect(page.getByTestId("error-banner")).toContainText("MyAnonyMouse returned 500");
    await expect(page.getByTestId("error-action")).toHaveText("Try again");
  });
});
