"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

interface KeepaliveStatus {
  lastCheck: string | null;
  success: boolean;
  message: string | null;
  error: string | null;
}

interface SettingsContextType {
  mamToken: string;
  setMamToken: (token: string) => void;
  clearMamToken: () => void;
  keepaliveStatus: KeepaliveStatus;
  triggerKeepalive: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(
  undefined,
);

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
};

// Keepalive interval: 55 minutes (just under 1 hour to be safe)
const KEEPALIVE_INTERVAL = 55 * 60 * 1000;

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [mamToken, setMamTokenState] = useState<string>("");
  const [keepaliveStatus, setKeepaliveStatus] = useState<KeepaliveStatus>({
    lastCheck: null,
    success: false,
    message: null,
    error: null,
  });

  // Load MAM token from localStorage on mount
  useEffect(() => {
    const storedToken = localStorage.getItem("mam_token");
    if (storedToken) {
      setMamTokenState(storedToken);
    }
  }, []);

  const triggerKeepalive = useCallback(async () => {
    if (!mamToken) {
      return;
    }

    try {
      const response = await fetch("/api/mam-keepalive", {
        method: "POST",
        headers: {
          "x-mam-token": mamToken,
        },
      });

      const data = await response.json();

      setKeepaliveStatus({
        lastCheck: new Date().toISOString(),
        success: data.success,
        message: data.message || null,
        error: data.error || null,
      });

      if (data.success) {
        console.log("MAM session keepalive successful:", data.message);
      } else {
        console.warn("MAM session keepalive failed:", data.error);
      }
    } catch (error) {
      console.error("MAM keepalive request failed:", error);
      setKeepaliveStatus({
        lastCheck: new Date().toISOString(),
        success: false,
        message: null,
        error: error instanceof Error ? error.message : "Network error",
      });
    }
  }, [mamToken]);

  // Run keepalive when token changes and periodically
  useEffect(() => {
    if (!mamToken) {
      return;
    }

    // Run immediately when token is set
    triggerKeepalive();

    // Set up periodic keepalive (every 55 minutes)
    const interval = setInterval(triggerKeepalive, KEEPALIVE_INTERVAL);

    return () => clearInterval(interval);
  }, [mamToken, triggerKeepalive]);

  const setMamToken = (token: string) => {
    setMamTokenState(token);
    localStorage.setItem("mam_token", token);
  };

  const clearMamToken = () => {
    setMamTokenState("");
    localStorage.removeItem("mam_token");
    setKeepaliveStatus({
      lastCheck: null,
      success: false,
      message: null,
      error: null,
    });
  };

  return (
    <SettingsContext.Provider value={{
      mamToken,
      setMamToken,
      clearMamToken,
      keepaliveStatus,
      triggerKeepalive
    }}>
      {children}
    </SettingsContext.Provider>
  );
};
