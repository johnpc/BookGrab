"use client";

import { useId } from "react";
import {
  SORT_KEYS,
  SORT_LABELS,
  isSortKey,
  type LanguageFilter,
  type SortKey,
  type TypeFilter,
} from "@/state/search";

interface ResultsToolbarProps {
  sort: SortKey;
  onSortChange: (sort: SortKey) => void;
  type: TypeFilter;
  onTypeChange: (type: TypeFilter) => void;
  language: LanguageFilter;
  onLanguageChange: (language: LanguageFilter) => void;
  /** Result counts per type for the current language, shown on the segmented control. */
  counts: { all: number; ebook: number; audiobook: number };
}

const TYPE_LABELS: Record<TypeFilter, string> = {
  all: "All",
  ebook: "Ebooks",
  audiobook: "Audiobooks",
};

export default function ResultsToolbar({
  sort,
  onSortChange,
  type,
  onTypeChange,
  language,
  onLanguageChange,
  counts,
}: ResultsToolbarProps) {
  const sortId = useId();
  const englishOnly = language === "en";

  return (
    <div className="toolbar" data-testid="results-toolbar">
      <label htmlFor={sortId} className="visually-hidden">
        Sort results
      </label>
      <select
        id={sortId}
        className="select"
        value={sort}
        onChange={(event) => {
          if (isSortKey(event.target.value)) onSortChange(event.target.value);
        }}
        data-testid="sort-select"
      >
        {SORT_KEYS.map((key) => (
          <option key={key} value={key}>
            {SORT_LABELS[key]}
          </option>
        ))}
      </select>

      <div className="segmented" role="radiogroup" aria-label="Book type" data-testid="type-filter">
        {(["all", "ebook", "audiobook"] as const).map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={type === option}
            className="segmented__option"
            onClick={() => onTypeChange(option)}
            data-value={option}
          >
            {TYPE_LABELS[option]}
            {counts.all > 0 && (
              <span aria-hidden="true"> {counts[option]}</span>
            )}
          </button>
        ))}
      </div>

      <button
        type="button"
        className="chip-toggle"
        aria-pressed={englishOnly}
        onClick={() => onLanguageChange(englishOnly ? "all" : "en")}
        title={
          englishOnly
            ? "Showing English results only. Click to include every language."
            : "Showing every language. Click to show English only."
        }
        data-testid="lang-toggle"
      >
        <span className="chip-toggle__dot" aria-hidden="true" />
        {englishOnly ? "English only" : "All languages"}
      </button>
    </div>
  );
}
