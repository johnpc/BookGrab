"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

interface SettingsContextType {
  mamToken: string;
  setMamToken: (token: string) => void;
  clearMamToken: () => void;
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

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [mamToken, setMamTokenState] = useState<string>("");

  // Load MAM token from localStorage on mount
  useEffect(() => {
    const storedToken = localStorage.getItem("mam_token");
    if (storedToken) {
      setMamTokenState(storedToken);
    }
  }, []);

  const setMamToken = (token: string) => {
    setMamTokenState(token);
    localStorage.setItem("mam_token", token);
  };

  const clearMamToken = () => {
    setMamTokenState("");
    localStorage.removeItem("mam_token");
  };

  return (
    <SettingsContext.Provider value={{ mamToken, setMamToken, clearMamToken }}>
      {children}
    </SettingsContext.Provider>
  );
};
