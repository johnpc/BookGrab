"use client";

import { useEffect } from "react";

/** Registers the service worker; the worker itself handles updates (see public/sw.js). */
export default function PWAInstaller() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.warn("Service worker registration failed:", error);
    });
  }, []);

  return null;
}
