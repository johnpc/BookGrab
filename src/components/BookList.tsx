"use client";

import { useState } from "react";
import { Book } from "@/types";
import BookCard from "./BookCard";
import {
  Flex,
  SelectField,
  ToggleButtonGroup,
  ToggleButton,
  Text,
  Loader,
  Alert,
  useTheme,
  View,
} from "@aws-amplify/ui-react";

interface BookListProps {
  books: Book[];
  isLoading: boolean;
  error?: string;
}

export default function BookList({ books, isLoading, error }: BookListProps) {
  const [view, setView] = useState<"grid" | "list">("grid");
  const { tokens } = useTheme();

  if (isLoading) {
    return (
      <div style={{
        width: "100%",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "80px 24px"
      }}>
        <div style={{
          textAlign: "center"
        }}>
          <div style={{
            width: "60px",
            height: "60px",
            border: "4px solid rgba(102, 126, 234, 0.2)",
            borderTop: "4px solid #667eea",
            borderRadius: "50%",
            margin: "0 auto 20px",
            animation: "spin 1s linear infinite"
          }} />
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
          <Text fontSize="medium" color="#94a3b8" fontWeight="500">
            Loading books...
          </Text>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        padding: "20px",
        background: "rgba(239, 68, 68, 0.15)",
        border: "1px solid rgba(239, 68, 68, 0.3)",
        borderRadius: "12px",
        color: "#ef4444",
        fontSize: "15px",
        fontWeight: "500"
      }}>
        ✕ Error: {error}
      </div>
    );
  }

  if (books.length === 0) {
    return (
      <div style={{
        width: "100%",
        textAlign: "center",
        padding: "80px 24px"
      }}>
        <div style={{
          fontSize: "48px",
          marginBottom: "16px"
        }}>📚</div>
        <Text fontSize="large" color="#94a3b8" fontWeight="500">
          No books found. Try a different search term.
        </Text>
      </div>
    );
  }

  return (
    <div style={{ width: "100%" }}>
      {/* Book grid - mobile-first, single column on mobile, 2 columns on larger screens */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr",
        gap: "12px",
        width: "100%"
      }}>
        {books.map((book) => (
          <BookCard key={book.id} book={book} />
        ))}
      </div>
    </div>
  );
}
