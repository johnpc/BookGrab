/**
 * Explicit state machine for the MAM session a user configured in Settings.
 *
 *   unknown ──CHECK_STARTED──▶ checking ──CHECK_SUCCEEDED──▶ active
 *                                  └──────CHECK_FAILED─────▶ error
 *   any ──TOKEN_CLEARED──▶ unknown
 */

export type SessionState =
  | { status: "unknown" }
  | { status: "checking"; since: string }
  | { status: "active"; checkedAt: string; message: string }
  | { status: "error"; checkedAt: string; message: string; hint?: string };

export type SessionEvent =
  | { type: "CHECK_STARTED"; at: string }
  | { type: "CHECK_SUCCEEDED"; at: string; message: string }
  | { type: "CHECK_FAILED"; at: string; message: string; hint?: string }
  | { type: "TOKEN_CLEARED" };

export const initialSessionState: SessionState = { status: "unknown" };

export function sessionReducer(
  state: SessionState,
  event: SessionEvent,
): SessionState {
  switch (event.type) {
    case "CHECK_STARTED":
      return { status: "checking", since: event.at };
    case "CHECK_SUCCEEDED":
      return { status: "active", checkedAt: event.at, message: event.message };
    case "CHECK_FAILED":
      return {
        status: "error",
        checkedAt: event.at,
        message: event.message,
        hint: event.hint,
      };
    case "TOKEN_CLEARED":
      return initialSessionState;
  }
}
