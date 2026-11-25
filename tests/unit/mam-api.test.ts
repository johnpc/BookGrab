import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  mapMamItem,
  parseCategory,
  parseLanguages,
  sanitizeQuery,
  type MamSearchPayload,
} from "@/lib/mam-api";

const fixture = JSON.parse(
  readFileSync(new URL("../mock/fixtures/mam-search-project-hail-mary.json", import.meta.url), "utf8"),
) as MamSearchPayload;

describe("sanitizeQuery", () => {
  it("strips MAM search-syntax punctuation", () => {
    expect(sanitizeQuery("Who Moved My Cheese?")).toBe("Who Moved My Cheese");
    expect(sanitizeQuery('  "dune"  (messiah) ')).toBe("dune messiah");
  });
});

describe("parseLanguages / parseCategory", () => {
  it("maps names and codes to MAM ids and keeps numeric ids", () => {
    expect(parseLanguages("en")).toEqual(["1"]);
    expect(parseLanguages("English, 4")).toEqual(["1", "4"]);
    expect(parseLanguages("klingon")).toEqual([]);
    expect(parseLanguages(null)).toEqual([]);
  });
  it("maps categories", () => {
    expect(parseCategory("audiobook")).toEqual(["13"]);
    expect(parseCategory("Ebook")).toEqual(["14"]);
    expect(parseCategory("comics")).toEqual([]);
  });
});

describe("mapMamItem", () => {
  const base = "https://mam.test";
  const rows = fixture.data ?? [];

  it("maps an English audiobook row from the fixture", () => {
    const row = rows.find((r) => String(r.id) === "720129")!;
    const book = mapMamItem(row, base);
    expect(book).toMatchObject({
      id: "720129",
      title: "Project Hail Mary",
      author: "Andy Weir",
      narrator: "Ray Porter",
      category: "audiobook",
      format: "m4b",
      size: "881.8 MiB",
      seeders: 7329,
      leechers: 0,
      completed: 20577,
      language: 1,
      langCode: "ENG",
    });
    expect(book.torrentLink).toBe(`${base}/tor/download.php/FIXTURE-DL-720129`);
  });

  it("maps an ebook row with no narrator", () => {
    const row = rows.find((r) => String(r.id) === "1052107")!;
    const book = mapMamItem(row, base);
    expect(book.category).toBe("ebook");
    expect(book.narrator).toBeUndefined();
    expect(book.format).toBe("epub mobi");
  });

  it("falls back gracefully on sparse rows", () => {
    const book = mapMamItem({ id: 1, main_cat: "14" }, base);
    expect(book).toMatchObject({
      id: "1",
      title: "Unknown Title",
      author: "Unknown Author",
      format: "Unknown",
      seeders: 0,
      size: null,
    });
  });

  it("maps every fixture row without throwing", () => {
    expect(rows.map((r) => mapMamItem(r, base))).toHaveLength(20);
  });
});
