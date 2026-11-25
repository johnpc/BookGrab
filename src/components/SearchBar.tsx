"use client";

import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { isStringArray, parseJson, STORAGE_KEYS, useStoredString, writeJson, writeString } from "@/lib/storage";
import { ClockIcon, CloseIcon, SearchIcon } from "./icons";

interface SearchBarProps {
  /** Query currently applied (from the URL); keeps the field in sync on back/forward. */
  value: string;
  onSearch: (query: string) => void;
  isFetching: boolean;
}

const MAX_RECENT = 5;

export default function SearchBar({ value, onSearch, isFetching }: SearchBarProps) {
  const [query, setQuery] = useState(value);
  const [appliedValue, setAppliedValue] = useState(value);
  const [showRecent, setShowRecent] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const listId = useId();

  // Keep the field in sync when the applied query changes from outside
  // (deep link, back/forward, example pill). Derived during render, per
  // https://react.dev/learn/you-might-not-need-an-effect. The URL catching up
  // with what this field just submitted is not an outside change, so it must
  // not clobber anything typed in the meantime.
  const [lastSubmitted, setLastSubmitted] = useState<string | null>(null);
  if (value !== appliedValue) {
    setAppliedValue(value);
    if (value !== lastSubmitted) setQuery(value);
  }

  const storedRecent = useStoredString(STORAGE_KEYS.recentSearches);
  const recent = useMemo(() => parseJson(storedRecent, isStringArray) ?? [], [storedRecent]);

  // Close the dropdown on outside click or Escape.
  useEffect(() => {
    if (!showRecent) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setShowRecent(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowRecent(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [showRecent]);

  const submit = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    const updated = [trimmed, ...recent.filter((s) => s !== trimmed)].slice(0, MAX_RECENT);
    writeJson(STORAGE_KEYS.recentSearches, updated);
    setShowRecent(false);
    setQuery(trimmed);
    setLastSubmitted(trimmed);
    onSearch(trimmed);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    submit(query);
  };

  const clearRecent = () => {
    writeString(STORAGE_KEYS.recentSearches, null);
    setShowRecent(false);
  };

  return (
    <div className="search" ref={rootRef}>
      <form
        className="search__row"
        role="search"
        onSubmit={handleSubmit}
        data-testid="search-form"
      >
        <div className="search__field">
          <label htmlFor={inputId} className="visually-hidden">
            Search for books, authors, or series
          </label>
          <span className="search__icon">
            <SearchIcon />
          </span>
          <input
            id={inputId}
            ref={inputRef}
            className="search__input"
            type="search"
            name="q"
            autoComplete="off"
            enterKeyHint="search"
            placeholder="Search for books, authors, or series…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => recent.length > 0 && setShowRecent(true)}
            data-testid="search-input"
          />
          {query && (
            <button
              type="button"
              className="search__clear"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              aria-label="Clear search text"
              data-testid="search-clear"
            >
              <CloseIcon size={16} />
            </button>
          )}
        </div>
        <button
          type="submit"
          className="search__submit"
          data-testid="search-submit"
          aria-busy={isFetching}
        >
          Search
        </button>
      </form>

      {showRecent && recent.length > 0 && (
        <div className="recent" data-testid="recent-searches">
          <div className="recent__header">
            <span>Recent searches</span>
            <button type="button" className="recent__clear" onClick={clearRecent}>
              Clear all
            </button>
          </div>
          <ul className="recent__list" id={listId}>
            {recent.map((item) => (
              <li key={item}>
                <button
                  type="button"
                  className="recent__item"
                  onClick={() => submit(item)}
                >
                  <ClockIcon />
                  <span>{item}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
