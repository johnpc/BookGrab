import { describe, expect, it } from "vitest";
import { isSafeTorrentName, parsePathMap, toLocalPath } from "@/lib/copy-completed";

describe("parsePathMap", () => {
  it("returns nothing for unset or malformed input", () => {
    expect(parsePathMap(undefined)).toEqual([]);
    expect(parsePathMap("")).toEqual([]);
    expect(parsePathMap("/a")).toEqual([]);
    expect(parsePathMap("/a=")).toEqual([]);
    expect(parsePathMap("/a=/b=/c")).toEqual([]);
  });
  it("parses pairs, trims, and puts the longest remote prefix first", () => {
    expect(parsePathMap(" /data = /mnt/data/ , /data/books=/srv/books ")).toEqual([
      ["/data/books", "/srv/books"],
      ["/data", "/mnt/data"],
    ]);
  });
});

describe("toLocalPath", () => {
  const map = parsePathMap("/data/books=/srv/books,/data=/mnt/data");
  it("uses the most specific mapping", () => {
    expect(toLocalPath("/data/books/ebooks", map)).toBe("/srv/books/ebooks");
    expect(toLocalPath("/data/audio", map)).toBe("/mnt/data/audio");
    expect(toLocalPath("/data", map)).toBe("/mnt/data");
  });
  it("does not match on a partial path segment", () => {
    expect(toLocalPath("/database/x", map)).toBe("/database/x");
  });
  it("leaves unmapped paths alone", () => {
    expect(toLocalPath("/elsewhere/x", map)).toBe("/elsewhere/x");
    expect(toLocalPath("/elsewhere/x", [])).toBe("/elsewhere/x");
  });
});

describe("isSafeTorrentName", () => {
  it("accepts plain names", () => {
    expect(isSafeTorrentName("Project Hail Mary (2021)")).toBe(true);
  });
  it("rejects anything that could escape the destination", () => {
    for (const name of ["", ".", "..", "../x", "a/b", "/abs"]) {
      expect(isSafeTorrentName(name)).toBe(false);
    }
  });
});
