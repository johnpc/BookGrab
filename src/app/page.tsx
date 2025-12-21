"use client";

import { useState } from "react";
import SearchBar from "@/components/SearchBar";
import BookList from "@/components/BookList";
import SettingsModal from "@/components/SettingsModal";
import { useSettings } from "@/contexts/SettingsContext";
import { Book } from "@/types";
import {
  Flex,
  Heading,
  Text,
  View,
  useTheme,
  Card,
  Button,
  SelectField,
} from "@aws-amplify/ui-react";

export default function Home() {
  const [books, setBooks] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [hasSearched, setHasSearched] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [currentQuery, setCurrentQuery] = useState("");
  const [sortType, setSortType] = useState("seeds");
  const [filterType, setFilterType] = useState<"all" | "ebook" | "audiobook">("all");
  const [totalResults, setTotalResults] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const { tokens } = useTheme();
  const { mamToken } = useSettings();

  const handleSearch = async (query: string, sort?: string) => {
    setIsLoading(true);
    setError(undefined);
    setHasSearched(true);
    setCurrentQuery(query);
    setCurrentPage(1);

    // Use the provided sort parameter or fall back to current sortType state
    const sortToUse = sort || sortType;

    try {
      const headers: HeadersInit = {};
      if (mamToken) {
        headers["x-mam-token"] = mamToken;
      }

      // First, get the initial results to know the total
      const firstResponse = await fetch(
        `/api/search?q=${encodeURIComponent(query)}&sort=${sortToUse}`,
        { headers },
      );
      const firstData = await firstResponse.json();

      if (!firstResponse.ok) {
        throw new Error(firstData.error || "Failed to search books");
      }

      const allBooks = [...(firstData.books || [])];
      const total = firstData.totalResults || 0;
      setTotalResults(total);

      // If there are more results, fetch them all in batches
      if (firstData.hasMore) {
        let currentStart = allBooks.length;
        let keepFetching = true;

        while (keepFetching && currentStart < total) {
          const response = await fetch(
            `/api/search?q=${encodeURIComponent(query)}&start=${currentStart}&sort=${sortToUse}`,
            { headers },
          );
          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || "Failed to load all results");
          }

          if (data.books && data.books.length > 0) {
            allBooks.push(...data.books);
            currentStart += data.books.length;
            keepFetching = data.hasMore || false;
          } else {
            keepFetching = false;
          }
        }
      }

      // Sort the combined results client-side to ensure proper ordering
      // The API may sort each page independently, so we need to sort the full result set
      allBooks.sort((a, b) => {
        switch (sortToUse) {
          case "seeds":
            return b.seeders - a.seeders;
          case "date":
            if (!a.added || !b.added) return 0;
            return new Date(b.added).getTime() - new Date(a.added).getTime();
          case "size":
            // Parse size strings like "1.5 GB" to bytes for comparison
            const parseSize = (sizeStr: string | null) => {
              if (!sizeStr) return 0;
              const match = sizeStr.match(/([\d.]+)\s*(GB|MB|KB)/i);
              if (!match) return 0;
              const value = parseFloat(match[1]);
              const unit = match[2].toUpperCase();
              if (unit === "GB") return value * 1024 * 1024 * 1024;
              if (unit === "MB") return value * 1024 * 1024;
              if (unit === "KB") return value * 1024;
              return value;
            };
            return parseSize(b.size) - parseSize(a.size);
          case "name":
            return a.title.localeCompare(b.title);
          case "times_completed":
            return b.completed - a.completed;
          default:
            return 0;
        }
      });

      console.log("Fetched and sorted", allBooks.length, "books with sort:", sortToUse);
      console.log("First 5 books seeders:", allBooks.slice(0, 5).map(b => ({ title: b.title, seeders: b.seeders })));

      setBooks(allBooks);

      if (firstData.error) {
        setError(firstData.error);
      }
    } catch (err) {
      console.error("Search error:", err);
      setError(
        err instanceof Error ? err.message : "An unknown error occurred",
      );
      setBooks([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter books by type
  const filteredBooks = filterType === "all"
    ? books
    : books.filter(book => book.category === filterType);

  // Calculate pagination
  const totalPages = Math.ceil(filteredBooks.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentBooks = filteredBooks.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSortChange = (newSort: string) => {
    console.log("Changing sort to:", newSort);
    setSortType(newSort);
    setCurrentPage(1);
    // Re-run search with new sort if we have a current query
    if (currentQuery && hasSearched) {
      console.log("Re-running search with sort:", newSort, "for query:", currentQuery);
      handleSearch(currentQuery, newSort);
    }
  };

  const handleFilterChange = (newFilter: "all" | "ebook" | "audiobook") => {
    setFilterType(newFilter);
    setCurrentPage(1);
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0f172a",
      color: "#e2e8f0"
    }}>
      {/* Mobile-First Header */}
      <header style={{
        background: "#1e293b",
        borderBottom: "1px solid #334155",
        position: "sticky",
        top: 0,
        zIndex: 50
      }}>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "12px 16px",
          maxWidth: "100%"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{
              width: "40px",
              height: "40px",
              background: "#3b82f6",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="22"
                height="22"
                fill="none"
                viewBox="0 0 24 24"
                stroke="white"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
            </div>
            <div>
              <div style={{
                fontSize: "20px",
                fontWeight: "700",
                color: "#f1f5f9",
                lineHeight: "1"
              }}>
                BookGrab
              </div>
              <div style={{
                fontSize: "11px",
                color: "#64748b",
                lineHeight: "1.4",
                marginTop: "2px"
              }}>
                Find & Download Books
              </div>
            </div>
          </div>

          <button
            onClick={() => setIsSettingsOpen(true)}
            style={{
              background: "transparent",
              border: "none",
              color: "#cbd5e1",
              padding: "8px",
              cursor: "pointer"
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </button>
        </div>
      </header>

      {/* Search Section */}
      <div style={{
        padding: "16px",
        background: "#1e293b"
      }}>
        <SearchBar onSearch={handleSearch} isLoading={isLoading} />

        {hasSearched && (
          <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
            <select
              value={sortType}
              onChange={(e) => handleSortChange(e.target.value)}
              style={{
                width: "100%",
                padding: "12px 16px",
                background: "#0f172a",
                border: "1px solid #334155",
                borderRadius: "8px",
                color: "#e2e8f0",
                fontSize: "14px",
                fontWeight: "500"
              }}
            >
              <option value="seeds">Most Seeders</option>
              <option value="date">Date Added</option>
              <option value="size">File Size</option>
              <option value="name">Name</option>
              <option value="times_completed">Most Snatched</option>
            </select>

            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={() => handleFilterChange("all")}
                style={{
                  flex: 1,
                  padding: "10px 16px",
                  background: filterType === "all" ? "#3b82f6" : "#0f172a",
                  border: "1px solid #334155",
                  borderRadius: "8px",
                  color: "#e2e8f0",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: "pointer"
                }}
              >
                All
              </button>
              <button
                onClick={() => handleFilterChange("ebook")}
                style={{
                  flex: 1,
                  padding: "10px 16px",
                  background: filterType === "ebook" ? "#3b82f6" : "#0f172a",
                  border: "1px solid #334155",
                  borderRadius: "8px",
                  color: "#e2e8f0",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: "pointer"
                }}
              >
                Ebooks
              </button>
              <button
                onClick={() => handleFilterChange("audiobook")}
                style={{
                  flex: 1,
                  padding: "10px 16px",
                  background: filterType === "audiobook" ? "#3b82f6" : "#0f172a",
                  border: "1px solid #334155",
                  borderRadius: "8px",
                  color: "#e2e8f0",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: "pointer"
                }}
              >
                Audiobooks
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div style={{
        padding: "16px",
        maxWidth: "100%",
        margin: "0 auto"
      }}>
        {hasSearched && (
          <>
            {books.length > 0 && !error && (
              <div style={{
                marginBottom: "16px",
                padding: "12px 16px",
                background: "#1e293b",
                borderRadius: "8px",
                border: "1px solid #334155"
              }}>
                <Text
                  fontSize="small"
                  color="#94a3b8"
                  fontWeight="medium"
                >
                  Showing {startIndex + 1}-{Math.min(endIndex, filteredBooks.length)} of {filteredBooks.length} results
                </Text>
                {totalPages > 1 && (
                  <Text fontSize="small" color="#64748b" style={{ marginTop: "4px" }}>
                    Page {currentPage} of {totalPages}
                  </Text>
                )}
              </div>
            )}
            <BookList books={currentBooks} isLoading={isLoading} error={error} />

            {/* Mobile-Friendly Pagination */}
            {totalPages > 1 && !isLoading && !error && (
              <div style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                marginTop: "24px",
                gap: "8px",
                flexWrap: "wrap",
                padding: "0 8px"
              }}>
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  style={{
                    padding: "12px 20px",
                    background: currentPage === 1 ? "#1e293b" : "#3b82f6",
                    border: "1px solid #334155",
                    borderRadius: "8px",
                    color: currentPage === 1 ? "#64748b" : "#ffffff",
                    cursor: currentPage === 1 ? "not-allowed" : "pointer",
                    fontWeight: "600",
                    fontSize: "14px",
                    opacity: currentPage === 1 ? 0.5 : 1
                  }}
                >
                  ← Previous
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((page) => {
                    return (
                      page === 1 ||
                      page === totalPages ||
                      (page >= currentPage - 1 && page <= currentPage + 1)
                    );
                  })
                  .map((page, index, array) => {
                    const showEllipsisBefore =
                      index > 0 && page - array[index - 1] > 1;

                    return (
                      <div key={page} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        {showEllipsisBefore && (
                          <Text color="#64748b">...</Text>
                        )}
                        <button
                          onClick={() => handlePageChange(page)}
                          style={{
                            padding: "12px 16px",
                            background: page === currentPage ? "#3b82f6" : "#1e293b",
                            border: "1px solid #334155",
                            borderRadius: "8px",
                            color: "#ffffff",
                            cursor: "pointer",
                            fontWeight: page === currentPage ? "700" : "500",
                            fontSize: "14px",
                            minWidth: "44px"
                          }}
                        >
                          {page}
                        </button>
                      </div>
                    );
                  })}

                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  style={{
                    padding: "12px 20px",
                    background: currentPage === totalPages ? "#1e293b" : "#3b82f6",
                    border: "1px solid #334155",
                    borderRadius: "8px",
                    color: currentPage === totalPages ? "#64748b" : "#ffffff",
                    cursor: currentPage === totalPages ? "not-allowed" : "pointer",
                    fontWeight: "600",
                    fontSize: "14px",
                    opacity: currentPage === totalPages ? 0.5 : 1
                  }}
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}

        {!hasSearched && !isLoading && (
          <div style={{
            textAlign: "center",
            padding: "60px 24px",
            maxWidth: "100%",
            margin: "40px auto"
          }}>
            <div style={{
              width: "64px",
              height: "64px",
              background: "#3b82f6",
              borderRadius: "16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 24px"
            }}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="32"
                height="32"
                fill="none"
                viewBox="0 0 24 24"
                stroke="white"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <Heading level={2} marginBottom="small" style={{ color: "#e5e7eb", fontSize: "24px", fontWeight: "700" }}>
              Discover Your Next Read
            </Heading>
            <Text style={{ color: "#94a3b8", fontSize: "14px", lineHeight: "1.6" }}>
              Search through thousands of books and audiobooks from MyAnonyMouse. Find your favorite titles and download them instantly.
            </Text>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer style={{
        borderTop: "1px solid #334155",
        padding: "24px 16px",
        textAlign: "center",
        background: "#1e293b"
      }}>
        <Text fontSize="small" color="#64748b">
          BookGrab &copy; {new Date().getFullYear()}
        </Text>
      </footer>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}
