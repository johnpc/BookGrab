"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import AppHeader from "./AppHeader";
import SearchBar from "./SearchBar";
import ResultsToolbar from "./ResultsToolbar";
import SearchStatus from "./SearchStatus";
import Pagination from "./Pagination";
import SettingsModal from "./SettingsModal";
import { BookList, BookListSkeleton } from "./BookList";
import { ErrorBanner, NoResultsState, WelcomeState } from "./Banners";
import { useSettings } from "@/contexts/SettingsContext";
import { MAX_RESULTS, useBookSearch } from "@/hooks/useBookSearch";
import { useGrabs } from "@/hooks/useGrabs";
import { sortBooks } from "@/lib/sort";
import {
  isLanguageFilter,
  isSortKey,
  isTypeFilter,
  selectBooks,
  selectIsFetching,
  type LanguageFilter,
  type SortKey,
  type TypeFilter,
} from "@/state/search";

const PAGE_SIZE = 20;

interface UrlState {
  q: string;
  sort: SortKey;
  type: TypeFilter;
  /** null = not in URL; fall back to the saved preference. */
  lang: LanguageFilter | null;
  page: number;
}

/**
 * The URL is the single source of truth for what is being searched and how it
 * is shown: /?q=dune&sort=seeds&type=audiobook&lang=en&page=2. Deep links,
 * refresh and back/forward all just work, and an agent can drive the app by URL.
 */
