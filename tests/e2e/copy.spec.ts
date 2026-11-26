import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { E2E_COPY_AUDIOBOOKS, E2E_COPY_EBOOKS, E2E_DOWNLOADS_ROOT } from "../mock/env.mjs";
import { card, mock, waitForSearch } from "./helpers";

test.beforeEach(async ({ request }) => {
  await mock.reset(request);
  await rm(E2E_COPY_AUDIOBOOKS, { recursive: true, force: true });
  await rm(E2E_COPY_EBOOKS, { recursive: true, force: true });
});

const copyStatus = async (request: APIRequestContext) =>
  ((await (await request.get("/api/status")).json()) as { copy: { enabled: boolean; copied: number } }).copy;

test.describe("copy on complete", () => {
  test("copies a finished download to the category copy dir and leaves the original", async ({
    page,
    request,
  }) => {
    expect((await copyStatus(request)).enabled).toBe(true);

    await page.goto("/?q=project+hail+mary");
    await waitForSearch(page);
    await card(page, "720129").getByTestId("grab-button").click();
    await expect(card(page, "720129")).toHaveAttribute("data-grab-status", "added");

    const [torrent] = (await mock.state(request)).torrents;
    expect(torrent.downloadDir).toMatch(/^\/mock\/(ebooks|audiobooks)$/);
    const category = torrent.downloadDir.split("/").pop()!;
    const copyDir = category === "ebooks" ? E2E_COPY_EBOOKS : E2E_COPY_AUDIOBOOKS;

    // Transmission's "/mock" is E2E_DOWNLOADS_ROOT on this machine; a folder torrent with a nested file.
    const source = join(E2E_DOWNLOADS_ROOT, category, torrent.name);
    await mkdir(join(source, "nested"), { recursive: true });
    await writeFile(join(source, "book.epub"), "book contents");
    await writeFile(join(source, "nested", "cover.jpg"), "cover");

    const before = (await copyStatus(request)).copied;

    await mock.complete(request);

    await expect.poll(async () => (await copyStatus(request)).copied).toBe(before + 1);
    expect(await readFile(join(copyDir, torrent.name, "book.epub"), "utf8")).toBe("book contents");
    expect(await readFile(join(copyDir, torrent.name, "nested", "cover.jpg"), "utf8")).toBe("cover");
    // Copied, not moved.
    expect(await readFile(join(source, "book.epub"), "utf8")).toBe("book contents");
  });
});
