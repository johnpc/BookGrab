import { describe, expect, it } from "vitest";
import { initialSessionState, sessionReducer } from "@/state/session";

describe("sessionReducer", () => {
  it("unknown → checking → active", () => {
    let s = sessionReducer(initialSessionState, { type: "CHECK_STARTED", at: "t1" });
    expect(s).toEqual({ status: "checking", since: "t1" });
    s = sessionReducer(s, { type: "CHECK_SUCCEEDED", at: "t2", message: "No change" });
    expect(s).toEqual({ status: "active", checkedAt: "t2", message: "No change" });
  });
  it("records failures with hints and clears on token removal", () => {
    let s = sessionReducer(initialSessionState, { type: "CHECK_FAILED", at: "t", message: "bad", hint: "fix it" });
    expect(s).toMatchObject({ status: "error", hint: "fix it" });
    s = sessionReducer(s, { type: "TOKEN_CLEARED" });
    expect(s).toBe(initialSessionState);
  });
});
