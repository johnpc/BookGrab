"use client";

import type { Book } from "@/types";
import { selectGrab, type GrabMap } from "@/state/grab";
import BookCard from "./BookCard";

interface BookListProps {
  books: Book[];
  grabs: GrabMap;
  onGrab: (book: Book) => void;
  onRetry: (bookId: string) => void;
  mamBaseUrl: string;
}

export function BookList({ books, grabs, onGrab, onRetry, mamBaseUrl }: BookListProps) {
  return (
    <div className="grid" data-testid="results">
      {books.map((book) => (
        <BookCard
          key={book.id}
          book={book}
          grab={selectGrab(grabs, book.id)}
          onGrab={onGrab}
          onRetry={onRetry}
          mamBaseUrl={mamBaseUrl}
        />
      ))}
    </div>
  );
}

export function BookListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid" aria-hidden="true" data-testid="results-skeleton">
      {Array.from({ length: count }, (_, i) => (
        <div className="card" key={i}>
          <div className="card__badges">
            <span className="skeleton" style={{ width: 80, height: 22 }} />
            <span className="skeleton" style={{ width: 48, height: 22 }} />
          </div>
          <div className="skeleton" style={{ width: "70%", height: 20 }} />
          <div className="skeleton" style={{ width: "45%", height: 14 }} />
          <div className="stats">
            <span className="skeleton" style={{ width: 56, height: 36 }} />
            <span className="skeleton" style={{ width: 56, height: 36 }} />
            <span className="skeleton" style={{ width: 56, height: 36 }} />
          </div>
          <div className="skeleton" style={{ height: 46, borderRadius: 8 }} />
        </div>
      ))}
    </div>
  );
}
