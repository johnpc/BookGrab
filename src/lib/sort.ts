import type { Book } from "@/types";
import type { SortKey } from "@/state/search";

const UNIT_BYTES: Record<string, number> = {
  B: 1,
  KB: 1e3,
  MB: 1e6,
  GB: 1e9,
  TB: 1e12,
  KIB: 1024,
  MIB: 1024 ** 2,
  GIB: 1024 ** 3,
  TIB: 1024 ** 4,
};

/**
 * Parse a MAM size string such as "881.8 MiB", "1.0 GiB", "670.7 KiB" or
 * "1,015.2 MiB" into bytes. Unknown input sorts as 0.
 */
export function parseSizeToBytes(size: string | null | undefined): number {
  if (!size) return 0;
  const match = size.trim().match(/^([\d.,]+)\s*([KMGT]i?B|B)$/i);
  if (!match) return 0;
  const value = parseFloat(match[1].replace(/,/g, ""));
  const unit = match[2].toUpperCase();
  const multiplier = UNIT_BYTES[unit];
  if (!Number.isFinite(value) || multiplier === undefined) return 0;
  return value * multiplier;
}

/** MAM timestamps are "YYYY-MM-DD HH:mm:ss" in UTC; treat them as such. */
export function parseAddedToMillis(added: string | null | undefined): number {
  if (!added) return 0;
  const iso = added.includes("T") ? added : added.replace(" ", "T") + "Z";
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : 0;
}

const collator = new Intl.Collator(undefined, {
  sensitivity: "base",
  numeric: true,
});

export function compareBooks(a: Book, b: Book, sort: SortKey): number {
  switch (sort) {
    case "seeds":
      return b.seeders - a.seeders || b.completed - a.completed;
    case "date":
      return parseAddedToMillis(b.added) - parseAddedToMillis(a.added);
    case "size":
      return parseSizeToBytes(b.size) - parseSizeToBytes(a.size);
    case "name":
      return collator.compare(a.title, b.title) || b.seeders - a.seeders;
    case "times_completed":
      return b.completed - a.completed || b.seeders - a.seeders;
  }
}

/** Stable sort that never mutates the input. */
export function sortBooks(books: readonly Book[], sort: SortKey): Book[] {
  return books
    .map((book, index) => ({ book, index }))
    .sort((x, y) => compareBooks(x.book, y.book, sort) || x.index - y.index)
    .map(({ book }) => book);
}
