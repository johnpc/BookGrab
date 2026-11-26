import { cp, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { getOptionalEnvVariable } from "./env";
import { getTorrentProgress } from "./transmission-api";
import type { BookCategory } from "@/types";

/**
 * Copies (never moves) finished downloads to AUDIOBOOK_COPY_PATH / EBOOK_COPY_PATH.
 *
 * Transmission keeps seeding from its own download dir; BookGrab only reads it.
 * Grabbed torrents are queued in a JSON file (route handlers and the
 * instrumentation poller may not share module state) and the queue is polled
 * until each torrent reaches 100%.
 */

const MAX_ATTEMPTS = 5;

export interface PendingCopy {
  hash: string;
  category: BookCategory;
  attempts: number;
}

interface CopyQueue {
  pending: PendingCopy[];
  copied: number;
  failed: number;
}

export interface CopyStatus {
  enabled: boolean;
  pending: number;
  copied: number;
  failed: number;
}

export const getCopyDir = (category: BookCategory): string | undefined =>
  getOptionalEnvVariable(category === "audiobook" ? "AUDIOBOOK_COPY_PATH" : "EBOOK_COPY_PATH");

export const isCopyEnabled = (): boolean =>
  Boolean(getCopyDir("audiobook") || getCopyDir("ebook"));

/** Parse `remote=local,remote2=local2`, longest remote prefix first. */
export function parsePathMap(raw: string | undefined): [string, string][] {
  const strip = (p: string) => (p.length > 1 ? p.replace(/\/+$/, "") : p);
  return (raw ?? "")
    .split(",")
    .map((pair) => pair.split("="))
    .filter((parts): parts is [string, string] => parts.length === 2 && parts.every((p) => p.trim()))
    .map(([from, to]): [string, string] => [strip(from.trim()), strip(to.trim())])
    .sort((a, b) => b[0].length - a[0].length);
}

/** Translate a path as Transmission sees it into the path BookGrab sees. */
export function toLocalPath(path: string, map: [string, string][]): string {
  for (const [from, to] of map) {
    if (path === from) return to;
    if (path.startsWith(from === "/" ? "/" : `${from}/`)) {
      return join(to, path.slice(from.length));
    }
  }
  return path;
}

/** Torrent names become path segments, so they must not escape the target dir. */
export const isSafeTorrentName = (name: string): boolean =>
  name.length > 0 && name !== "." && name !== ".." && basename(name) === name;

// ---------------------------------------------------------------------------
// Queue persistence
// ---------------------------------------------------------------------------
const queueFile = (): string =>
  getOptionalEnvVariable("COPY_QUEUE_FILE") ?? join(tmpdir(), "bookgrab-copy-queue.json");

const emptyQueue = (): CopyQueue => ({ pending: [], copied: 0, failed: 0 });

async function readQueue(): Promise<CopyQueue> {
  try {
    const parsed = JSON.parse(await readFile(queueFile(), "utf-8")) as Partial<CopyQueue>;
    return {
      pending: Array.isArray(parsed.pending) ? parsed.pending : [],
      copied: parsed.copied ?? 0,
      failed: parsed.failed ?? 0,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error("Copy queue unreadable, starting empty:", error);
    }
    return emptyQueue();
  }
}

const shared = globalThis as { __bookgrabCopyLock?: Promise<unknown>; __bookgrabCopyBusy?: boolean };

/** Serialises read-modify-write so a grab cannot be lost while a tick saves. */
function updateQueue(change: (queue: CopyQueue) => void): Promise<void> {
  const run = async () => {
    const queue = await readQueue();
    change(queue);
    const file = queueFile();
    await mkdir(dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    await writeFile(tmp, JSON.stringify(queue));
    await rename(tmp, file);
  };
  const next = (shared.__bookgrabCopyLock ?? Promise.resolve()).catch(() => undefined).then(run);
  shared.__bookgrabCopyLock = next;
  return next;
}

export async function enqueueCopy(hash: string | undefined, category: BookCategory): Promise<void> {
  if (!hash || !getCopyDir(category)) return;
  await updateQueue((queue) => {
    if (!queue.pending.some((p) => p.hash === hash)) {
      queue.pending.push({ hash, category, attempts: 0 });
    }
  });
}

export async function getCopyStatus(): Promise<CopyStatus> {
  const queue = await readQueue();
  return {
    enabled: isCopyEnabled(),
    pending: queue.pending.length,
    copied: queue.copied,
    failed: queue.failed,
  };
}

// ---------------------------------------------------------------------------
// Processing
// ---------------------------------------------------------------------------
async function copyOne(downloadDir: string, name: string, copyDir: string): Promise<void> {
  if (!isSafeTorrentName(name)) throw new Error(`Unsafe torrent name: ${name}`);
  const source = join(toLocalPath(downloadDir, parsePathMap(process.env.TRANSMISSION_PATH_MAP)), name);
  await mkdir(copyDir, { recursive: true });
  // force:false keeps anything already in the destination, so retries and restarts are harmless.
  await cp(source, join(copyDir, name), { recursive: true, force: false, errorOnExist: false });
}

/** One polling pass: copy every queued torrent that has finished downloading. */
export async function processCopyQueue(): Promise<void> {
  if (shared.__bookgrabCopyBusy) return;
  shared.__bookgrabCopyBusy = true;
  try {
    const { pending } = await readQueue();
    if (pending.length === 0) return;

    const torrents = new Map(
      (await getTorrentProgress(pending.map((p) => p.hash))).map((t) => [t.hash, t]),
    );

    const copied = new Set<string>();
    const dropped = new Set<string>();
    const retried = new Map<string, number>();

    for (const item of pending) {
      const torrent = torrents.get(item.hash);
      if (!torrent) {
        console.error(`Copy: torrent ${item.hash} is gone from Transmission, dropping it`);
        dropped.add(item.hash);
        continue;
      }
      if (torrent.percentDone < 1) continue;

      const copyDir = getCopyDir(item.category);
      if (!copyDir) {
        dropped.add(item.hash);
        continue;
      }
      try {
        await copyOne(torrent.downloadDir, torrent.name, copyDir);
        copied.add(item.hash);
        console.log(`Copy: copied "${torrent.name}" to ${copyDir}`);
      } catch (error) {
        const attempts = item.attempts + 1;
        console.error(`Copy: "${torrent.name}" failed (attempt ${attempts}/${MAX_ATTEMPTS}):`, error);
        if (attempts >= MAX_ATTEMPTS) dropped.add(item.hash);
        else retried.set(item.hash, attempts);
      }
    }

    await updateQueue((queue) => {
      queue.pending = queue.pending.filter((p) => !copied.has(p.hash) && !dropped.has(p.hash));
      for (const p of queue.pending) p.attempts = retried.get(p.hash) ?? p.attempts;
      queue.copied += copied.size;
      queue.failed += dropped.size;
    });
  } finally {
    shared.__bookgrabCopyBusy = false;
  }
}
