"use client";

import { useState, FormEvent, useRef, useEffect } from "react";
import {
  SearchField,
  Button,
  Flex,
  Card,
  Text,
  Divider,
  useTheme,
} from "@aws-amplify/ui-react";

interface SearchBarProps {
  onSearch: (query: string) => void;
  isLoading: boolean;
}

export default function SearchBar({ onSearch, isLoading }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [showRecent, setShowRecent] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { tokens } = useTheme();

  // Load recent searches from localStorage on component mount
  useEffect(() => {
    const savedSearches = localStorage.getItem("recentSearches");
    if (savedSearches) {
      try {
        setRecentSearches(JSON.parse(savedSearches));
      } catch (e) {
        console.error("Failed to parse recent searches:", e);
      }
    }
  }, []);

  // Handle clicks outside the dropdown to close it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(event.target as Node)
      ) {
        setShowRecent(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      performSearch(query.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (query.trim()) {
        performSearch(query.trim());
      }
    }
  };

  const performSearch = (searchQuery: string) => {
    onSearch(searchQuery);

    // Save to recent searches
    const updatedSearches = [
      searchQuery,
      ...recentSearches.filter((s) => s !== searchQuery),
    ].slice(0, 5); // Keep only the 5 most recent

    setRecentSearches(updatedSearches);
    localStorage.setItem("recentSearches", JSON.stringify(updatedSearches));
    setShowRecent(false);
  };

  const handleRecentSearch = (searchQuery: string) => {
    setQuery(searchQuery);
    performSearch(searchQuery);
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem("recentSearches");
    setShowRecent(false);
  };

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <form onSubmit={handleSubmit} style={{ width: "100%" }}>
        <div style={{ position: "relative" }}>
          <div style={{
            position: "absolute",
            left: "20px",
            top: "50%",
            transform: "translateY(-50%)",
            pointerEvents: "none",
            zIndex: 1
          }}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="22"
              height="22"
              fill="none"
              viewBox="0 0 24 24"
              stroke="#94a3b8"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <input
            ref={searchInputRef as any}
            type="text"
            placeholder="Search for books, authors, or series..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => recentSearches.length > 0 && setShowRecent(true)}
            disabled={isLoading}
            style={{
              width: "100%",
              padding: "16px 50px",
              fontSize: "15px",
              background: "#0f172a",
              border: "1px solid #334155",
              borderRadius: "10px",
              color: "#e5e7eb",
              outline: "none"
            }}
          />
        </div>
        <button type="submit" style={{ display: 'none' }} aria-hidden="true" />
      </form>

      {/* Recent searches dropdown */}
      {showRecent && recentSearches.length > 0 && (
        <div
          ref={dropdownRef as any}
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: 0,
            right: 0,
            background: "#1e293b",
            border: "1px solid #334155",
            borderRadius: "10px",
            padding: "12px",
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.4)",
            zIndex: 10
          }}
        >
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "8px",
            padding: "4px 8px"
          }}>
            <Text fontWeight="600" fontSize="small" color="#94a3b8">
              Recent Searches
            </Text>
            <button
              onClick={clearRecentSearches}
              style={{
                background: "none",
                border: "none",
                color: "#ef4444",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: "500",
                padding: "4px 8px",
                borderRadius: "6px"
              }}
            >
              Clear All
            </button>
          </div>
          <div style={{
            display: "flex",
            flexDirection: "column",
            gap: "4px"
          }}>
            {recentSearches.map((search, index) => (
              <button
                key={index}
                onClick={() => handleRecentSearch(search)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "10px 12px",
                  background: "transparent",
                  border: "none",
                  borderRadius: "8px",
                  color: "#e5e7eb",
                  cursor: "pointer",
                  textAlign: "left",
                  fontSize: "14px"
                }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="#94a3b8"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>{search}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
