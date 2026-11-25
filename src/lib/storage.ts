"use client";

import { useSyncExternalStore } from "react";

/**
 * Tiny, safe wrappers around localStorage plus a React subscription so
 * components read stored values with useSyncExternalStore (SSR-safe: the
 * server snapshot is always null, the client snapshot is the stored value).
 * Every read is guarded so a corrupt value or a browser with storage disabled
 * can never crash the app.
 */

export const STORAGE_KEYS = {
  /** User-supplied MAM session token (overrides the server's). */
  mamToken: "mam_token",
  /** Last five search queries. */
  recentSearches: "recentSearches",
  /** Book ids already sent to Transmission, with ISO timestamps. */
  grabbed: "bookgrab.grabbed",
  /** "system" | "dark" | "light" */
  theme: "bookgrab.theme",
  /** "en" | "all" */
  language: "bookgrab.lang",
} as const;

const hasStorage = (): boolean =>
  typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (typeof window !== "undefined") window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") window.removeEventListener("storage", listener);
  };
}

export function readString(key: string): string | null {
  if (!hasStorage()) return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeString(key: string, value: string | null): void {
  if (!hasStorage()) return;
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Storage full or disabled; the in-memory state still works.
  }
  notify();
}

export function readJson<T>(key: string, isValid: (value: unknown) => value is T): T | null {
  return parseJson(readString(key), isValid);
}

export function parseJson<T>(raw: string | null, isValid: (value: unknown) => value is T): T | null {
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isValid(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeJson(key: string, value: unknown): void {
  writeString(key, JSON.stringify(value));
}

export const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((v) => typeof v === "string");

export const isStringRecord = (value: unknown): value is Record<string, string> =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  Object.values(value as Record<string, unknown>).every((v) => typeof v === "string");

/** Raw stored string for `key`; null on the server and when unset. */
export function useStoredString(key: string): string | null {
  return useSyncExternalStore(
    subscribe,
    () => readString(key),
    () => null,
  );
}

/** False during SSR and hydration, true once running on the client. */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
