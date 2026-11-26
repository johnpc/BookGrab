export type BookCategory = "audiobook" | "ebook";

export interface Book {
  id: string;
  title: string;
  author: string;
  /** Audiobooks only. */
  narrator?: string;
  /** File type(s) as reported by MAM, e.g. "epub mobi" or "m4b". */
  format: string;
  /** Audiobooks only, parsed from the description when present. */
  length?: string;
  torrentLink: string;
  category: BookCategory;
  /** Human-readable size as reported by MAM, e.g. "881.8 MiB". */
  size: string | null;
  seeders: number;
  leechers: number;
  /** MAM "added" timestamp, "YYYY-MM-DD HH:mm:ss" (UTC). */
  added: string | null;
  tags: string | null;
  /** Times snatched. */
  completed: number;
  /** MAM language id (1 = English). */
  language?: number;
  /** MAM language code, e.g. "ENG". */
  langCode?: string;
}

export interface SearchResponse {
  books: Book[];
  hasMore: boolean;
  totalResults: number;
}

/** Stable machine-readable error codes returned by /api/* routes. */
export type ApiErrorCode =
  | "BAD_REQUEST"
  | "MAM_NOT_CONFIGURED"
  | "MAM_AUTH"
  | "MAM_UPSTREAM"
  | "TRANSMISSION_UPSTREAM"
  | "INTERNAL";

export interface ApiError {
  error: string;
  code: ApiErrorCode;
  hint?: string;
}

export interface GrabResponse {
  success: true;
  message: string;
  /** True when Transmission already had this torrent. */
  duplicate: boolean;
}

export interface KeepaliveResponse {
  success: boolean;
  message: string;
  rotated: boolean;
  hint?: string;
  timestamp: string;
}

export interface StatusResponse {
  ok: true;
  version: string;
  mamTokenConfigured: boolean;
  transmissionConfigured: boolean;
  keepalive: {
    at: string;
    success: boolean;
    message: string;
  } | null;
  /** Copy-on-complete: pending/copied/failed are torrents, `enabled` means a copy dir is set. */
  copy: {
    enabled: boolean;
    pending: number;
    copied: number;
    failed: number;
  };
}
