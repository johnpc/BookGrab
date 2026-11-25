/**
 * Explicit state machine for sending one torrent to Transmission.
 *
 *   idle ──GRAB_STARTED──▶ sending ──GRAB_SUCCEEDED──▶ added | duplicate
 *                              └──GRAB_FAILED──▶ error ──GRAB_RESET──▶ idle
 *
 * State is keyed by book id and owned by the page, not the card, so paging or
 * filtering never forgets what was already sent. Terminal "added" states are
 * persisted so a later visit still shows the book as already grabbed.
 */

export type GrabState =
  | { status: "idle" }
  | { status: "sending" }
  | { status: "added"; at: string }
  | { status: "duplicate"; at: string }
  | { status: "error"; message: string };

export type GrabEvent =
  | { type: "GRAB_STARTED"; bookId: string }
  | { type: "GRAB_SUCCEEDED"; bookId: string; duplicate: boolean; at: string }
  | { type: "GRAB_FAILED"; bookId: string; message: string }
  | { type: "GRAB_RESET"; bookId: string }
  | { type: "GRABS_HYDRATED"; added: Record<string, string> };

export type GrabMap = Readonly<Record<string, GrabState>>;

export const IDLE_GRAB: GrabState = { status: "idle" };

export const initialGrabMap: GrabMap = {};

export function grabReducer(map: GrabMap, event: GrabEvent): GrabMap {
  switch (event.type) {
    case "GRAB_STARTED":
      return { ...map, [event.bookId]: { status: "sending" } };
    case "GRAB_SUCCEEDED":
      return {
        ...map,
        [event.bookId]: event.duplicate
          ? { status: "duplicate", at: event.at }
          : { status: "added", at: event.at },
      };
    case "GRAB_FAILED":
      return { ...map, [event.bookId]: { status: "error", message: event.message } };
    case "GRAB_RESET": {
      if (!(event.bookId in map)) return map;
      const next = { ...map };
      delete next[event.bookId];
      return next;
    }
    case "GRABS_HYDRATED": {
      const next: Record<string, GrabState> = { ...map };
      for (const [id, at] of Object.entries(event.added)) {
        if (!(id in next)) next[id] = { status: "added", at };
      }
      return next;
    }
  }
}

export const selectGrab = (map: GrabMap, bookId: string): GrabState =>
  map[bookId] ?? IDLE_GRAB;

/** Ids worth remembering across sessions (already in Transmission). */
export function selectPersistedGrabs(map: GrabMap): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [id, state] of Object.entries(map)) {
    if (state.status === "added" || state.status === "duplicate") out[id] = state.at;
  }
  return out;
}

export const isGrabTerminal = (state: GrabState): boolean =>
  state.status === "added" || state.status === "duplicate";
