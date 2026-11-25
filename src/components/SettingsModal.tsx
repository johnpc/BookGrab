"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useSettings } from "@/contexts/SettingsContext";
import { THEME_PREFERENCES, type ThemePreference } from "@/lib/theme";
import type { StatusResponse } from "@/types";
import { CloseIcon } from "./icons";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const THEME_LABELS: Record<ThemePreference, string> = {
  system: "Match system",
  dark: "Dark",
  light: "Light",
};

const formatTime = (iso: string): string =>
  new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

/**
 * Settings dialog. The "saved" flash and the token draft are local; everything
 * durable lives in SettingsContext. The dialog remounts on every open (see
 * HomeClient), so the draft always starts from the current saved token.
 */
export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  if (!isOpen) return null;
  return <SettingsDialog onClose={onClose} />;
}

function SettingsDialog({ onClose }: { onClose: () => void }) {
  const { mamToken, setMamToken, session, checkSession, theme, setTheme } = useSettings();
  const [draft, setDraft] = useState(mamToken);
  const [showToken, setShowToken] = useState(false);
  const [saved, setSaved] = useState(false);
  const [server, setServer] = useState<StatusResponse | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const tokenId = useId();
  const themeId = useId();

  useEffect(() => {
    inputRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/status", { signal: controller.signal })
      .then((r) => (r.ok ? (r.json() as Promise<StatusResponse>) : null))
      .then((data) => data && setServer(data))
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  const dirty = draft.trim() !== mamToken;

  const handleSave = () => {
    setMamToken(draft);
    setSaved(true);
    window.setTimeout(onClose, 900);
  };

  return (
    <div
      className="dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="settings-dialog"
      >
        <div className="panel__row">
          <h2 className="dialog__title" id={titleId}>
            Settings
          </h2>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close settings"
            data-testid="settings-close"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="field">
          <label className="field__label" htmlFor={tokenId}>
            Your MAM session token <span style={{ fontWeight: 400, opacity: 0.7 }}>(optional)</span>
          </label>
          <div className="input-row">
            <input
              id={tokenId}
              ref={inputRef}
              className="input"
              type={showToken ? "text" : "password"}
              autoComplete="off"
              spellCheck={false}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={server?.mamTokenConfigured ? "Using the server's session" : "Paste your mam_id"}
              data-testid="mam-token-input"
            />
            <button
              type="button"
              className="button"
              onClick={() => setShowToken((v) => !v)}
              aria-pressed={showToken}
              data-testid="token-visibility"
            >
              {showToken ? "Hide" : "Show"}
            </button>
          </div>
          <p className="field__help">
            Leave empty to use the session configured on the server. To use your own: MAM →
            Preferences → Security → create a session with “Allow dynamic seedbox IP” enabled.
          </p>
        </div>

        {mamToken && (
          <div className="panel" data-testid="session-panel">
            <div className="panel__row">
              <span className="panel__title">Your session</span>
              <span className="pill-status" data-status={session.status} data-testid="session-status">
                {session.status === "unknown" && "Not checked"}
                {session.status === "checking" && "Checking…"}
                {session.status === "active" && "Active"}
                {session.status === "error" && "Error"}
              </span>
            </div>
            {session.status === "active" && (
              <div>
                Checked {formatTime(session.checkedAt)} · {session.message}
              </div>
            )}
            {session.status === "error" && (
              <div style={{ color: "var(--danger-fg)" }} data-testid="session-error">
                {session.message}
                {session.hint && <div style={{ marginTop: 4 }}>{session.hint}</div>}
              </div>
            )}
            <div className="panel__row">
              <span>Re-checked every 55 minutes while this tab is open.</span>
              <button
                type="button"
                className="button"
                onClick={() => void checkSession()}
                disabled={session.status === "checking"}
                data-testid="refresh-session"
              >
                Check now
              </button>
            </div>
          </div>
        )}

        <div className="panel" data-testid="server-status">
          <div className="panel__row">
            <span className="panel__title">Server</span>
            {server ? (
              <span
                className="pill-status"
                data-status={server.mamTokenConfigured && server.transmissionConfigured ? "ok" : "error"}
              >
                {server.mamTokenConfigured && server.transmissionConfigured ? "Ready" : "Needs setup"}
              </span>
            ) : (
              <span className="pill-status">…</span>
            )}
          </div>
          {server && (
            <>
              <div>MAM session: {server.mamTokenConfigured ? "configured" : "not configured"}</div>
              <div>Transmission: {server.transmissionConfigured ? "configured" : "not configured"}</div>
              {server.keepalive && (
                <div>
                  Last MAM keepalive {formatTime(server.keepalive.at)}:{" "}
                  {server.keepalive.success ? "OK" : "failed"} ({server.keepalive.message})
                </div>
              )}
              <div style={{ opacity: 0.7 }}>BookGrab {server.version}</div>
            </>
          )}
        </div>

        <div className="field">
          <label className="field__label" htmlFor={themeId}>
            Theme
          </label>
          <select
            id={themeId}
            className="select"
            value={theme}
            onChange={(event) => setTheme(event.target.value as ThemePreference)}
            data-testid="theme-select"
          >
            {THEME_PREFERENCES.map((option) => (
              <option key={option} value={option}>
                {THEME_LABELS[option]}
              </option>
            ))}
          </select>
        </div>

        {saved && (
          <div className="toast" role="status" data-testid="settings-saved">
            Settings saved
          </div>
        )}

        <div className="dialog__actions">
          <button type="button" className="button" onClick={onClose} data-testid="settings-cancel">
            {dirty ? "Cancel" : "Close"}
          </button>
          <button
            type="button"
            className="button button--primary"
            onClick={handleSave}
            disabled={!dirty || saved}
            data-testid="settings-save"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