export default function HomeClient({ mamBaseUrl }: { mamBaseUrl: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { mamToken, language: savedLanguage, setLanguage: saveLanguage, hydrated } = useSettings();
  const { state, search, reset } = useBookSearch(mamToken);
  const { grabs, grab, reset: resetGrab } = useGrabs();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const url = useMemo<UrlState>(() => {
    const sort = searchParams.get("sort");
    const type = searchParams.get("type");
    const lang = searchParams.get("lang");
    const page = parseInt(searchParams.get("page") ?? "1", 10);
    return {
      q: searchParams.get("q")?.trim() ?? "",
      sort: isSortKey(sort) ? sort : "seeds",
      type: isTypeFilter(type) ? type : "all",
      lang: isLanguageFilter(lang) ? lang : null,
      page: Number.isFinite(page) && page > 0 ? page : 1,
    };
  }, [searchParams]);

  const language: LanguageFilter = url.lang ?? savedLanguage;

  // URL updates use the native History API (which the App Router syncs with
  // useSearchParams) instead of router.replace: it is synchronous, so rapid
  // successive updates build on the real current URL and none is coalesced away.
  const updateUrl = useCallback(
    (patch: Partial<Record<keyof UrlState, string | number | null>>) => {
      const next = new URLSearchParams(window.location.search);
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === "" || value === undefined) next.delete(key);
        else next.set(key, String(value));
      }
      // Defaults stay out of the URL so links remain short.
      if (next.get("sort") === "seeds") next.delete("sort");
      if (next.get("type") === "all") next.delete("type");
      if (next.get("page") === "1") next.delete("page");
      const query = next.toString();
      window.history.replaceState(null, "", query ? `${pathname}?${query}` : pathname);
    },
    [pathname],
  );

  // Run the search whenever the query or language in the URL changes. Sort and
  // type are applied client-side over the already-loaded results, except when
  // the result cap was hit, where the server order decides what we have.
  const lastFetchRef = useRef<{ q: string; lang: LanguageFilter; sort: SortKey; token: string } | null>(
    null,
  );
  useEffect(() => {
    if (!hydrated) return;
    if (!url.q) {
      lastFetchRef.current = null;
      reset();
      return;
    }
    const last = lastFetchRef.current;
    const truncated = state.status === "ready" && state.truncated;
    const needsFetch =
      !last ||
      last.q !== url.q ||
      last.lang !== language ||
      last.token !== mamToken ||
      (truncated && last.sort !== url.sort);
    if (!needsFetch) return;
    lastFetchRef.current = { q: url.q, lang: language, sort: url.sort, token: mamToken };
    search({ query: url.q, sort: url.sort, language });
    // `state` is intentionally not a dependency: it changes on every page received.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, url.q, url.sort, language, mamToken, search, reset]);

  const books = selectBooks(state);
  const isFetching = selectIsFetching(state);

  const counts = useMemo(
    () => ({
      all: books.length,
      ebook: books.filter((b) => b.category === "ebook").length,
      audiobook: books.filter((b) => b.category === "audiobook").length,
    }),
    [books],
  );

  const visibleBooks = useMemo(() => {
    const filtered = url.type === "all" ? books : books.filter((b) => b.category === url.type);
    return sortBooks(filtered, url.sort);
  }, [books, url.type, url.sort]);

  const pageCount = Math.max(1, Math.ceil(visibleBooks.length / PAGE_SIZE));
  const page = Math.min(url.page, pageCount);
  const pageBooks = visibleBooks.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // User-initiated searches start immediately (skeleton on the same click)
  // and the URL follows; the effect above then sees nothing left to fetch.
  const runSearch = (query: string, lang: LanguageFilter) => {
    lastFetchRef.current = { q: query, lang, sort: url.sort, token: mamToken };
    search({ query, sort: url.sort, language: lang });
  };
  const handleSearch = (query: string) => {
    runSearch(query, language);
    updateUrl({ q: query, page: null });
  };
  const handleHome = () => window.history.replaceState(null, "", pathname);
  const handleLanguage = (next: LanguageFilter) => {
    saveLanguage(next);
    if (url.q) runSearch(url.q, next);
    updateUrl({ lang: next, page: null });
  };
  const handlePage = (next: number) => {
    updateUrl({ page: next });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const showToolbar = state.status !== "idle";
  const errorState = state.status === "error" ? state : null;

  return (
    <div className="app" data-search-status={state.status}>
      <AppHeader onOpenSettings={() => setIsSettingsOpen(true)} onHome={handleHome} />

      <section className="search-panel" aria-label="Search">
        <div className="container">
          <SearchBar value={url.q} onSearch={handleSearch} isFetching={isFetching} />
          {showToolbar && (
            <ResultsToolbar
              sort={url.sort}
              onSortChange={(sort) => updateUrl({ sort, page: null })}
              type={url.type}
              onTypeChange={(type) => updateUrl({ type, page: null })}
              language={language}
              onLanguageChange={handleLanguage}
              counts={counts}
            />
          )}
        </div>
      </section>

      <main className="main" id="main">
        <div className="container">
          {state.status === "idle" ? (
            <WelcomeState onExample={handleSearch} />
          ) : (
            <>
              <SearchStatus
                state={state}
                visibleCount={visibleBooks.length}
                page={page}
                pageCount={pageCount}
                pageSize={PAGE_SIZE}
                maxResults={MAX_RESULTS}
              />

              {errorState && (
                <ErrorBanner
                  title={errorState.books.length ? "Some results could not be loaded" : "Search failed"}
                  message={errorState.message}
                  hint={
                    errorState.code === "MAM_AUTH" || errorState.code === "MAM_NOT_CONFIGURED"
                      ? "Check the MAM session token in Settings."
                      : undefined
                  }
                  action={
                    errorState.code === "MAM_AUTH" || errorState.code === "MAM_NOT_CONFIGURED"
                      ? { label: "Open settings", onClick: () => setIsSettingsOpen(true) }
                      : {
                          label: "Try again",
                          onClick: () => search({ query: url.q, sort: url.sort, language }),
                        }
                  }
                />
              )}

              {state.status === "searching" ? (
                <BookListSkeleton />
              ) : visibleBooks.length === 0 && !isFetching && !errorState ? (
                <NoResultsState
                  query={state.query}
                  englishOnly={language === "en"}
                  onShowAllLanguages={() => handleLanguage("all")}
                />
              ) : (
                <>
                  <BookList
                    books={pageBooks}
                    grabs={grabs}
                    onGrab={(book) => void grab(book)}
                    onRetry={resetGrab}
                    mamBaseUrl={mamBaseUrl}
                  />
                  {!isFetching && (
                    <Pagination page={page} pageCount={pageCount} onPageChange={handlePage} />
                  )}
                </>
              )}
            </>
          )}
        </div>
      </main>

      <footer className="app-footer">
        BookGrab · <a href="https://github.com/johnpc/BookGrab">Source</a>
      </footer>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
}
