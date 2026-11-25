"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from "react";
import { initialSessionState, sessionReducer, type SessionState } from "@/state/session";
import { STORAGE_KEYS, useIsClient, useStoredString, writeString } from "@/lib/storage";
import { applyTheme, isThemePreference, type ThemePreference } from "@/lib/theme";
import { isLanguageFilter, type LanguageFilter } from "@/state/search";
import type { KeepaliveResponse } from "@/types";

interface SettingsContextType {
  /** User-supplied MAM token; empty string means "use the server's". */
  mamToken: string;
  setMamToken: (token: string) => void;
  session: SessionState;
  checkSession: () => Promise<void>;
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
  /** Sticky language preference used when the URL does not specify one. */
  language: LanguageFilter;
  setLanguage: (language: LanguageFilter) => void;
  /** False during SSR/hydration; UI that depends on stored prefs can wait for it. */
  hydrated: boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const useSettings = (): SettingsContextType => {
  const context = useContext(SettingsContext);
  if (!context) throw new Error("useSettings must be used within a SettingsProvider");
  return context;
};

/** MAM sessions outlive this comfortably; 55 minutes keeps the IP binding warm. */
const KEEPALIVE_INTERVAL_MS = 55 * 60 * 1000;

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const hydrated = useIsClient();
  const mamToken = (useStoredString(STORAGE_KEYS.mamToken) ?? "").trim();
  const storedTheme = useStoredString(STORAGE_KEYS.theme);
  const theme: ThemePreference = isThemePreference(storedTheme) ? storedTheme : "system";
  const storedLanguage = useStoredString(STORAGE_KEYS.language);
  const language: LanguageFilter = isLanguageFilter(storedLanguage) ? storedLanguage : "en";
  const [session, dispatchSession] = useReducer(sessionReducer, initialSessionState);

  const checkSession = useCallback(async () => {
    if (!mamToken) return;
    dispatchSession({ type: "CHECK_STARTED", at: new Date().toISOString() });
    try {
      const response = await fetch("/api/mam-keepalive", {
        method: "POST",
        headers: { "x-mam-token": mamToken },
      });
      const data = (await response.json()) as Partial<KeepaliveResponse> & { error?: string };
      const at = new Date().toISOString();
      if (response.ok && data.success) {
        dispatchSession({ type: "CHECK_SUCCEEDED", at, message: data.message ?? "OK" });
      } else {
        dispatchSession({
          type: "CHECK_FAILED",
          at,
          message: data.message ?? data.error ?? `HTTP ${response.status}`,
          hint: data.hint,
        });
      }
    } catch (error) {
      dispatchSession({
        type: "CHECK_FAILED",
        at: new Date().toISOString(),
        message: error instanceof Error ? error.message : "Network error",
      });
    }
  }, [mamToken]);

  // Check immediately when a token is set and keep it warm afterwards.
  useEffect(() => {
    if (!mamToken) {
      dispatchSession({ type: "TOKEN_CLEARED" });
      return;
    }
    void checkSession();
    const interval = setInterval(() => void checkSession(), KEEPALIVE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [mamToken, checkSession]);

  const setMamToken = useCallback((token: string) => {
    const trimmed = token.trim();
    writeString(STORAGE_KEYS.mamToken, trimmed ? trimmed : null);
  }, []);

  const setTheme = useCallback((next: ThemePreference) => {
    writeString(STORAGE_KEYS.theme, next === "system" ? null : next);
    applyTheme(next);
  }, []);

  const setLanguage = useCallback((next: LanguageFilter) => {
    writeString(STORAGE_KEYS.language, next);
  }, []);

  const value = useMemo<SettingsContextType>(
    () => ({
      mamToken,
      setMamToken,
      session,
      checkSession,
      theme,
      setTheme,
      language,
      setLanguage,
      hydrated,
    }),
    [mamToken, setMamToken, session, checkSession, theme, setTheme, language, setLanguage, hydrated],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};
