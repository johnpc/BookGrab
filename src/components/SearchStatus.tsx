"use client";

import type { SearchState } from "@/state/search";

interface SearchStatusProps {
  state: SearchState;
  /** Results after type filtering. */
  visibleCount: number;
  page: number;
  pageCount: number;
  pageSize: number;
  maxResults: number;
}

/**
 * One live region that narrates the search machine: searching → streaming
 * (with real progress) → ready / error. Screen readers get the same story the
 * eye does, and tests read data-status instead of guessing from text.
 */
export default function SearchStatus({
  state,
  visibleCount,
  page,
  pageCount,
  pageSize,
  maxResults,
}: SearchStatusProps) {
  if (state.status === "idle") return null;
  // A failed search with nothing loaded is fully described by the error banner.
  if (state.status === "error" && state.books.length === 0) return null;

  const loaded = "books" in state ? state.books.length : 0;
  const total = "total" in state ? state.total : 0;
  const first = visibleCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, visibleCount);

  let headline: string;
  let detail: string | null = null;
  let progress: number | null = null;

  switch (state.status) {
    case "searching":
      headline = `Searching MyAnonyMouse for “${state.query}”…`;
      break;
    case "streaming":
      headline = `Loading results for “${state.query}”`;
      detail = `${loaded} of ${Math.min(total, maxResults)} loaded`;
      progress = total > 0 ? Math.min(1, loaded / Math.min(total, maxResults)) : null;
      break;
    case "ready":
      if (visibleCount === 0) {
        headline = `No results for “${state.query}”`;
      } else {
        headline = `${visibleCount.toLocaleString()} result${visibleCount === 1 ? "" : "s"} for “${state.query}”`;
        detail =
          pageCount > 1
            ? `Showing ${first}–${last} · Page ${page} of ${pageCount}`
            : `Showing ${first}–${last}`;
      }
      if (state.truncated) {
        detail = `${detail ? detail + " · " : ""}Showing the first ${maxResults} of ${total.toLocaleString()} matches. Refine your search to see the rest.`;
      }
      break;
    case "error":
      headline = loaded > 0 ? `Partial results for “${state.query}”` : `Search failed`;
      detail = loaded > 0 ? `${loaded} loaded before the error` : null;
      break;
  }

  return (
    <div
      className="status"
      role="status"
      aria-live="polite"
      data-testid="search-status"
      data-status={state.status}
      data-loaded={loaded}
      data-total={total}
    >
      <div className="status__row">
        <span className="status__strong">{headline}</span>
        {detail && <span data-testid="search-status-detail">{detail}</span>}
      </div>
      {(state.status === "searching" || state.status === "streaming") && (
        <div
          className="progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress === null ? undefined : Math.round(progress * 100)}
          data-testid="search-progress"
        >
          <div
            className={`progress__bar${progress === null ? " progress__bar--indeterminate" : ""}`}
            style={progress === null ? undefined : { width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}
