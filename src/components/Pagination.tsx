"use client";

import { visiblePages } from "@/lib/pagination";

interface PaginationProps {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ page, pageCount, onPageChange }: PaginationProps) {
  if (pageCount <= 1) return null;
  const pages = visiblePages(page, pageCount);

  return (
    <nav className="pagination" aria-label="Pagination" data-testid="pagination">
      <button
        type="button"
        className="pagination__button"
        onClick={() => onPageChange(page - 1)}
        disabled={page === 1}
        data-testid="page-prev"
      >
        ← Previous
      </button>
      {pages.map((p, index) => {
        const gap = index > 0 && p - pages[index - 1] > 1;
        return (
          <span key={p} style={{ display: "contents" }}>
            {gap && (
              <span className="pagination__ellipsis" aria-hidden="true">
                …
              </span>
            )}
            <button
              type="button"
              className="pagination__button"
              aria-current={p === page ? "page" : undefined}
              aria-label={`Page ${p}`}
              onClick={() => onPageChange(p)}
            >
              {p}
            </button>
          </span>
        );
      })}
      <button
        type="button"
        className="pagination__button"
        onClick={() => onPageChange(page + 1)}
        disabled={page === pageCount}
        data-testid="page-next"
      >
        Next →
      </button>
    </nav>
  );
}
