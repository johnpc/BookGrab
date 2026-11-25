import { describe, expect, it } from "vitest";
import {
  grabReducer,
  initialGrabMap,
  isGrabTerminal,
  selectGrab,
  selectPersistedGrabs,
} from "@/state/grab";

describe("grabReducer", () => {
  it("idle → sending → added", () => {
    let m = grabReducer(initialGrabMap, { type: "GRAB_STARTED", bookId: "1" });
    expect(selectGrab(m, "1")).toEqual({ status: "sending" });
    m = grabReducer(m, { type: "GRAB_SUCCEEDED", bookId: "1", duplicate: false, at: "2026-01-01T00:00:00.000Z" });
    expect(selectGrab(m, "1")).toEqual({ status: "added", at: "2026-01-01T00:00:00.000Z" });
    expect(isGrabTerminal(selectGrab(m, "1"))).toBe(true);
  });

  it("reports duplicates distinctly", () => {
    const m = grabReducer(initialGrabMap, { type: "GRAB_SUCCEEDED", bookId: "1", duplicate: true, at: "t" });
    expect(selectGrab(m, "1").status).toBe("duplicate");
  });

  it("error can be reset back to idle", () => {
    let m = grabReducer(initialGrabMap, { type: "GRAB_FAILED", bookId: "1", message: "nope" });
    expect(selectGrab(m, "1")).toEqual({ status: "error", message: "nope" });
    m = grabReducer(m, { type: "GRAB_RESET", bookId: "1" });
    expect(selectGrab(m, "1")).toEqual({ status: "idle" });
    expect(grabReducer(m, { type: "GRAB_RESET", bookId: "missing" })).toBe(m);
  });

  it("hydration never overwrites live state", () => {
    let m = grabReducer(initialGrabMap, { type: "GRAB_STARTED", bookId: "1" });
    m = grabReducer(m, { type: "GRABS_HYDRATED", added: { "1": "old", "2": "t2" } });
    expect(selectGrab(m, "1").status).toBe("sending");
    expect(selectGrab(m, "2")).toEqual({ status: "added", at: "t2" });
  });

  it("persists only terminal successes", () => {
    let m = grabReducer(initialGrabMap, { type: "GRAB_SUCCEEDED", bookId: "a", duplicate: false, at: "1" });
    m = grabReducer(m, { type: "GRAB_SUCCEEDED", bookId: "b", duplicate: true, at: "2" });
    m = grabReducer(m, { type: "GRAB_FAILED", bookId: "c", message: "x" });
    m = grabReducer(m, { type: "GRAB_STARTED", bookId: "d" });
    expect(selectPersistedGrabs(m)).toEqual({ a: "1", b: "2" });
  });
});
