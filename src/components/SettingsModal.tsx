"use client";

import { useState } from "react";
import {
  Button,
  TextField,
  Flex,
  Heading,
  Text,
  View,
  useTheme,
} from "@aws-amplify/ui-react";
import { useSettings } from "@/contexts/SettingsContext";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { mamToken, setMamToken } = useSettings();
  const [tokenInput, setTokenInput] = useState(mamToken);
  const [saved, setSaved] = useState(false);
  const { tokens } = useTheme();

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
    setTokenInput(mamToken); // Reset to saved value
    setSaved(false);
    onClose();
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
          border: "1px solid #334155"
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
                outline: "none"
              }}
            />
            <p style={{
              margin: 0,
              fontSize: "12px",
              color: "#94a3b8"
            }}>
              Your MyAnonamouse API token for searching books
            </p>
          </div>

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
