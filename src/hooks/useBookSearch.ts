"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import {
  initialSearchState,
  searchReducer,
  type LanguageFilter,
  type SearchState,
  type SortKey,
} from "@/state/search";
import type { ApiError, SearchResponse } from "@/types";

/**
 * Hard cap on results fetched for one query. MAM pages are 20 rows, so this is
 * 25 round trips at most. Anything bigger is a query that needs refining, and
 * the UI says so.
 */
export const MAX_RESULTS = 500;

export interface SearchParams {
  query: string;
  sort: SortKey;
  language: LanguageFilter;
}

export interface BookSearchController {
  state: SearchState;
  /** Starts a new search, cancelling any in-flight one. */
  search: (params: SearchParams) => void;
  cancel: () => void;
  reset: () => void;
}

const buildUrl = (params: SearchParams, start: number): string => {
  const url = new URLSearchParams({ q: params.query, sort: params.sort });
  if (start > 0) url.set("start", String(start));
  if (params.language === "en") url.set("lang", "en");
  return `/api/search?${url.toString()}`;
};

export function useBookSearch(mamToken: string): BookSearchController {
  const [state, dispatch] = useReducer(searchReducer, initialSearchState);
  const abortRef = useRef<AbortController | null>(null);
  const sequenceRef = useRef(0);
  const tokenRef = useRef(mamToken);
  tokenRef.current = mamToken;

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const reset = useCallback(() => {
    cancel();
    dispatch({ type: "RESET" });
  }, [cancel]);

  const search = useCallback(
    (params: SearchParams) => {
      cancel();
      const controller = new AbortController();
      abortRef.current = controller;
      const requestId = ++sequenceRef.current;
      dispatch({ type: "SEARCH_STARTED", query: params.query, requestId });

      const headers: Record<string, string> = {};
      if (tokenRef.current) headers["x-mam-token"] = tokenRef.current;

      void (async () => {
        try {
          let start = 0;
          let truncated = false;
          for (;;) {
            const response = await fetch(buildUrl(params, start), {
              headers,
              signal: controller.signal,
            });
            const data = (await response.json()) as SearchResponse | ApiError;
            if (!response.ok || "error" in data) {
              const err = data as Partial<ApiError>;
              dispatch({
                type: "SEARCH_FAILED",
                requestId,
                message: err.error ?? `Search failed (HTTP ${response.status})`,
                code: err.code,
              });
              return;
            }
            dispatch({
              type: "PAGE_RECEIVED",
              requestId,
              books: data.books,
              total: data.totalResults,
              hasMore: data.hasMore,
            });
            if (!data.hasMore || data.books.length === 0) break;
            start += data.books.length;
            if (start >= MAX_RESULTS) {
              truncated = true;
              break;
            }
          }
          dispatch({ type: "SEARCH_COMPLETED", requestId, truncated });
        } catch (error) {
          if (controller.signal.aborted) return;
          dispatch({
            type: "SEARCH_FAILED",
            requestId,
            message: error instanceof Error ? error.message : "Network error",
          });
        }
      })();
    },
    [cancel],
  );

  // Abort any in-flight search when the component unmounts.
  useEffect(() => cancel, [cancel]);

  return { state, search, cancel, reset };
}
