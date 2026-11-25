"use client";

import { SearchIcon } from "./icons";

interface ErrorBannerProps {
  title: string;
  message?: string;
  hint?: string;
  action?: { label: string; onClick: () => void };
  tone?: "error" | "warning";
}

export function ErrorBanner({ title, message, hint, action, tone = "error" }: ErrorBannerProps) {
  return (
    <div className={`banner banner--${tone}`} role="alert" data-testid="error-banner">
      <div className="banner__body">
        <div className="banner__title">{title}</div>
        {message && <div>{message}</div>}
        {hint && <div className="banner__hint">{hint}</div>}
      </div>
      {action && (
        <button
          type="button"
          className="banner__action"
          onClick={action.onClick}
          data-testid="error-action"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

const EXAMPLES = ["Project Hail Mary", "Brandon Sanderson", "Discworld", "Ray Porter"];

export function WelcomeState({ onExample }: { onExample: (query: string) => void }) {
  return (
    <div className="empty" data-testid="welcome-state">
      <div className="empty__icon">
        <SearchIcon size={30} />
      </div>
      <h2 className="empty__title">Discover your next read</h2>
      <p className="empty__text">
        Search MyAnonyMouse for ebooks and audiobooks by title, author, narrator or series,
        then send them straight to Transmission.
      </p>
      <div className="empty__examples">
        {EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            className="pill"
            onClick={() => onExample(example)}
          >
            {example}
          </button>
        ))}
      </div>
    </div>
  );
}

export function NoResultsState({
  query,
  englishOnly,
  onShowAllLanguages,
}: {
  query: string;
  englishOnly: boolean;
  onShowAllLanguages: () => void;
}) {
  return (
    <div className="empty" data-testid="empty-state">
      <div className="empty__icon" aria-hidden="true">
        📚
      </div>
      <h2 className="empty__title">Nothing found for “{query}”</h2>
      <p className="empty__text">
        Try fewer words, check the spelling, or search by author instead.
        {englishOnly && " Results are limited to English right now."}
      </p>
      {englishOnly && (
        <div className="empty__examples">
          <button type="button" className="pill" onClick={onShowAllLanguages}>
            Include all languages
          </button>
        </div>
      )}
    </div>
  );
}
