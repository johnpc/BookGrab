"use client";

import { useState } from "react";
import { useSettings } from "@/contexts/SettingsContext";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { mamToken, setMamToken, keepaliveStatus, triggerKeepalive } = useSettings();
  const [tokenInput, setTokenInput] = useState(mamToken);
  const [saved, setSaved] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    setMamToken(tokenInput);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 1500);
  };

  const handleClose = () => {
    setTokenInput(mamToken);
    setSaved(false);
    onClose();
  };

  const handleRefreshSession = async () => {
    setIsRefreshing(true);
    await triggerKeepalive();
    setIsRefreshing(false);
  };

  const formatLastCheck = (isoString: string | null) => {
    if (!isoString) return "Never";
    const date = new Date(isoString);
    return date.toLocaleTimeString();
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1000
      }}
      onClick={handleClose}
    >
      <div
        style={{
          background: "#1e293b",
          padding: "24px",
          borderRadius: "12px",
          maxWidth: "500px",
          width: "90%",
          border: "1px solid #334155",
          maxHeight: "90vh",
          overflowY: "auto"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <h2 style={{
            margin: 0,
            fontSize: "24px",
            fontWeight: "700",
            color: "#e5e7eb"
          }}>
            Settings
          </h2>

          {/* MAM Token Input */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <label style={{
              fontWeight: "600",
              fontSize: "14px",
              color: "#e5e7eb"
            }}>
              MAM Token
            </label>
            <input
              type="password"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="Enter your MAM token"
              style={{
                width: "100%",
                padding: "12px 16px",
                background: "#0f172a",
                border: "1px solid #334155",
                borderRadius: "8px",
                color: "#e5e7eb",
                fontSize: "14px",
                outline: "none",
                boxSizing: "border-box"
              }}
            />
            <p style={{
              margin: 0,
              fontSize: "12px",
              color: "#94a3b8"
            }}>
              Get your token from MAM → Preferences → Security → Create session with "Allow dynamic seedbox IP" enabled
            </p>
          </div>

          {/* Session Status */}
          {mamToken && (
            <div style={{
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              padding: "16px",
              background: "#0f172a",
              borderRadius: "8px",
              border: "1px solid #334155"
            }}>
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}>
                <span style={{ fontSize: "14px", fontWeight: "600", color: "#e5e7eb" }}>
                  Session Status
                </span>
                <span style={{
                  padding: "4px 10px",
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontWeight: "600",
                  background: keepaliveStatus.success ? "#065f46" : keepaliveStatus.lastCheck ? "#7f1d1d" : "#374151",
                  color: keepaliveStatus.success ? "#6ee7b7" : keepaliveStatus.lastCheck ? "#fca5a5" : "#9ca3af"
                }}>
                  {keepaliveStatus.success ? "Active" : keepaliveStatus.lastCheck ? "Error" : "Unknown"}
                </span>
              </div>

              <div style={{ fontSize: "13px", color: "#94a3b8" }}>
                <div style={{ marginBottom: "4px" }}>
                  Last check: {formatLastCheck(keepaliveStatus.lastCheck)}
                </div>
                {keepaliveStatus.message && (
                  <div style={{ color: "#6ee7b7" }}>
                    Response: {keepaliveStatus.message}
                  </div>
                )}
                {keepaliveStatus.error && (
                  <div style={{ color: "#fca5a5" }}>
                    Error: {keepaliveStatus.error}
                  </div>
                )}
              </div>

              <button
                onClick={handleRefreshSession}
                disabled={isRefreshing}
                style={{
                  padding: "10px 16px",
                  background: "#374151",
                  border: "1px solid #4b5563",
                  borderRadius: "8px",
                  color: "#e5e7eb",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: isRefreshing ? "not-allowed" : "pointer",
                  opacity: isRefreshing ? 0.7 : 1
                }}
              >
                {isRefreshing ? "Refreshing..." : "Refresh Session Now"}
              </button>

              <p style={{
                margin: 0,
                fontSize: "11px",
                color: "#64748b"
              }}>
                Session is automatically refreshed every 55 minutes to keep it alive
              </p>
            </div>
          )}

          {saved && (
            <div style={{
              padding: "10px",
              background: "#065f46",
              border: "1px solid #047857",
              borderRadius: "8px",
              color: "#6ee7b7",
              fontSize: "14px",
              fontWeight: "600",
              textAlign: "center"
            }}>
              Settings saved successfully!
            </div>
          )}

          <div style={{
            display: "flex",
            gap: "12px",
            justifyContent: "flex-end"
          }}>
            <button
              onClick={handleClose}
              style={{
                padding: "10px 20px",
                background: "transparent",
                border: "1px solid #334155",
                borderRadius: "8px",
                color: "#94a3b8",
                fontSize: "14px",
                fontWeight: "600",
                cursor: "pointer"
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              style={{
                padding: "10px 20px",
                background: "#3b82f6",
                border: "none",
                borderRadius: "8px",
                color: "white",
                fontSize: "14px",
                fontWeight: "600",
                cursor: "pointer"
              }}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
