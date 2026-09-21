/**
 * Keeps the MAM session bound to the current IP for as long as the container
 * runs. MAM cookies carry a 15 day Max-Age and rotate on each refresh, so a
 * twice-daily ping stays well inside that window without hammering them.
 */
const REFRESH_INTERVAL_MS = 12 * 60 * 60 * 1000;
const STARTUP_DELAY_MS = 30 * 1000;

export async function register() {
  // Only the Node.js server runtime should schedule work.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.MAM_KEEPALIVE_DISABLED === "true") return;

  const { refreshMamSession } = await import("./lib/mam-session");

  const runRefresh = async () => {
    try {
      const result = await refreshMamSession();
      if (result.success) {
        console.log(
          `MAM keepalive: ${result.message}${result.rotated ? " (token rotated and persisted)" : ""}`,
        );
      } else {
        console.error(
          `MAM keepalive failed: ${result.message}${result.hint ? ` - ${result.hint}` : ""}`,
        );
      }
    } catch (error) {
      console.error("MAM keepalive threw:", error);
    }
  };

  // Delay the first run so it cannot slow container startup.
  setTimeout(runRefresh, STARTUP_DELAY_MS).unref?.();
  setInterval(runRefresh, REFRESH_INTERVAL_MS).unref?.();
}
