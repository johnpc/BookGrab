"use client";

import { useState } from "react";
import type { Book } from "@/types";
import type { GrabState } from "@/state/grab";
import { CheckIcon, ChevronIcon, DownloadIcon } from "./icons";

interface BookCardProps {
  book: Book;
  grab: GrabState;
  onGrab: (book: Book) => void;
  onRetry: (bookId: string) => void;
  mamBaseUrl: string;
}

const formatDate = (added: string | null): string | null => {
  if (!added) return null;
  const iso = added.includes("T") ? added : added.replace(" ", "T") + "Z";
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return added;
  return new Date(ms).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const LANGUAGE_NAMES: Record<string, string> = {
  ENG: "English",
  SPA: "Spanish",
  GER: "German",
  FRE: "French",
  ITA: "Italian",
  DUT: "Dutch",
  POR: "Portuguese",
  RUS: "Russian",
  JPN: "Japanese",
  CHI: "Chinese",
  DAN: "Danish",
  SWE: "Swedish",
  NOR: "Norwegian",
  FIN: "Finnish",
  POL: "Polish",
};

export default function BookCard({ book, grab, onGrab, onRetry, mamBaseUrl }: BookCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const addedLabel = formatDate(book.added);
  const isAudiobook = book.category === "audiobook";
  const nonEnglish = book.langCode && book.langCode !== "ENG";

  let buttonLabel: React.ReactNode;
  let disabled = false;
  switch (grab.status) {
    case "idle":
      buttonLabel = (
        <>
          <DownloadIcon /> Download
        </>
      );
      break;
    case "sending":
      buttonLabel = (
        <>
          <span className="spinner" aria-hidden="true" /> Sending to Transmission…
        </>
      );
      disabled = true;
      break;
    case "added":
      buttonLabel = (
        <>
          <CheckIcon /> Added to Transmission
        </>
      );
      disabled = true;
      break;
    case "duplicate":
      buttonLabel = (
        <>
          <CheckIcon /> Already in Transmission
        </>
      );
      disabled = true;
      break;
    case "error":
      buttonLabel = "Retry download";
      break;
  }

  return (
    <article
      className="card"
      data-testid="book-card"
      data-book-id={book.id}
      data-category={book.category}
      data-lang={book.langCode ?? ""}
      data-grab-status={grab.status}
      aria-labelledby={`book-title-${book.id}`}
    >
      <div className="card__badges">
        <span className={`badge badge--${book.category}`}>
          {isAudiobook ? "Audiobook" : "Ebook"}
        </span>
        <span className="badge">{book.format.toUpperCase()}</span>
        {nonEnglish && (
          <span className="badge" data-testid="lang-badge">
            {LANGUAGE_NAMES[book.langCode!] ?? book.langCode}
          </span>
        )}
        {book.size && <span className="card__size">{book.size}</span>}
      </div>

      <h3 className="card__title" id={`book-title-${book.id}`}>
        <a
          href={`${mamBaseUrl}/t/${book.id}`}
          target="_blank"
          rel="noopener noreferrer"
          title="Open on MyAnonyMouse"
        >
          {book.title}
        </a>
      </h3>

      <p className="card__meta">
        by <strong>{book.author}</strong>
      </p>
      {isAudiobook && book.narrator && (
        <p className="card__meta card__meta--small">Narrated by {book.narrator}</p>
      )}
      {book.length && <p className="card__meta card__meta--small">Duration {book.length}</p>}

      <div className="stats" aria-label="Swarm statistics">
        <div className="stat">
          <span className="stat__value stat__value--seed">{book.seeders.toLocaleString()}</span>
          <span className="stat__label">Seeders</span>
        </div>
        <div className="stat">
          <span className="stat__value stat__value--leech">{book.leechers.toLocaleString()}</span>
          <span className="stat__label">Leechers</span>
        </div>
        <div className="stat">
          <span className="stat__value">{book.completed.toLocaleString()}</span>
          <span className="stat__label">Downloads</span>
        </div>
      </div>

      {(addedLabel || book.tags) && (
        <>
          <button
            type="button"
            className="card__details-toggle"
            onClick={() => setShowDetails((v) => !v)}
            aria-expanded={showDetails}
            data-testid="details-toggle"
          >
            {showDetails ? "Hide details" : "More details"}
            <ChevronIcon
              style={{
                transform: showDetails ? "rotate(180deg)" : undefined,
                transition: "transform 150ms",
              }}
            />
          </button>
          {showDetails && (
            <div className="card__details" data-testid="details">
              {addedLabel && <div>Added {addedLabel}</div>}
              {book.tags && <div>Tags: {book.tags}</div>}
              {book.langCode && <div>Language: {LANGUAGE_NAMES[book.langCode] ?? book.langCode}</div>}
            </div>
          )}
        </>
      )}

      <div className="grab">
        <button
          type="button"
          className="grab__button"
          data-status={grab.status}
          data-testid="grab-button"
          disabled={disabled}
          onClick={() => {
            if (grab.status === "error") onRetry(book.id);
            onGrab(book);
          }}
        >
          {buttonLabel}
        </button>
        {grab.status === "error" && (
          <p className="grab__message grab__message--error" role="alert" data-testid="grab-message">
            {grab.message}
          </p>
        )}
      </div>
    </article>
  );
}
