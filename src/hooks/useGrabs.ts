"use client";

import { useCallback, useEffect, useReducer } from "react";
import {
  grabReducer,
  initialGrabMap,
  selectPersistedGrabs,
  type GrabMap,
} from "@/state/grab";
import { isStringRecord, readJson, STORAGE_KEYS, writeJson } from "@/lib/storage";
import type { ApiError, Book, GrabResponse } from "@/types";

/** Keep the persisted "already grabbed" list bounded. */
const MAX_PERSISTED = 500;

export interface GrabsController {
  grabs: GrabMap;
  grab: (book: Book) => Promise<void>;
  reset: (bookId: string) => void;
}

/**
 * Initial map: previously grabbed ids from localStorage. Safe to read during
 * the first client render because grab states only affect result cards, which
 * are never part of server-rendered HTML.
 */
function initGrabs(): GrabMap {
  const stored = readJson(STORAGE_KEYS.grabbed, isStringRecord);
  if (!stored) return initialGrabMap;
  return grabReducer(initialGrabMap, { type: "GRABS_HYDRATED", added: stored });
}

export function useGrabs(): GrabsController {
  const [grabs, dispatch] = useReducer(grabReducer, undefined, initGrabs);

  // Persist terminal states whenever they change.
  useEffect(() => {
    const persisted = selectPersistedGrabs(grabs);
    const entries = Object.entries(persisted)
      .sort((a, b) => b[1].localeCompare(a[1]))
      .slice(0, MAX_PERSISTED);
    writeJson(STORAGE_KEYS.grabbed, Object.fromEntries(entries));
  }, [grabs]);

  const grab = useCallback(async (book: Book) => {
    dispatch({ type: "GRAB_STARTED", bookId: book.id });
    try {
      const response = await fetch("/api/grab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ torrentUrl: book.torrentLink, category: book.category }),
      });
      const data = (await response.json()) as GrabResponse | ApiError;
      if (!response.ok || !("success" in data)) {
        const err = data as Partial<ApiError>;
        dispatch({
          type: "GRAB_FAILED",
          bookId: book.id,
          message: err.error ?? `Failed (HTTP ${response.status})`,
        });
        return;
      }
      dispatch({
        type: "GRAB_SUCCEEDED",
        bookId: book.id,
        duplicate: data.duplicate,
        at: new Date().toISOString(),
      });
    } catch (error) {
      dispatch({
        type: "GRAB_FAILED",
        bookId: book.id,
        message: error instanceof Error ? error.message : "Network error",
      });
    }
  }, []);

  const reset = useCallback((bookId: string) => {
    dispatch({ type: "GRAB_RESET", bookId });
  }, []);

  return { grabs, grab, reset };
}
