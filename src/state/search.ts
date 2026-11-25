import type { Book } from "@/types";

/**
 * Explicit state machine for a search.
 *
 *   idle ──SEARCH_STARTED──▶ searching ──PAGE_RECEIVED(hasMore)──▶ streaming ──PAGE_RECEIVED…
 *                                │                                     │
 *                                └──PAGE_RECEIVED(!hasMore)/COMPLETED──┴──▶ ready
 *                                │                                     │
 *                                └──────────────SEARCH_FAILED──────────┴──▶ error (keeps partial books)
 *
 * Every event carries the requestId of the search that produced it. Events from
 * a superseded search are ignored, so a slow old search can never overwrite a
 * newer one.
 */

export type SortKey = "seeds" | "date" | "size" | "name" | "times_completed";
export type TypeFilter = "all" | "ebook" | "audiobook";
export type LanguageFilter = "en" | "all";

export const SORT_KEYS: readonly SortKey[] = [
  "seeds",
  "date",
  "size",
  "name",
  "times_completed",
];
export const TYPE_FILTERS: readonly TypeFilter[] = ["all", "ebook", "audiobook"];
export const LANGUAGE_FILTERS: readonly LanguageFilter[] = ["en", "all"];

export const SORT_LABELS: Record<SortKey, string> = {
  seeds: "Most seeders",
  date: "Newest",
  size: "Largest",
  name: "Title A–Z",
  times_completed: "Most downloaded",
};

export const isSortKey = (v: unknown): v is SortKey =>
  typeof v === "string" && (SORT_KEYS as readonly string[]).includes(v);
export const isTypeFilter = (v: unknown): v is TypeFilter =>
  typeof v === "string" && (TYPE_FILTERS as readonly string[]).includes(v);
export const isLanguageFilter = (v: unknown): v is LanguageFilter =>
  typeof v === "string" && (LANGUAGE_FILTERS as readonly string[]).includes(v);

export type SearchState =
  | { status: "idle" }
  | { status: "searching"; query: string; requestId: number }
  | {
      status: "streaming";
      query: string;
      requestId: number;
      books: Book[];
      total: number;
    }
  | {
      status: "ready";
      query: string;
      requestId: number;
      books: Book[];
      total: number;
      /** True when the result cap stopped us before fetching every page. */
      truncated: boolean;
    }
  | {
      status: "error";
      query: string;
      requestId: number;
      message: string;
      code?: string;
      /** Pages that arrived before the failure. */
      books: Book[];
      total: number;
    };

export type SearchEvent =
  | { type: "SEARCH_STARTED"; query: string; requestId: number }
  | {
      type: "PAGE_RECEIVED";
      requestId: number;
      books: Book[];
      total: number;
      hasMore: boolean;
    }
  | { type: "SEARCH_COMPLETED"; requestId: number; truncated: boolean }
  | {
      type: "SEARCH_FAILED";
      requestId: number;
      message: string;
      code?: string;
    }
  | { type: "RESET" };

export const initialSearchState: SearchState = { status: "idle" };

const isCurrent = (state: SearchState, requestId: number): boolean =>
  state.status !== "idle" && state.requestId === requestId;

export function searchReducer(
  state: SearchState,
  event: SearchEvent,
): SearchState {
  switch (event.type) {
    case "RESET":
      return initialSearchState;

    case "SEARCH_STARTED":
      return {
        status: "searching",
        query: event.query,
        requestId: event.requestId,
      };

    case "PAGE_RECEIVED": {
      if (!isCurrent(state, event.requestId)) return state;
      if (state.status !== "searching" && state.status !== "streaming") {
        return state;
      }
      const previous = state.status === "streaming" ? state.books : [];
      const books = dedupeById([...previous, ...event.books]);
      if (event.hasMore) {
        return {
          status: "streaming",
          query: state.query,
          requestId: state.requestId,
          books,
          total: event.total,
        };
      }
      return {
        status: "ready",
        query: state.query,
        requestId: state.requestId,
        books,
        total: event.total,
        truncated: false,
      };
    }

    case "SEARCH_COMPLETED": {
      if (!isCurrent(state, event.requestId)) return state;
      if (state.status === "streaming") {
        return {
          status: "ready",
          query: state.query,
          requestId: state.requestId,
          books: state.books,
          total: state.total,
          truncated: event.truncated,
        };
      }
      if (state.status === "searching") {
        // Completed without a single page: nothing found.
        return {
          status: "ready",
          query: state.query,
          requestId: state.requestId,
          books: [],
          total: 0,
          truncated: false,
        };
      }
      return state;
    }

    case "SEARCH_FAILED": {
      if (state.status === "idle" || state.requestId !== event.requestId) return state;
      const books = "books" in state ? state.books : [];
      const total = "total" in state ? state.total : 0;
      return {
        status: "error",
        query: state.query,
        requestId: state.requestId,
        message: event.message,
        code: event.code,
        books,
        total,
      };
    }
  }
}

function dedupeById(books: Book[]): Book[] {
  const seen = new Set<string>();
  const out: Book[] = [];
  for (const book of books) {
    if (seen.has(book.id)) continue;
    seen.add(book.id);
    out.push(book);
  }
  return out;
}

/** Books currently known to the state, regardless of status. */
export const selectBooks = (state: SearchState): Book[] =>
  "books" in state ? state.books : [];

export const selectIsFetching = (state: SearchState): boolean =>
  state.status === "searching" || state.status === "streaming";

export const selectQuery = (state: SearchState): string =>
  state.status === "idle" ? "" : state.query;
