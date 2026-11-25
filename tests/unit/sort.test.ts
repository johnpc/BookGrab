import { describe, expect, it } from "vitest";
import { parseAddedToMillis, parseSizeToBytes, sortBooks } from "@/lib/sort";
import type { Book } from "@/types";

const book = (id: string, extra: Partial<Book>): Book => ({
  id,
  title: id,
  author: "a",
  format: "epub",
  torrentLink: "",
  category: "ebook",
  size: null,
  seeders: 0,
  leechers: 0,
  added: null,
  tags: null,
  completed: 0,
  ...extra,
});

describe("parseSizeToBytes", () => {
  it("understands MAM's binary units", () => {
    expect(parseSizeToBytes("881.8 MiB")).toBeCloseTo(881.8 * 1024 ** 2);
    expect(parseSizeToBytes("1.0 GiB")).toBe(1024 ** 3);
    expect(parseSizeToBytes("670.7 KiB")).toBeCloseTo(670.7 * 1024);
  });
  it("handles thousands separators and decimal units", () => {
    expect(parseSizeToBytes("1,015.2 MiB")).toBeCloseTo(1015.2 * 1024 ** 2);
    expect(parseSizeToBytes("2 GB")).toBe(2e9);
  });
  it("treats junk as zero", () => {
    expect(parseSizeToBytes(null)).toBe(0);
    expect(parseSizeToBytes("")).toBe(0);
    expect(parseSizeToBytes("lots")).toBe(0);
  });
});

describe("parseAddedToMillis", () => {
  it("parses MAM timestamps as UTC", () => {
    expect(parseAddedToMillis("2021-05-04 06:24:41")).toBe(Date.UTC(2021, 4, 4, 6, 24, 41));
    expect(parseAddedToMillis(null)).toBe(0);
  });
});

describe("sortBooks", () => {
  const books = [
    book("small-old", { size: "670.7 KiB", seeders: 5, added: "2020-01-01 00:00:00", completed: 1, title: "b" }),
    book("big-new", { size: "1.6 GiB", seeders: 1, added: "2026-06-01 16:02:12", completed: 9, title: "a" }),
    book("mid", { size: "1,015.2 MiB", seeders: 3, added: "2024-04-09 11:44:25", completed: 5, title: "C" }),
  ];

  it("sorts by size using real byte values", () => {
    expect(sortBooks(books, "size").map((b) => b.id)).toEqual(["big-new", "mid", "small-old"]);
  });
  it("sorts by seeders descending", () => {
    expect(sortBooks(books, "seeds").map((b) => b.id)).toEqual(["small-old", "mid", "big-new"]);
  });
  it("sorts by date descending", () => {
    expect(sortBooks(books, "date").map((b) => b.id)).toEqual(["big-new", "mid", "small-old"]);
  });
  it("sorts by title case-insensitively", () => {
    expect(sortBooks(books, "name").map((b) => b.id)).toEqual(["big-new", "small-old", "mid"]);
  });
  it("sorts by downloads", () => {
    expect(sortBooks(books, "times_completed").map((b) => b.id)).toEqual(["big-new", "mid", "small-old"]);
  });
  it("does not mutate its input", () => {
    const copy = [...books];
    sortBooks(books, "size");
    expect(books).toEqual(copy);
  });
});
