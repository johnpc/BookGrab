import { describe, expect, it } from "vitest";
import { interpretTorrentAdd, isAllowedTorrentUrl } from "@/lib/transmission-api";
import { AppError } from "@/lib/api-error";

describe("interpretTorrentAdd", () => {
  it("recognises a fresh add", () => {
    expect(
      interpretTorrentAdd({ result: "success", arguments: { "torrent-added": { id: 1, name: "x" } } }),
    ).toEqual({ duplicate: false, name: "x" });
  });
  it("recognises a duplicate", () => {
    expect(
      interpretTorrentAdd({ result: "success", arguments: { "torrent-duplicate": { id: 1, name: "x" } } }),
    ).toEqual({ duplicate: true, name: "x" });
  });
  it("throws a typed error on failure", () => {
    expect(() => interpretTorrentAdd({ result: "unrecognized info" })).toThrowError(AppError);
    try {
      interpretTorrentAdd({ result: "unrecognized info" });
    } catch (e) {
      expect((e as AppError).code).toBe("TRANSMISSION_UPSTREAM");
      expect((e as AppError).message).toContain("unrecognized info");
    }
  });
});

describe("isAllowedTorrentUrl", () => {
  const base = "https://www.myanonamouse.net";
  it("accepts MAM download links", () => {
    expect(isAllowedTorrentUrl(`${base}/tor/download.php/abc?tid=1`, base)).toBe(true);
  });
  it("rejects other hosts, paths and garbage", () => {
    expect(isAllowedTorrentUrl("https://evil.test/tor/download.php/abc", base)).toBe(false);
    expect(isAllowedTorrentUrl(`${base}/t/123`, base)).toBe(false);
    expect(isAllowedTorrentUrl("not a url", base)).toBe(false);
    expect(isAllowedTorrentUrl("magnet:?xt=urn:btih:abc", base)).toBe(false);
  });
  it("follows the configured base (mock backend)", () => {
    expect(isAllowedTorrentUrl("http://127.0.0.1:4010/tor/download.php/x", "http://127.0.0.1:4010")).toBe(true);
  });
});
