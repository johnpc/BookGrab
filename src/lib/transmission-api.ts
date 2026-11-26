import { getEnvVariable, getMamBaseUrl, getServerEnvVariables } from "./env";
import { AppError } from "./api-error";
import type { BookCategory } from "@/types";

export interface AddTorrentResult {
  /** True when Transmission already had this torrent. */
  duplicate: boolean;
  name?: string;
  hash?: string;
}

export interface TorrentProgress {
  hash: string;
  name: string;
  downloadDir: string;
  percentDone: number;
}

interface TransmissionRpcResponse {
  result?: string;
  arguments?: {
    "torrent-added"?: { id?: number; name?: string; hashString?: string };
    "torrent-duplicate"?: { id?: number; name?: string; hashString?: string };
    torrents?: { hashString: string; name: string; downloadDir: string; percentDone: number }[];
  };
}

/** Interpret a torrent-add RPC body. Pure, so it is unit-testable. */
export function interpretTorrentAdd(body: TransmissionRpcResponse): AddTorrentResult {
  if (body.result !== "success") {
    throw new AppError(
      "TRANSMISSION_UPSTREAM",
      `Transmission refused the torrent: ${body.result ?? "unknown error"}`,
    );
  }
  const duplicate = body.arguments?.["torrent-duplicate"];
  if (duplicate) return { duplicate: true, name: duplicate.name, hash: duplicate.hashString };
  const added = body.arguments?.["torrent-added"];
  return { duplicate: false, name: added?.name, hash: added?.hashString };
}

/** Only MAM download links may be forwarded, so the server cannot be used as a generic torrent adder. */
export function isAllowedTorrentUrl(torrentUrl: string, mamBaseUrl: string): boolean {
  try {
    const target = new URL(torrentUrl);
    const base = new URL(mamBaseUrl);
    return (
      target.protocol === base.protocol &&
      target.host === base.host &&
      target.pathname.startsWith("/tor/download.php/")
    );
  } catch {
    return false;
  }
}

export async function addTorrent(
  torrentUrl: string,
  category: BookCategory,
): Promise<AddTorrentResult> {
  const { TRANSMISSION_URL, AUDIOBOOK_DESTINATION_PATH, EBOOK_DESTINATION_PATH } =
    getServerEnvVariables();

  if (!isAllowedTorrentUrl(torrentUrl, getMamBaseUrl())) {
    throw new AppError("BAD_REQUEST", "Only MyAnonyMouse download links can be added.");
  }

  const downloadDir =
    category === "audiobook" ? AUDIOBOOK_DESTINATION_PATH : EBOOK_DESTINATION_PATH;

  const payload = {
    method: "torrent-add",
    arguments: {
      filename: torrentUrl,
      "download-dir": downloadDir,
      paused: false,
    },
  };

  return interpretTorrentAdd(await transmissionRpc(TRANSMISSION_URL, payload));
}

/** Torrents Transmission still knows about; hashes it no longer has are simply absent. */
export async function getTorrentProgress(hashes: string[]): Promise<TorrentProgress[]> {
  const body = await transmissionRpc(getEnvVariable("TRANSMISSION_URL"), {
    method: "torrent-get",
    arguments: { ids: hashes, fields: ["hashString", "name", "downloadDir", "percentDone"] },
  });
  if (body.result !== "success") {
    throw new AppError(
      "TRANSMISSION_UPSTREAM",
      `Transmission refused torrent-get: ${body.result ?? "unknown error"}`,
    );
  }
  return (body.arguments?.torrents ?? []).map((t) => ({
    hash: t.hashString,
    name: t.name,
    downloadDir: t.downloadDir,
    percentDone: t.percentDone,
  }));
}

async function transmissionRpc(
  url: string,
  payload: Record<string, unknown>,
): Promise<TransmissionRpcResponse> {
  let response: Response;
  try {
    // First attempt without a session id; Transmission answers 409 with the id to use.
    response = await makeTransmissionRequest(url, payload);
    if (response.status === 409) {
      const sessionId = response.headers.get("X-Transmission-Session-Id");
      if (!sessionId) {
        throw new AppError("TRANSMISSION_UPSTREAM", "Transmission did not provide a session id.");
      }
      response = await makeTransmissionRequest(url, payload, sessionId);
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("TRANSMISSION_UPSTREAM", "Could not reach Transmission.", {
      cause: error,
    });
  }

  if (!response.ok) {
    throw new AppError(
      "TRANSMISSION_UPSTREAM",
      `Transmission returned ${response.status} ${response.statusText}`.trim(),
    );
  }

  return (await response.json()) as TransmissionRpcResponse;
}

async function makeTransmissionRequest(
  url: string,
  payload: Record<string, unknown>,
  sessionId?: string,
): Promise<Response> {
  const body = JSON.stringify(payload);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body).toString(),
  };
  if (sessionId) headers["X-Transmission-Session-Id"] = sessionId;

  return fetch(url, { method: "POST", headers, body, cache: "no-store" });
}
