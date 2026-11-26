import { expect, type Page, type APIRequestContext } from "@playwright/test";
import { MOCK_ORIGIN } from "../mock/env.mjs";

export const mock = {
  reset: (request: APIRequestContext) => request.post(`${MOCK_ORIGIN}/__mock/reset`),
  release: (request: APIRequestContext) => request.post(`${MOCK_ORIGIN}/__mock/release`),
  complete: (request: APIRequestContext) => request.post(`${MOCK_ORIGIN}/__mock/complete`),
  state: async (request: APIRequestContext) =>
    (await (await request.get(`${MOCK_ORIGIN}/__mock/state`)).json()) as {
      added: string[];
      torrents: { name: string; hashString: string; downloadDir: string; percentDone: number }[];
      gatedPending: number;
      servedGated: number;
      searchCalls: number;
    },
};

/** Type a query and submit via the Search button. */
export async function search(page: Page, query: string) {
  await page.getByTestId("search-input").fill(query);
  await page.getByTestId("search-submit").click();
}

/** Wait for the search machine to settle in `ready` (or the given status). */
export async function waitForSearch(page: Page, status: "ready" | "error" = "ready") {
  await expect(page.locator(".app")).toHaveAttribute("data-search-status", status);
}

export const cards = (page: Page) => page.getByTestId("book-card");
export const card = (page: Page, bookId: string) =>
  page.locator(`[data-testid="book-card"][data-book-id="${bookId}"]`);

/** Fail the test on any browser console error or uncaught page error. */
export function failOnConsoleErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(String(err)));
  return () => expect(errors, "browser console errors").toEqual([]);
}
