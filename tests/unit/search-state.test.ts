import { describe, expect, it } from "vitest";
import {
  initialSearchState,
  searchReducer,
  selectBooks,
  selectIsFetching,
  type SearchState,
} from "@/state/search";
import type { Book } from "@/types";

const book = (id: string, extra: Partial<Book> = {}): Book => ({
  id,
  title: `Book ${id}`,
  author: "Author",
  format: "epub",
  torrentLink: `https://example.test/tor/download.php/${id}`,
  category: "ebook",
  size: "1.0 MiB",
  seeders: 1,
  leechers: 0,
  added: "2024-01-01 00:00:00",
  tags: null,
  completed: 0,
  ...extra,
});

describe("searchReducer", () => {
  it("starts in idle and moves to searching", () => {
    const s = searchReducer(initialSearchState, { type: "SEARCH_STARTED", query: "dune", requestId: 1 });
    expect(s).toEqual({ status: "searching", query: "dune", requestId: 1 });
    expect(selectIsFetching(s)).toBe(true);
    expect(selectBooks(s)).toEqual([]);
  });

  it("streams pages then becomes ready", () => {
    let s = searchReducer(initialSearchState, { type: "SEARCH_STARTED", query: "dune", requestId: 1 });
    s = searchReducer(s, { type: "PAGE_RECEIVED", requestId: 1, books: [book("a")], total: 3, hasMore: true });
    expect(s.status).toBe("streaming");
    s = searchReducer(s, { type: "PAGE_RECEIVED", requestId: 1, books: [book("b"), book("c")], total: 3, hasMore: false });
    expect(s.status).toBe("ready");
    expect(selectBooks(s).map((b) => b.id)).toEqual(["a", "b", "c"]);
    expect(selectIsFetching(s)).toBe(false);
  });

  it("marks truncation when completed early", () => {
    let s: SearchState = searchReducer(initialSearchState, { type: "SEARCH_STARTED", query: "dune", requestId: 1 });
    s = searchReducer(s, { type: "PAGE_RECEIVED", requestId: 1, books: [book("a")], total: 900, hasMore: true });
    s = searchReducer(s, { type: "SEARCH_COMPLETED", requestId: 1, truncated: true });
    expect(s).toMatchObject({ status: "ready", truncated: true, total: 900 });
  });

  it("ignores events from a superseded search", () => {
    let s = searchReducer(initialSearchState, { type: "SEARCH_STARTED", query: "old", requestId: 1 });
    s = searchReducer(s, { type: "SEARCH_STARTED", query: "new", requestId: 2 });
    const stale = searchReducer(s, { type: "PAGE_RECEIVED", requestId: 1, books: [book("old")], total: 1, hasMore: false });
    expect(stale).toBe(s);
    const staleFail = searchReducer(s, { type: "SEARCH_FAILED", requestId: 1, message: "nope" });
    expect(staleFail).toBe(s);
    const fresh = searchReducer(s, { type: "PAGE_RECEIVED", requestId: 2, books: [book("new")], total: 1, hasMore: false });
    expect(fresh).toMatchObject({ status: "ready", query: "new" });
  });

  it("keeps partial results when a later page fails", () => {
    let s = searchReducer(initialSearchState, { type: "SEARCH_STARTED", query: "dune", requestId: 1 });
    s = searchReducer(s, { type: "PAGE_RECEIVED", requestId: 1, books: [book("a")], total: 40, hasMore: true });
    s = searchReducer(s, { type: "SEARCH_FAILED", requestId: 1, message: "boom", code: "MAM_UPSTREAM" });
    expect(s).toMatchObject({ status: "error", message: "boom", code: "MAM_UPSTREAM", total: 40 });
    expect(selectBooks(s)).toHaveLength(1);
  });

  it("dedupes books that appear on two pages", () => {
    let s = searchReducer(initialSearchState, { type: "SEARCH_STARTED", query: "dune", requestId: 1 });
    s = searchReducer(s, { type: "PAGE_RECEIVED", requestId: 1, books: [book("a"), book("b")], total: 3, hasMore: true });
    s = searchReducer(s, { type: "PAGE_RECEIVED", requestId: 1, books: [book("b"), book("c")], total: 3, hasMore: false });
    expect(selectBooks(s).map((b) => b.id)).toEqual(["a", "b", "c"]);
  });

  it("completing with no pages means no results", () => {
    let s = searchReducer(initialSearchState, { type: "SEARCH_STARTED", query: "x", requestId: 1 });
    s = searchReducer(s, { type: "SEARCH_COMPLETED", requestId: 1, truncated: false });
    expect(s).toMatchObject({ status: "ready", books: [], total: 0 });
  });

  it("resets to idle", () => {
    const s = searchReducer(initialSearchState, { type: "SEARCH_STARTED", query: "x", requestId: 1 });
    expect(searchReducer(s, { type: "RESET" })).toBe(initialSearchState);
  });
});
