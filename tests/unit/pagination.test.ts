import { describe, expect, it } from "vitest";
import { visiblePages } from "@/lib/pagination";

describe("visiblePages", () => {
  it("shows everything for small counts", () => {
    expect(visiblePages(1, 3)).toEqual([1, 2, 3]);
  });
  it("windows around the current page with first and last", () => {
    expect(visiblePages(1, 17)).toEqual([1, 2, 17]);
    expect(visiblePages(9, 17)).toEqual([1, 8, 9, 10, 17]);
    expect(visiblePages(17, 17)).toEqual([1, 16, 17]);
  });
});
